import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { db, atomic, credit, lockUser } from "./db.js";
import { hash, userFor } from "./auth.js";
import {
  makeSeed,
  commitment,
  rng,
  deck,
  pokerScore,
  rank,
  shuffle,
} from "./games.js";
import { z } from "zod";
import { publicError } from "./errors.js";
export function attachRooms(http: HttpServer) {
  const io = new Server(http, {
    maxHttpBufferSize: 32768,
    allowRequest: (req, cb) =>
      cb(
        null,
        !req.headers.origin ||
          req.headers.origin ===
            (process.env.APP_URL ??
              `http://localhost:${process.env.PORT ?? 3000}`),
      ),
  });
  io.use(async (socket, next) => {
    try {
      const raw = socket.request.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("neon_session="))
        ?.slice(13);
      const user = await userFor(raw);
      if (!user) return next(Error("Войдите в аккаунт"));
      socket.data.user = user;
      socket.data.sessionId = hash(raw!);
      next();
    } catch {
      next(Error("Ошибка авторизации"));
    }
  });
  async function snapshot(code: string, viewer: string) {
    const room = await db.gameRoom.findUniqueOrThrow({
      where: { code },
      include: {
        members: {
          include: {
            user: {
              select: { nickname: true, profile: { select: { avatar: true } } },
            },
          },
        },
      },
    });
    const s = structuredClone(room.state) as any;
    const done = room.status === "DONE";
    if (!done) {
      delete s.seed;
      delete s.deck;
      delete s.discards;
      if (s.hands)
        s.hands = Object.fromEntries(
          Object.entries(s.hands).map(([id, hand]) => [
            id,
            id === viewer ? hand : [],
          ]),
        );
    }
    return {
      ...room,
      state: s,
      members: room.members.map((m) => ({
        userId: m.userId,
        score: m.score,
        nickname: m.user.nickname,
        avatar: m.user.profile?.avatar,
        online:
          [...(io.sockets.adapter.rooms.get(`user:${m.userId}`) ?? [])].length >
          0,
      })),
    };
  }
  async function broadcast(code: string) {
    const sockets = await io.in(`room:${code}`).fetchSockets();
    for (const s of sockets)
      s.emit("room", await snapshot(code, s.data.user.id));
  }
  io.on("connection", (socket) => {
    const id = socket.data.user.id;
    socket.join(`user:${id}`);
    let window = Date.now(),
      calls = 0;
    function on(event: string, fn: (data: any) => Promise<any>) {
      socket.on(event, async (data, ack) => {
        try {
          if (Date.now() - window > 60000) {
            window = Date.now();
            calls = 0;
          }
          if (++calls > 90) throw Error("Слишком много запросов");
          if (JSON.stringify(data ?? {}).length > 8000)
            throw Error("Слишком большой запрос");
          const authSession = await db.authSession.findFirst({
            where: {
              id: socket.data.sessionId,
              userId: id,
              expiresAt: { gt: new Date() },
            },
            include: { user: true },
          });
          if (!authSession) throw Error("Сессия завершена. Войдите заново");
          const user = authSession.user;
          if (user.banned || user.guest)
            throw Error("Комнаты доступны зарегистрированным игрокам");
          const result = await fn(data ?? {});
          if (typeof ack === "function") ack({ ok: true, ...result });
        } catch (e: any) {
          if (typeof ack === "function") ack({ error: publicError(e).error });
        }
      });
    }
    on("rooms", async () => ({
      rooms: await db.gameRoom.findMany({
        where: { members: { some: { userId: id } } },
        select: { code: true, game: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    }));
    on("create", async (data) => {
      const v = z
        .object({
          game: z.enum(["battle", "jackpot", "poker"]),
          bet: z.number().int().min(10).max(1000),
        })
        .parse(data);
      const room = await atomic(async (tx) => {
        await lockUser(tx, id);
        if (
          (await tx.gameRoom.count({
            where: { ownerId: id, status: { in: ["WAITING", "PLAYING"] } },
          })) >= 3
        )
          throw Error("Завершите предыдущие комнаты");
        return tx.gameRoom.create({
          data: {
            code: makeSeed().slice(0, 8).toUpperCase(),
            ownerId: id,
            game: v.game,
            state: { bet: v.bet },
            members: { create: { userId: id } },
          },
        });
      });
      socket.join(`room:${room.code}`);
      await broadcast(room.code);
      return { code: room.code };
    });
    on("join", async (data) => {
      const code = z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-F0-9]{8}$/)
        .parse(data.code);
      await atomic(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "GameRoom" WHERE code = ${code} FOR UPDATE`;
        const r = await tx.gameRoom.findUniqueOrThrow({
          where: { code },
          include: { members: true },
        });
        if (r.members.some((m) => m.userId === id)) return;
        if (r.status !== "WAITING" || r.members.length >= 6)
          throw Error("Комната закрыта или заполнена");
        await tx.roomMember.create({ data: { roomId: r.id, userId: id } });
      });
      socket.join(`room:${code}`);
      await broadcast(code);
      return { code };
    });
    on("invite", async (data) => {
      const v = z
        .object({ code: z.string(), userId: z.string().uuid() })
        .parse(data);
      const room = await db.gameRoom.findFirstOrThrow({
        where: { code: v.code, members: { some: { userId: id } } },
      });
      const f = await db.friendship.findFirst({
        where: { pair: [id, v.userId].sort().join(":"), status: "ACCEPTED" },
      });
      if (!f) throw Error("Сначала добавьте игрока в друзья");
      await db.notification.create({
        data: {
          userId: v.userId,
          message: `Приглашение от ${socket.data.user.nickname}: комната ${room.code}`,
        },
      });
      return {};
    });
    on("leave", async (data) => {
      const code = z.string().parse(data.code);
      await atomic(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "GameRoom" WHERE code = ${code} FOR UPDATE`;
        const room = await tx.gameRoom.findUniqueOrThrow({
          where: { code },
          include: { members: true },
        });
        if (room.status !== "WAITING") throw Error("Сначала завершите матч");
        if (room.ownerId === id)
          await tx.gameRoom.update({
            where: { id: room.id },
            data: {
              status: "DONE",
              state: { ...(room.state as any), cancelled: true },
            },
          });
        else
          await tx.roomMember.deleteMany({
            where: { roomId: room.id, userId: id },
          });
      });
      socket.leave(`room:${code}`);
      await broadcast(code);
      return {};
    });
    on("start", async (data) => {
      const code = z.string().parse(data.code);
      await atomic(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "GameRoom" WHERE code = ${code} FOR UPDATE`;
        const room = await tx.gameRoom.findUniqueOrThrow({
          where: { code },
          include: { members: true },
        });
        if (room.ownerId !== id) throw Error("Начинает создатель комнаты");
        if (room.status !== "WAITING") return;
        if (room.members.length < 2) throw Error("Нужно минимум два игрока");
        const seed = makeSeed(),
          r = rng(seed),
          s = room.state as any;
        const ids = room.members.map((m) => m.userId).sort();
        for (const uid of ids) {
          await lockUser(tx, uid);
          const user = await tx.user.findUniqueOrThrow({ where: { id: uid } });
          if (user.banned) throw Error("Игрок заблокирован");
          await credit(
            tx,
            uid,
            `room-bet:${room.id}`,
            -s.bet,
            0,
            `Комната ${room.game}`,
          );
        }
        const bank = s.bet * ids.length;
        const rolls: Record<string, number> = {},
          hands: Record<string, number[]> = {};
        let winners: string[] = [];
        if (room.game === "jackpot") winners = [ids[r(ids.length)]];
        else if (room.game === "battle") {
          for (const uid of ids) rolls[uid] = r(1000000);
          const max = Math.max(...Object.values(rolls));
          winners = ids.filter((uid) => rolls[uid] === max);
        } else {
          const d = deck(r);
          for (const uid of ids) hands[uid] = d.splice(0, 5);
          await tx.gameRoom.update({
            where: { id: room.id },
            data: {
              status: "PLAYING",
              state: {
                ...s,
                seed,
                commitment: commitment(seed),
                deck: d,
                hands,
                discards: [],
                drawn: [],
                started: Date.now(),
                bank,
              },
            },
          });
          return;
        }
        const payouts: Record<string, number> = {};
        for (const uid of ids) {
          const payout = winners.includes(uid)
            ? Math.floor(bank / winners.length) +
              (uid === winners[0] ? bank % winners.length : 0)
            : 0;
          payouts[uid] = payout;
          await credit(
            tx,
            uid,
            `room-win:${room.id}`,
            payout,
            0,
            "Результат комнаты",
          );
          await tx.roomMember.update({
            where: { roomId_userId: { roomId: room.id, userId: uid } },
            data: { score: rolls[uid] ?? (winners.includes(uid) ? 1 : 0) },
          });
          await tx.profile.update({
            where: { userId: uid },
            data: { xp: { increment: 25 } },
          });
        }
        await tx.gameRoom.update({
          where: { id: room.id },
          data: {
            status: "DONE",
            state: {
              ...s,
              seed,
              commitment: commitment(seed),
              bank,
              rolls,
              winners,
              payouts,
            },
          },
        });
      });
      await broadcast(code);
      return {};
    });
    on("draw", async (data) => {
      const v = z
        .object({
          code: z.string(),
          hold: z.array(z.number().int().min(0).max(4)).max(5),
        })
        .parse(data);
      if (new Set(v.hold).size !== v.hold.length) throw Error("Повтор карты");
      await atomic(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "GameRoom" WHERE code = ${v.code} FOR UPDATE`;
        const room = await tx.gameRoom.findUniqueOrThrow({
          where: { code: v.code },
          include: { members: true },
        });
        if (room.game !== "poker" || room.status !== "PLAYING")
          throw Error("Партия не активна");
        const s = room.state as any;
        if (!s.hands[id]) throw Error("Вы не участник");
        if (s.drawn.includes(id)) return;
        const discarded: number[] = [];
        s.hands[id] = s.hands[id].map((c: number, i: number) => {
          if (v.hold.includes(i)) return c;
          if (!s.deck.length) {
            s.deck = shuffle(s.discards, rng(s.seed + ":" + s.drawn.length));
            s.discards = [];
          }
          const next = s.deck.pop();
          discarded.push(c);
          return next;
        });
        s.discards.push(...discarded);
        s.drawn.push(id);
        await tx.gameRoom.update({
          where: { id: room.id },
          data: { state: s },
        });
      });
      await settlePoker(v.code);
      await broadcast(v.code);
      return {};
    });
    on("sync", async (data) => {
      const code = z.string().parse(data.code);
      const r = await db.gameRoom.findFirstOrThrow({
        where: { code, members: { some: { userId: id } } },
      });
      socket.join(`room:${code}`);
      await settlePoker(code);
      await broadcast(code);
      return {};
    });
    socket.on("disconnect", () => {
      for (const key of socket.rooms)
        if (key.startsWith("room:")) broadcast(key.slice(5)).catch(() => {});
    });
  });
  async function settlePoker(code: string) {
    await atomic(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "GameRoom" WHERE code = ${code} FOR UPDATE`;
      const room = await tx.gameRoom.findUniqueOrThrow({
        where: { code },
        include: { members: true },
      });
      if (room.status !== "PLAYING" || room.game !== "poker") return;
      const s = room.state as any;
      if (
        s.drawn.length !== room.members.length &&
        Date.now() - s.started < 120000
      )
        return;
      const scores: Record<string, number> = {};
      for (const m of room.members) {
        const h = s.hands[m.userId] as number[];
        const p = pokerScore(h);
        const counts = new Map<number, number>();
        for (const c of h) {
          const rankValue = rank(c) === 1 ? 14 : rank(c);
          counts.set(rankValue, (counts.get(rankValue) ?? 0) + 1);
        }
        const groups = [...counts.entries()].sort(
          (a, b) => b[1] - a[1] || b[0] - a[0],
        );
        const ranks = h
          .map((c) => (rank(c) === 1 ? 14 : rank(c)))
          .sort((a, b) => b - a);
        const straight =
          new Set(ranks).size === 5 &&
          (ranks[0] - ranks[4] === 4 || ranks.join(",") === "14,5,4,3,2");
        const pair = groups[0][1] === 2;
        let cat =
          p.label === "Royal flush" || p.label === "Straight flush"
            ? 8
            : p.label === "Four of a kind"
              ? 7
              : p.label === "Full house"
                ? 6
                : p.label === "Flush"
                  ? 5
                  : straight
                    ? 4
                    : p.label === "Three of a kind"
                      ? 3
                      : p.label === "Two pairs"
                        ? 2
                        : pair
                          ? 1
                          : 0;
        const tie = straight
          ? [ranks.join(",") === "14,5,4,3,2" ? 5 : ranks[0]]
          : groups.map((g) => g[0]);
        scores[m.userId] =
          cat * 15 ** 5 + tie.reduce((a, v, i) => a + v * 15 ** (4 - i), 0);
      }
      const ids = room.members.map((m) => m.userId).sort(),
        max = Math.max(...Object.values(scores)),
        winners = ids.filter((uid) => scores[uid] === max),
        payouts: Record<string, number> = {};
      for (const uid of ids) {
        await lockUser(tx, uid);
        const payout = winners.includes(uid)
          ? Math.floor(s.bank / winners.length) +
            (uid === winners[0] ? s.bank % winners.length : 0)
          : 0;
        payouts[uid] = payout;
        await credit(
          tx,
          uid,
          `room-win:${room.id}`,
          payout,
          0,
          "Draw Poker: результат",
        );
        await tx.roomMember.update({
          where: { roomId_userId: { roomId: room.id, userId: uid } },
          data: { score: scores[uid] },
        });
        await tx.profile.update({
          where: { userId: uid },
          data: { xp: { increment: 25 } },
        });
      }
      delete s.deck;
      await tx.gameRoom.update({
        where: { id: room.id },
        data: { status: "DONE", state: { ...s, scores, winners, payouts } },
      });
    });
  }
  const timer = setInterval(async () => {
    try {
      const rooms = await db.gameRoom.findMany({
        where: { status: "PLAYING", game: "poker" },
      });
      for (const r of rooms) {
        await settlePoker(r.code);
        await broadcast(r.code);
      }
    } catch {
      console.error("Room settlement failed");
    }
  }, 15000);
  timer.unref();
  io.on("close", () => clearInterval(timer));
  return io;
}
