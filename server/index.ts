import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { compare, hash as passwordHash } from "bcryptjs";
import { z } from "zod";
import { db, atomic, credit, lockUser } from "./db.js";
import { auth, admin, session, token, hash } from "./auth.js";
import {
  start,
  act,
  gameNames,
  commitment,
  makeSeed,
  type Game,
  type State,
  rng,
} from "./games.js";
import { day, week, claim, finish, present } from "./economy.js";
import { seed } from "../prisma/seed.js";
import { attachRooms } from "./rooms.js";
import { publicError } from "./errors.js";
process.env.APP_URL ||= process.env.RENDER_EXTERNAL_URL;
export const app = express();
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "font-src": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"],
      },
    },
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Слишком много запросов. Попробуйте через минуту." },
  }),
);
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      origin &&
      origin !==
        (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`)
    )
      return res.status(403).json({ error: "Недопустимый источник запроса" });
    if (!req.is("application/json"))
      return res.status(415).json({ error: "Ожидается JSON" });
  }
  next();
});
const wrap = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res)).catch(next);
const credentials = z
  .object({
    nickname: z
      .string()
      .trim()
      .regex(/^[a-zA-Zа-яА-ЯёЁ0-9_]{3,20}$/),
    password: z.string().min(10).max(128),
    referral: z.string().uuid().optional(),
  })
  .strict();
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  message: { error: "Слишком много попыток входа. Попробуйте через 15 минут." },
});
app.get(
  "/api/health",
  wrap(async (_req: any, res: any) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  }),
);
app.post(
  "/api/auth/register",
  authLimit,
  wrap(async (req: any, res: any) => {
    const v = credentials.parse(req.body),
      recovery = token();
    const ph = await passwordHash(v.password, 12);
    const ipHash = hash(`${process.env.IP_HASH_SECRET}:${req.ip}`);
    const u = await atomic(async (tx) => {
      const guard = await tx.registrationGuard.upsert({
        where: { ipHash_day: { ipHash, day: day() } },
        create: { ipHash, day: day() },
        update: { count: { increment: 1 } },
      });
      if (guard.count > 3)
        throw Error("Не более трёх регистраций с одной сети в сутки");
      const user = await tx.user.create({
        data: {
          nickname: v.nickname,
          passwordHash: ph,
          recoveryHash: hash(recovery),
          profile: { create: {} },
          wallet: { create: { coins: 10000 } },
        },
      });
      await tx.walletTransaction.create({
        data: {
          userId: user.id,
          key: "welcome",
          coins: 10000,
          balanceAfter: 10000,
          reason: "Welcome bonus",
        },
      });
      if (v.referral) {
        const inviter = await tx.user.findFirst({
          where: { id: v.referral, guest: false, banned: false },
        });
        if (inviter)
          await tx.referral.create({
            data: { referredId: user.id, inviterId: inviter.id },
          });
      }
      return user;
    });
    await session(res, u.id);
    res.json({ recoveryCode: recovery });
  }),
);
app.post(
  "/api/auth/login",
  authLimit,
  wrap(async (req: any, res: any) => {
    const v = credentials.parse(req.body);
    const u = await db.user.findUnique({ where: { nickname: v.nickname } });
    if (
      !u ||
      u.guest ||
      !(await compare(v.password, u.passwordHash)) ||
      u.banned
    )
      return res.status(401).json({ error: "Неверный никнейм или пароль" });
    await session(res, u.id);
    res.json({ ok: true });
  }),
);
app.post(
  "/api/auth/guest",
  authLimit,
  wrap(async (req: any, res: any) => {
    const ipHash = hash(`${process.env.IP_HASH_SECRET}:${req.ip}`);
    const u = await atomic(async (tx) => {
      const guard = await tx.registrationGuard.upsert({
        where: { ipHash_day: { ipHash, day: day() } },
        create: { ipHash, day: day() },
        update: { count: { increment: 1 } },
      });
      if (guard.count > 3) throw Error("Лимит гостевых аккаунтов");
      const u = await tx.user.create({
        data: {
          nickname: `Guest_${token().slice(0, 8)}`,
          passwordHash: "disabled",
          recoveryHash: hash(token()),
          guest: true,
          profile: { create: {} },
          wallet: { create: { coins: 1000 } },
        },
      });
      await tx.walletTransaction.create({
        data: {
          userId: u.id,
          key: "welcome",
          coins: 1000,
          balanceAfter: 1000,
          reason: "Guest welcome",
        },
      });
      return u;
    });
    await session(res, u.id);
    res.json({ ok: true });
  }),
);
app.post(
  "/api/auth/recover",
  authLimit,
  wrap(async (req: any, res: any) => {
    const v = z
      .object({
        nickname: z.string(),
        recoveryCode: z.string().length(64),
        password: z.string().min(10).max(128),
      })
      .parse(req.body);
    const recovery = token(),
      ph = await passwordHash(v.password, 12);
    await atomic(async (tx) => {
      const u = await tx.user.findUnique({ where: { nickname: v.nickname } });
      if (!u || u.recoveryHash !== hash(v.recoveryCode) || u.guest)
        throw Error("Неверный код восстановления");
      await lockUser(tx, u.id);
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: u.id } });
      if (fresh.recoveryHash !== hash(v.recoveryCode))
        throw Error("Код уже использован");
      await tx.user.update({
        where: { id: u.id },
        data: { passwordHash: ph, recoveryHash: hash(recovery) },
      });
      await tx.authSession.deleteMany({ where: { userId: u.id } });
    });
    res.json({ recoveryCode: recovery });
  }),
);
app.post(
  "/api/auth/logout",
  auth,
  wrap(async (req: any, res: any) => {
    await db.authSession.deleteMany({
      where: { id: hash(req.cookies.neon_session) },
    });
    res.clearCookie("neon_session");
    res.json({ ok: true });
  }),
);
app.use("/api", auth);
app.get(
  "/api/me",
  wrap(async (_req: any, res: any) => {
    const u = await db.user.findUniqueOrThrow({
      where: { id: res.locals.user.id },
      select: {
        id: true,
        nickname: true,
        role: true,
        guest: true,
        createdAt: true,
        profile: true,
        wallet: true,
        inventory: { include: { item: true } },
        achievements: { include: { achievement: true } },
        notifications: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    const played = await db.gameSession.count({
      where: { userId: u.id, status: "DONE" },
    });
    const totals = await db.gameResult.aggregate({
      where: { session: { userId: u.id } },
      _sum: { payout: true },
    });
    res.json({
      ...u,
      stats: { played, payout: totals._sum.payout ?? 0 },
      level: 1 + Math.floor(u.profile!.xp / 250),
    });
  }),
);
app.patch(
  "/api/profile",
  wrap(async (req: any, res: any) => {
    const v = z
      .object({
        bio: z.string().max(200).optional(),
        avatar: z.enum(["⚡", "🌙", "👾", "🦊", "🐉", "💎", "🪐"]).optional(),
        settings: z
          .object({
            sound: z.boolean(),
            effects: z.enum(["high", "low", "off"]),
          })
          .optional(),
      })
      .strict()
      .parse(req.body);
    if (v.avatar && !["⚡", "🌙", "👾", "🦊"].includes(v.avatar)) {
      const own = await db.inventory.findFirst({
        where: {
          userId: res.locals.user.id,
          item: { kind: "avatar", value: v.avatar },
        },
      });
      if (!own) throw Error("Сначала откройте аватар");
    }
    await db.profile.update({ where: { userId: res.locals.user.id }, data: v });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/history",
  wrap(async (_req: any, res: any) =>
    res.json({
      games: (
        await db.gameSession.findMany({
          where: { userId: res.locals.user.id },
          include: { result: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      ).map(present),
      transactions: await db.walletTransaction.findMany({
        where: { userId: res.locals.user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    }),
  ),
);
app.get(
  "/api/games/active",
  wrap(async (_req: any, res: any) =>
    res.json(
      (
        await db.gameSession.findMany({
          where: { userId: res.locals.user.id, status: "ACTIVE" },
          include: { result: true },
        })
      ).map(present),
    ),
  ),
);
app.post(
  "/api/games/start",
  wrap(async (req: any, res: any) => {
    const v = z
      .object({
        game: z.enum(gameNames),
        bet: z.number().int().min(0).max(10000),
        key: z.string().uuid(),
        options: z.record(z.string(), z.any()).default({}),
      })
      .strict()
      .parse(req.body);
    const id = res.locals.user.id;
    const result = await atomic(async (tx) => {
      await lockUser(tx, id);
      const existing = await tx.gameSession.findUnique({
        where: { userId_key: { userId: id, key: v.key } },
        include: { result: true },
      });
      if (existing) return existing;
      const config = await tx.economyConfig.findUniqueOrThrow({
        where: { id: "main" },
      });
      const free = ["memory", "daily"].includes(v.game);
      if (!free && (v.bet < config.minBet || v.bet > config.maxBet))
        throw Error(`Ставка ${config.minBet}–${config.maxBet} NC`);
      if (free && v.bet !== 0) throw Error("Эта игра бесплатная");
      if (
        res.locals.user.guest &&
        (!["slots", "dice", "coinflip", "memory"].includes(v.game) ||
          v.bet > 100)
      )
        throw Error(
          "Гостю доступны Slots, Dice, Coinflip и Memory; ставка до 100 NC",
        );
      if (
        (await tx.gameSession.count({
          where: { userId: id, status: "ACTIVE" },
        })) >= 1
      )
        throw Error("Завершите текущую игру в разделе «История»");
      if (free) {
        const kind = `free:${v.game}`;
        if (
          await tx.dailyReward.findUnique({
            where: { userId_kind_period: { userId: id, kind, period: day() } },
          })
        )
          throw Error("Бесплатная награда уже разыграна сегодня");
        await tx.dailyReward.create({
          data: { userId: id, kind, period: day() },
        });
      }
      const seed = makeSeed(),
        out = start(v.game, v.options, seed);
      let g = await tx.gameSession.create({
        data: {
          userId: id,
          game: v.game,
          key: v.key,
          bet: v.bet,
          state: out.state,
          seed,
          commitment: commitment(seed),
        },
      });
      await credit(tx, id, `bet:${g.id}`, -v.bet, 0, `Ставка: ${v.game}`);
      if (out.done) await finish(tx, id, g, out.state, out.mult);
      return tx.gameSession.findUniqueOrThrow({
        where: { id: g.id },
        include: { result: true },
      });
    });
    res.json(present(result));
  }),
);
app.post(
  "/api/games/:id/action",
  wrap(async (req: any, res: any) => {
    const v = z
      .object({ key: z.string().uuid(), action: z.record(z.string(), z.any()) })
      .strict()
      .parse(req.body);
    const id = res.locals.user.id;
    const result = await atomic(async (tx) => {
      await lockUser(tx, id);
      const g = await tx.gameSession.findFirstOrThrow({
        where: { id: req.params.id, userId: id },
        include: { result: true },
      });
      if (g.status === "DONE") return g;
      const state = g.state as State;
      if (state.actionKeys?.includes(v.key)) return g;
      let out;
      if (g.game === "blackjack" && v.action.type === "double") {
        if (state.player.length !== 2) throw Error("Нельзя удвоить");
        await credit(tx, id, `double:${g.id}`, -g.bet, 0, "Удвоение Blackjack");
        g.bet *= 2;
        await tx.gameSession.update({
          where: { id: g.id },
          data: { bet: g.bet },
        });
      }
      if (v.action.type === "forfeit") {
        out = {
          state: { ...state, forfeited: true, reward: 0 },
          done: true,
          mult: 0,
        };
      } else out = act(g.game as Game, state, v.action);
      out.state.actionKeys = [...(state.actionKeys ?? []), v.key];
      if (out.done) await finish(tx, id, g, out.state, out.mult);
      else
        await tx.gameSession.update({
          where: { id: g.id },
          data: { state: out.state },
        });
      return tx.gameSession.findUniqueOrThrow({
        where: { id: g.id },
        include: { result: true },
      });
    });
    res.json(present(result));
  }),
);
app.get(
  "/api/rewards",
  wrap(async (_req: any, res: any) =>
    res.json({
      claimed: await db.dailyReward.findMany({
        where: {
          userId: res.locals.user.id,
          OR: [
            { kind: "weekly", period: week() },
            {
              kind: { in: ["daily", "wheel", "free:memory", "free:daily"] },
              period: day(),
            },
            { period: "once" },
          ],
        },
      }),
      quests: await db.quest.findMany(),
      progress: await db.userQuest.findMany({
        where: { userId: res.locals.user.id, period: { in: [day(), week()] } },
      }),
      events: await db.event.findMany({
        where: { startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
      }),
      config: await db.economyConfig.findUnique({ where: { id: "main" } }),
    }),
  ),
);
app.post(
  "/api/rewards/claim",
  wrap(async (req: any, res: any) => {
    if (res.locals.user.guest)
      throw Error("Бонусы доступны зарегистрированным игрокам");
    const v = z
      .object({
        kind: z.enum([
          "daily",
          "weekly",
          "wheel",
          "quest",
          "level",
          "pass",
          "event",
          "prestige",
        ]),
        id: z.string().max(80).optional(),
      })
      .parse(req.body);
    const id = res.locals.user.id;
    const result = await atomic(async (tx) => {
      await lockUser(tx, id);
      const cfg = await tx.economyConfig.findUniqueOrThrow({
        where: { id: "main" },
      });
      if (v.kind === "daily")
        return claim(tx, id, "daily", day(), cfg.daily, 5);
      if (v.kind === "weekly")
        return claim(tx, id, "weekly", week(), cfg.weekly, 20);
      if (v.kind === "wheel") {
        const amount = [100, 250, 500, 750, 1000, 2500][rng(makeSeed())(6)];
        return claim(tx, id, "wheel", day(), amount, 0);
      }
      if (v.kind === "quest") {
        const q = await tx.quest.findUniqueOrThrow({
          where: { id: v.id ?? "" },
        });
        const period = q.period === "daily" ? day() : week();
        const uq = await tx.userQuest.findUnique({
          where: {
            userId_questId_period: { userId: id, questId: q.id, period },
          },
        });
        if (!uq || uq.progress < q.target || uq.claimed)
          throw Error("Задание не выполнено или награда получена");
        await tx.userQuest.update({
          where: {
            userId_questId_period: { userId: id, questId: q.id, period },
          },
          data: { claimed: true },
        });
        return claim(tx, id, `quest:${q.id}`, period, q.coins, 10);
      }
      const p = await tx.profile.findUniqueOrThrow({ where: { userId: id } });
      if (v.kind === "level" || v.kind === "pass") {
        const n = Number(v.id);
        if (!Number.isInteger(n) || n < 2 || n > 1 + Math.floor(p.xp / 250))
          throw Error("Уровень ещё не достигнут");
        return claim(
          tx,
          id,
          `${v.kind}:${p.prestige}:${n}`,
          "once",
          v.kind === "level" ? n * 100 : 0,
          v.kind === "pass" ? 10 : 0,
        );
      }
      if (v.kind === "prestige") {
        if (p.xp < 25000) throw Error("Для престижа нужен 101 уровень");
        await tx.profile.update({
          where: { userId: id },
          data: { xp: 0, prestige: { increment: 1 } },
        });
        return claim(tx, id, "prestige", String(p.prestige + 1), 0, 500);
      }
      const event = await tx.event.findFirstOrThrow({
        where: {
          id: v.id,
          startsAt: { lte: new Date() },
          endsAt: { gt: new Date() },
        },
      });
      return claim(tx, id, `event:${event.id}`, "once", event.coins, 10);
    });
    res.json(result);
  }),
);
app.post(
  "/api/promo",
  wrap(async (req: any, res: any) => {
    if (res.locals.user.guest) throw Error("Недоступно гостю");
    const code = z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,30}$/)
      .parse(req.body.code);
    await atomic(async (tx) => {
      const id = res.locals.user.id;
      await lockUser(tx, id);
      const p = await tx.promoCode.findUnique({ where: { code } });
      if (!p || p.expiresAt < new Date() || p.uses >= p.limit)
        throw Error("Промокод недоступен");
      await tx.promoRedemption.create({ data: { userId: id, code } });
      await tx.promoCode.update({
        where: { code },
        data: { uses: { increment: 1 } },
      });
      await credit(tx, id, `promo:${code}`, p.coins, p.crystals, "Промокод");
    });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/shop",
  wrap(async (_req: any, res: any) =>
    res.json(await db.cosmeticItem.findMany()),
  ),
);
app.post(
  "/api/shop/buy",
  wrap(async (req: any, res: any) => {
    if (res.locals.user.guest) throw Error("Недоступно гостю");
    const itemId = z.string().max(80).parse(req.body.itemId);
    await atomic(async (tx) => {
      const id = res.locals.user.id;
      await lockUser(tx, id);
      if (
        await tx.inventory.findUnique({
          where: { userId_itemId: { userId: id, itemId } },
        })
      )
        throw Error("Уже в коллекции");
      const item = await tx.cosmeticItem.findUniqueOrThrow({
        where: { id: itemId },
      });
      if (item.id === "friend-aura")
        throw Error("Пригласите друга, который завершит 5 игр");
      await credit(
        tx,
        id,
        `shop:${itemId}`,
        0,
        -item.price,
        `Покупка: ${item.name}`,
      );
      await tx.inventory.create({ data: { userId: id, itemId } });
    });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/shop/equip",
  wrap(async (req: any, res: any) => {
    const item = await db.inventory.findUniqueOrThrow({
      where: {
        userId_itemId: {
          userId: res.locals.user.id,
          itemId: z.string().parse(req.body.itemId),
        },
      },
      include: { item: true },
    });
    if (item.item.kind === "avatar")
      await db.profile.update({
        where: { userId: res.locals.user.id },
        data: { avatar: item.item.value },
      });
    else
      await atomic(async (tx) => {
        await lockUser(tx, res.locals.user.id);
        await tx.inventory.updateMany({
          where: { userId: res.locals.user.id, item: { kind: item.item.kind } },
          data: { equipped: false },
        });
        await tx.inventory.update({
          where: {
            userId_itemId: { userId: res.locals.user.id, itemId: item.itemId },
          },
          data: { equipped: true },
        });
      });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/leaderboard",
  wrap(async (req: any, res: any) => {
    const category = z
      .enum([
        "xp",
        "achievements",
        "collection",
        "weekly",
        "minigames",
        "tournaments",
      ])
      .catch("xp")
      .parse(req.query.category);
    const entries = await db.$queryRaw<
      Array<{ id: string; nickname: string; avatar: string; score: number }>
    >`
 SELECT u.id, u.nickname, p.avatar, (CASE
 WHEN ${category} = 'xp' THEN COALESCE(p.xp,0)
 WHEN ${category} = 'achievements' THEN (SELECT COUNT(*) FROM "UserAchievement" a WHERE a."userId"=u.id)
 WHEN ${category} = 'collection' THEN (SELECT COUNT(*) FROM "Inventory" i WHERE i."userId"=u.id)
 WHEN ${category} = 'weekly' THEN (SELECT COUNT(*) FROM "GameSession" g WHERE g."userId"=u.id AND g.status='DONE' AND g."createdAt">=${new Date(week())})
 WHEN ${category} = 'minigames' THEN COALESCE((SELECT MAX(r.payout) FROM "GameResult" r JOIN "GameSession" g ON g.id=r."sessionId" WHERE g."userId"=u.id AND g.game='memory'),0)
 ELSE (SELECT COUNT(*) FROM "WalletTransaction" w WHERE w."userId"=u.id AND w.reason='Победа в турнире') END)::integer AS score
 FROM "User" u LEFT JOIN "Profile" p ON p."userId"=u.id WHERE NOT u.guest AND NOT u.banned ORDER BY score DESC,u.nickname ASC LIMIT 50`;
    await db.leaderboard.upsert({
      where: { id: category },
      create: { id: category, category, entries },
      update: { entries },
    });
    res.json(entries);
  }),
);
app.get(
  "/api/friends",
  wrap(async (req: any, res: any) => {
    const id = res.locals.user.id;
    const query = z.string().max(20).catch("").parse(req.query.q);
    const friends = await db.friendship.findMany({
      where: { OR: [{ senderId: id }, { receiverId: id }] },
    });
    const ids = friends.map((f) =>
      f.senderId === id ? f.receiverId : f.senderId,
    );
    const players = await db.user.findMany({
      where: {
        banned: false,
        guest: false,
        ...(query
          ? { nickname: { contains: query, mode: "insensitive" } }
          : { id: { in: ids } }),
      },
      select: {
        id: true,
        nickname: true,
        profile: { select: { avatar: true, xp: true } },
      },
      take: 30,
    });
    res.json({
      players: players.map((p) => ({
        ...p,
        online: (io.sockets.adapter.rooms.get(`user:${p.id}`)?.size ?? 0) > 0,
      })),
      friends,
    });
  }),
);
app.post(
  "/api/friends",
  wrap(async (req: any, res: any) => {
    const id = res.locals.user.id;
    if (res.locals.user.guest) throw Error("Недоступно гостю");
    const v = z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["request", "accept", "remove"]),
      })
      .parse(req.body);
    if (v.userId === id) throw Error("Это ваш аккаунт");
    await atomic(async (tx) => {
      const target = await tx.user.findFirstOrThrow({
        where: { id: v.userId, banned: false, guest: false },
      });
      const pair = [id, target.id].sort().join(":");
      if (v.action === "request") {
        await tx.friendship.create({
          data: { senderId: id, receiverId: target.id, pair },
        });
        await tx.notification.create({
          data: {
            userId: target.id,
            message: `${res.locals.user.nickname} хочет добавить вас в друзья`,
          },
        });
      } else if (v.action === "accept") {
        await tx.friendship.update({
          where: { pair, receiverId: id, status: "PENDING" },
          data: { status: "ACCEPTED" },
        });
      } else
        await tx.friendship.deleteMany({
          where: { pair, OR: [{ senderId: id }, { receiverId: id }] },
        });
    });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/notifications/read",
  wrap(async (_req: any, res: any) => {
    await db.notification.updateMany({
      where: { userId: res.locals.user.id },
      data: { read: true },
    });
    res.json({ ok: true });
  }),
);
app.get(
  "/api/tournaments",
  wrap(async (_req: any, res: any) => {
    const list = await db.tournament.findMany({
      orderBy: { endsAt: "desc" },
      take: 20,
      include: {
        participants: {
          orderBy: { score: "desc" },
          take: 50,
          include: { user: { select: { nickname: true } } },
        },
      },
    });
    res.json(list);
  }),
);
app.post(
  "/api/tournaments/:id/join",
  wrap(async (req: any, res: any) => {
    if (res.locals.user.guest) throw Error("Недоступно гостю");
    const t = await db.tournament.findFirstOrThrow({
      where: {
        id: req.params.id,
        startsAt: { lte: new Date() },
        endsAt: { gt: new Date() },
      },
    });
    await db.tournamentParticipant.upsert({
      where: {
        tournamentId_userId: { tournamentId: t.id, userId: res.locals.user.id },
      },
      create: { tournamentId: t.id, userId: res.locals.user.id },
      update: {},
    });
    res.json({ ok: true });
  }),
);
app.use("/api/admin", admin);
app.get(
  "/api/admin",
  wrap(async (_req: any, res: any) =>
    res.json({
      users: await db.user.findMany({
        select: {
          id: true,
          nickname: true,
          role: true,
          banned: true,
          guest: true,
          wallet: true,
        },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      actions: await db.adminAction.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      transactions: await db.walletTransaction.findMany({
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      config: await db.economyConfig.findUnique({ where: { id: "main" } }),
      promos: await db.promoCode.findMany(),
      events: await db.event.findMany(),
      tournaments: await db.tournament.findMany(),
      stats: {
        users: await db.user.count(),
        games: await db.gameSession.count(),
        active: await db.gameSession.count({ where: { status: "ACTIVE" } }),
      },
    }),
  ),
);
app.post(
  "/api/admin",
  wrap(async (req: any, res: any) => {
    const v = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("credit"),
          userId: z.string().uuid(),
          coins: z.number().int().min(0).max(1000000),
          key: z.string().uuid(),
        }),
        z.object({
          action: z.literal("ban"),
          userId: z.string().uuid(),
          banned: z.boolean(),
        }),
        z.object({
          action: z.literal("config"),
          daily: z.number().int().min(100).max(10000),
          weekly: z.number().int().min(100).max(50000),
          minBet: z.number().int().min(1).max(1000),
          maxBet: z.number().int().min(1000).max(10000),
        }),
        z.object({
          action: z.literal("promo"),
          code: z.string().regex(/^[A-Z0-9_-]{3,30}$/),
          coins: z.number().int().min(0).max(100000),
          crystals: z.number().int().min(0).max(1000),
          limit: z.number().int().min(1).max(100000),
          expiresAt: z.iso.datetime(),
        }),
        z.object({
          action: z.literal("event"),
          title: z.string().min(3).max(80),
          description: z.string().max(500),
          coins: z.number().int().min(0).max(10000),
          startsAt: z.iso.datetime(),
          endsAt: z.iso.datetime(),
        }),
        z.object({
          action: z.literal("tournament"),
          title: z.string().min(3).max(80),
          reward: z.number().int().min(0).max(10000),
          startsAt: z.iso.datetime(),
          endsAt: z.iso.datetime(),
        }),
      ])
      .parse(req.body);
    await atomic(async (tx) => {
      if (v.action === "credit") {
        await lockUser(tx, v.userId);
        await credit(
          tx,
          v.userId,
          `admin:${v.key}`,
          v.coins,
          0,
          "Начисление администратора",
        );
      } else if (v.action === "ban") {
        if (v.userId === res.locals.user.id)
          throw Error("Нельзя заблокировать себя");
        await tx.user.update({
          where: { id: v.userId },
          data: { banned: v.banned },
        });
        await tx.authSession.deleteMany({ where: { userId: v.userId } });
      } else if (v.action === "config") {
        const { action, ...data } = v;
        await tx.economyConfig.update({ where: { id: "main" }, data });
      } else if (v.action === "promo") {
        const { action, ...data } = v;
        await tx.promoCode.create({
          data: { ...data, expiresAt: new Date(v.expiresAt) },
        });
      } else {
        if (new Date(v.endsAt) <= new Date(v.startsAt))
          throw Error("Дата окончания должна быть позже начала");
        if (v.action === "event") {
          const { action, ...data } = v;
          await tx.event.create({
            data: {
              ...data,
              startsAt: new Date(v.startsAt),
              endsAt: new Date(v.endsAt),
            },
          });
        } else {
          const { action, ...data } = v;
          await tx.tournament.create({
            data: {
              ...data,
              startsAt: new Date(v.startsAt),
              endsAt: new Date(v.endsAt),
            },
          });
        }
      }
      await tx.adminAction.create({
        data: {
          actorId: res.locals.user.id,
          action: v.action,
          targetId: "userId" in v ? v.userId : null,
          details: v,
        },
      });
    });
    res.json({ ok: true });
  }),
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Маршрут не найден" }),
);
app.use(express.static(resolve("dist/client")));
app.get("*", (_req, res) => res.sendFile(resolve("dist/client/index.html")));
app.use((e: any, _req: any, res: any, _next: any) => {
  const out = publicError(e);
  res.status(out.status).json({ error: out.error });
});
export const server = createServer(app);
export const io = attachRooms(server);
export async function maintenance() {
  await db.registrationGuard.deleteMany({
    where: {
      day: {
        lt: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      },
    },
  });
  await db.authSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  for (const t of await db.tournament.findMany({
    where: { endsAt: { lte: new Date() }, settled: false },
  }))
    await atomic(async (tx) => {
      const locked =
        await tx.$queryRaw`SELECT id FROM "Tournament" WHERE id = ${t.id} FOR UPDATE`;
      const fresh = await tx.tournament.findUniqueOrThrow({
        where: { id: t.id },
      });
      if (fresh.settled) return;
      const winner = await tx.tournamentParticipant.findFirst({
        where: { tournamentId: t.id },
        orderBy: [{ score: "desc" }, { userId: "asc" }],
      });
      if (winner) {
        await lockUser(tx, winner.userId);
        await credit(
          tx,
          winner.userId,
          `tournament:${t.id}`,
          0,
          t.reward,
          "Победа в турнире",
        );
      }
      await tx.tournament.update({
        where: { id: t.id },
        data: { settled: true },
      });
    });
}
if (process.env.NODE_ENV !== "test") {
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.APP_URL?.startsWith("https://") ||
      !process.env.IP_HASH_SECRET ||
      process.env.IP_HASH_SECRET.length < 32)
  )
    throw Error("APP_URL HTTPS и IP_HASH_SECRET (32+) обязательны");
  await seed(db);
  await maintenance();
  server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0", () =>
    console.log("NEON CASINO listening"),
  );
  setInterval(
    () => maintenance().catch(() => console.error("Maintenance failed")),
    60000,
  ).unref();
}

async function shutdown() {
  io.close();
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
if (process.env.NODE_ENV !== "test") {
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
