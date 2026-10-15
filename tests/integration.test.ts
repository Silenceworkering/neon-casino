import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { io as connect, Socket } from "socket.io-client";
const url = process.env.TEST_DATABASE_URL;
if (!url)
  console.log(
    "Integration tests skipped: set TEST_DATABASE_URL to a dedicated *_test PostgreSQL database.",
  );
else {
  if (!new URL(url).pathname.endsWith("_test"))
    throw Error(
      "TEST_DATABASE_URL must end with _test; tests reset its schema",
    );
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = "test";
  const { app, server, io, maintenance } = await import("../server/index.js");
  const { db, atomic, credit, lockUser } = await import("../server/db.js");
  const { seed } = await import("../prisma/seed.js");
  const a = request.agent(app),
    b = request.agent(app);
  let aid = "",
    bid = "",
    recovery = "",
    cookieA = "",
    cookieB = "",
    base = "";
  const sockets: Socket[] = [];
  before(async () => {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    await c.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await c.query(
      await readFile(
        "prisma/migrations/20261015000000_initial/migration.sql",
        "utf8",
      ),
    );
    await c.end();
    await seed(db);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = "http://127.0.0.1:" + (server.address() as any).port;
  });
  after(async () => {
    for (const s of sockets) s.disconnect();
    await new Promise<void>((r) => io.close(() => r()));
    await db.$disconnect();
  });
  test("registration, login, recovery and persistent account balance", async () => {
    let r = await a
      .post("/api/auth/register")
      .send({ nickname: "NeonAlice", password: "secure-password-123" });
    assert.equal(r.status, 200, r.text);
    recovery = r.body.recoveryCode;
    cookieA = r.headers["set-cookie"][0].split(";")[0];
    assert.equal(recovery.length, 64);
    r = await b
      .post("/api/auth/register")
      .send({ nickname: "NeonBob", password: "secure-password-456" });
    assert.equal(r.status, 200, r.text);
    cookieB = r.headers["set-cookie"][0].split(";")[0];
    const ma = (await a.get("/api/me")).body,
      mb = (await b.get("/api/me")).body;
    aid = ma.id;
    bid = mb.id;
    assert.equal(ma.wallet.coins, 10000);
    const user = await db.user.findUniqueOrThrow({ where: { id: aid } });
    assert.ok(user.passwordHash.startsWith("$2"));
    assert.notEqual(user.recoveryHash, recovery);
    assert.equal(
      (
        await a
          .post("/api/auth/login")
          .send({ nickname: "NeonAlice", password: "wrong-password" })
      ).status,
      401,
    );
    assert.equal((await request(app).get("/api/me")).status, 401);
    assert.equal(
      (
        await a
          .post("/api/games/start")
          .set("Origin", "https://attacker.example")
          .send({})
      ).status,
      403,
    );
  });
  test("strict validation, unauthorized wallet changes and idempotent parallel bets", async () => {
    const k = randomUUID(),
      body = { game: "dice", bet: 100, key: k, options: { target: 50 } };
    assert.equal(
      (await a.post("/api/games/start").send({ ...body, balance: 999999 }))
        .status,
      400,
    );
    assert.equal(
      (await a.post("/api/wallet").send({ coins: 99999 })).status,
      404,
    );
    const requests = await Promise.all(
      Array.from({ length: 5 }, () => a.post("/api/games/start").send(body)),
    );
    assert.ok(
      requests.every((r) => r.status === 200),
      JSON.stringify(requests.map((r) => r.body)),
    );
    assert.equal(new Set(requests.map((r) => r.body.id)).size, 1);
    const game = requests[0].body;
    const w = await db.wallet.findUniqueOrThrow({ where: { userId: aid } });
    assert.equal(w.coins, 10000 - 100 + game.result.payout);
    assert.equal(
      await db.walletTransaction.count({
        where: { userId: aid, key: `bet:${game.id}` },
      }),
      1,
    );
  });
  test("active session ownership, masked mines and single settlement on replay", async () => {
    const r = await a.post("/api/games/start").send({
      game: "mines",
      bet: 100,
      key: randomUUID(),
      options: { mines: 3 },
    });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.state.mines, undefined);
    const gid = r.body.id;
    assert.equal(
      (
        await b
          .post(`/api/games/${gid}/action`)
          .send({ key: randomUUID(), action: { type: "cashout" } })
      ).status,
      404,
    );
    const secret = await db.gameSession.findUniqueOrThrow({
        where: { id: gid },
      }),
      s = secret.state as any,
      safe = Array.from({ length: 25 }, (_, i) => i).find(
        (i) => !s.mines.includes(i),
      );
    const k = randomUUID(),
      action = { key: k, action: { index: safe } };
    assert.equal(
      (await a.post(`/api/games/${gid}/action`).send(action)).status,
      200,
    );
    assert.equal(
      (await a.post(`/api/games/${gid}/action`).send(action)).body.state.opened
        .length,
      1,
    );
    const rs = await Promise.all(
      Array.from({ length: 5 }, () =>
        a
          .post(`/api/games/${gid}/action`)
          .send({ key: randomUUID(), action: { type: "cashout" } }),
      ),
    );
    assert.ok(rs.every((r) => r.status === 200));
    assert.equal(await db.gameResult.count({ where: { sessionId: gid } }), 1);
    assert.equal(
      await db.walletTransaction.count({ where: { key: `settle:${gid}` } }),
      1,
    );
  });
  test("atomic daily/weekly bonuses and promo global use limit", async () => {
    const before = await db.wallet.findUniqueOrThrow({
      where: { userId: aid },
    });
    const rs = await Promise.all(
      Array.from({ length: 5 }, () =>
        a.post("/api/rewards/claim").send({ kind: "daily" }),
      ),
    );
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
    const after = await db.wallet.findUniqueOrThrow({ where: { userId: aid } });
    assert.equal(after.coins - before.coins, 1000);
    await db.promoCode.create({
      data: {
        code: "ONCE",
        coins: 2000,
        limit: 1,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const pr = await Promise.all([
      a.post("/api/promo").send({ code: "ONCE" }),
      b.post("/api/promo").send({ code: "ONCE" }),
    ]);
    assert.equal(pr.filter((r) => r.status === 200).length, 1);
    assert.equal(
      (await db.promoCode.findUniqueOrThrow({ where: { code: "ONCE" } })).uses,
      1,
    );
  });
  test("daily free challenge cannot be replayed or turn negative balance", async () => {
    const r = await a
      .post("/api/games/start")
      .send({ game: "daily", bet: 0, key: randomUUID(), options: {} });
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.state.answer, undefined);
    const k = randomUUID(),
      body = { key: k, action: { answer: r.body.state.a + r.body.state.b } };
    const before = await db.wallet.findUniqueOrThrow({
      where: { userId: aid },
    });
    let out = await a.post(`/api/games/${r.body.id}/action`).send(body);
    assert.equal(out.status, 200, out.text);
    await a.post(`/api/games/${r.body.id}/action`).send(body);
    assert.equal(
      (await db.wallet.findUniqueOrThrow({ where: { userId: aid } })).coins,
      before.coins + 500,
    );
    assert.equal(
      (
        await a
          .post("/api/games/start")
          .send({ game: "daily", bet: 0, key: randomUUID(), options: {} })
      ).status,
      400,
    );
    await assert.rejects(
      atomic(async (tx) => {
        await lockUser(tx, bid);
        await credit(tx, bid, "overspend", -1000000, 0, "Test");
      }),
    );
    assert.ok(
      (await db.wallet.findUniqueOrThrow({ where: { userId: bid } })).coins >=
        0,
    );
  });
  test("friends, private acceptance and crystal shop deduplication", async () => {
    assert.equal(
      (await a.post("/api/friends").send({ userId: bid, action: "request" }))
        .status,
      200,
    );
    assert.equal(
      (await a.post("/api/friends").send({ userId: bid, action: "accept" }))
        .status,
      404,
    );
    assert.equal(
      (await b.post("/api/friends").send({ userId: aid, action: "accept" }))
        .status,
      200,
    );
    assert.equal(
      (await a.get("/api/friends")).body.friends[0].status,
      "ACCEPTED",
    );
    await atomic(async (tx) => {
      await lockUser(tx, aid);
      await credit(tx, aid, "test-crystals", 0, 100, "Test fixture");
    });
    const rs = await Promise.all([
      a.post("/api/shop/buy").send({ itemId: "avatar-dragon" }),
      a.post("/api/shop/buy").send({ itemId: "avatar-dragon" }),
    ]);
    assert.equal(rs.filter((r) => r.status === 200).length, 1);
    assert.equal(
      await db.inventory.count({
        where: { userId: aid, itemId: "avatar-dragon" },
      }),
      1,
    );
    assert.equal(
      (await a.post("/api/shop/buy").send({ itemId: "friend-aura" })).status,
      400,
    );
  });
  test("dedicated admin login, bootstrap isolation and password rotation", async () => {
    const { bootstrapAdmin } = await import("../server/admin-bootstrap.js");
    const login = "AdminFixture",
      password = "fixture-admin-password-123456";
    await assert.rejects(bootstrapAdmin({ login: "NeonAlice", password }));
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: aid } })).role,
      "USER",
    );
    const owner = await bootstrapAdmin({ login, password });
    assert.ok(owner);
    assert.notEqual(owner.passwordHash, password);
    await bootstrapAdmin({ login, password });
    assert.equal(await db.user.count({ where: { nickname: login } }), 1);
    const agent = request.agent(app);
    assert.equal(
      (
        await agent
          .post("/api/auth/admin/login")
          .send({ login: "NeonAlice", password: "secure-password-123" })
      ).status,
      401,
    );
    assert.equal(
      (
        await agent
          .post("/api/auth/admin/login")
          .send({ login, password: "incorrect" })
      ).status,
      401,
    );
    const response = await agent
      .post("/api/auth/admin/login")
      .send({ login, password });
    assert.equal(response.status, 200, response.text);
    assert.match(response.headers["set-cookie"][0], /Max-Age=28800/);
    assert.equal((await agent.get("/api/admin")).status, 200);
    await bootstrapAdmin({ login, password: password + "-rotated" });
    assert.equal((await agent.get("/api/admin")).status, 401);
    assert.equal(
      (await agent.post("/api/auth/admin/login").send({ login, password }))
        .status,
      401,
    );
    assert.equal(
      (
        await agent
          .post("/api/auth/admin/login")
          .send({ login, password: password + "-rotated" })
      ).status,
      200,
    );
    assert.equal(
      await db.adminAction.count({
        where: { action: "rotate-admin-password", targetId: owner.id },
      }),
      1,
    );
  });
  test("admin role enforcement, audited idempotent grant and leaderboard", async () => {
    assert.equal((await a.get("/api/admin")).status, 403);
    await db.user.update({ where: { id: bid }, data: { role: "ADMIN" } });
    const before = await db.wallet.findUniqueOrThrow({
      where: { userId: aid },
    });
    const body = {
      action: "credit",
      userId: aid,
      coins: 500,
      key: randomUUID(),
    };
    for (let i = 0; i < 2; i++)
      assert.equal((await b.post("/api/admin").send(body)).status, 200);
    assert.equal(
      (await db.wallet.findUniqueOrThrow({ where: { userId: aid } })).coins,
      before.coins + 500,
    );
    assert.ok((await db.adminAction.count()) > 0);
    assert.equal((await a.get("/api/leaderboard")).status, 200);
  });
  async function socket(cookie: string) {
    const s = connect(base, {
      extraHeaders: { Cookie: cookie },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(s);
    await new Promise<void>((resolve, reject) => {
      s.once("connect", () => resolve());
      s.once("connect_error", reject);
    });
    return s;
  }
  async function emit(s: Socket, event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) =>
      s
        .timeout(8000)
        .emit(event, data, (err: any, out: any) =>
          err
            ? reject(err)
            : out.error
              ? reject(Error(out.error))
              : resolve(out),
        ),
    );
  }
  test("real multiplayer battle/jackpot conservation, start replay and reconnect", async () => {
    const sa = await socket(cookieA),
      sb = await socket(cookieB);
    for (const game of ["battle", "jackpot"]) {
      const { code } = await emit(sa, "create", { game, bet: 100 });
      await emit(sb, "join", { code });
      const before = await db.wallet.aggregate({
        _sum: { coins: true },
        where: { userId: { in: [aid, bid] } },
      });
      await emit(sa, "start", { code });
      await emit(sa, "start", { code });
      const room = await db.gameRoom.findUniqueOrThrow({
        where: { code },
        include: { members: true },
      });
      assert.equal(room.status, "DONE");
      assert.equal((room.state as any).bank, 200);
      const after = await db.wallet.aggregate({
        _sum: { coins: true },
        where: { userId: { in: [aid, bid] } },
      });
      assert.equal(after._sum.coins, before._sum.coins);
      assert.equal(
        await db.walletTransaction.count({
          where: { key: `room-bet:${room.id}` },
        }),
        2,
      );
      await emit(sb, "sync", { code });
    }
    sa.disconnect();
    const reconnected = await socket(cookieA);
    const out = await emit(reconnected, "rooms", {});
    assert.ok(out.rooms.length >= 2);
  });
  test("multiplayer poker hides other hands and atomically pays full pot", async () => {
    const sa = await socket(cookieA),
      sb = await socket(cookieB);
    const { code } = await emit(sa, "create", { game: "poker", bet: 100 });
    await emit(sb, "join", { code });
    let snapshot: any;
    sa.on("room", (r) => (snapshot = r));
    await emit(sa, "start", { code });
    await emit(sa, "sync", { code });
    assert.equal(snapshot.state.seed, undefined);
    assert.equal(snapshot.state.deck, undefined);
    assert.equal(snapshot.state.hands[bid].length, 0);
    assert.equal(snapshot.state.hands[aid].length, 5);
    const before = await db.wallet.aggregate({
      _sum: { coins: true },
      where: { userId: { in: [aid, bid] } },
    });
    await emit(sa, "draw", { code, hold: [] });
    await emit(sb, "draw", { code, hold: [] });
    const room = await db.gameRoom.findUniqueOrThrow({ where: { code } });
    assert.equal(room.status, "DONE");
    const after = await db.wallet.aggregate({
      _sum: { coins: true },
      where: { userId: { in: [aid, bid] } },
    });
    assert.equal(after._sum.coins!, before._sum.coins! + 200);
  });
  test("all 18 games complete through HTTP and persistent history", async () => {
    const names = [
      "slots",
      "roulette",
      "blackjack",
      "mines",
      "crash",
      "plinko",
      "dice",
      "coinflip",
      "limbo",
      "hilo",
      "tower",
      "wheel",
      "cases",
      "poker",
      "baccarat",
      "keno",
      "memory",
      "daily",
    ];
    for (const game of names) {
      let response = await b.post("/api/games/start").send({
        game,
        bet: ["memory", "daily"].includes(game) ? 0 : 10,
        key: randomUUID(),
        options: {},
      });
      assert.equal(response.status, 200, game + response.text);
      let g = response.body;
      if (g.status === "ACTIVE") {
        const secret = await db.gameSession.findUniqueOrThrow({
            where: { id: g.id },
          }),
          state = secret.state as any;
        let actions: any[] = [];
        if (game === "blackjack") actions = [{ type: "stand" }];
        else if (game === "mines") actions = [{ index: state.mines[0] }];
        else if (game === "tower") actions = [{ index: state.bad[0] }];
        else if (game === "hilo")
          actions = [
            { type: state.card % 13 === 0 ? "higher" : "lower" },
            { type: "cashout" },
          ];
        else if (game === "poker") actions = [{ hold: [] }];
        else if (game === "crash") actions = [{ type: "forfeit" }];
        else if (game === "daily") actions = [{ answer: state.answer }];
        else if (game === "memory")
          for (let n = 0; n < 6; n++)
            for (let i = 0; i < 12; i++)
              if (state.cards[i] === n) actions.push({ index: i });
        for (const action of actions) {
          if (g.status === "DONE") break;
          response = await b
            .post(`/api/games/${g.id}/action`)
            .send({ key: randomUUID(), action });
          assert.equal(response.status, 200, game + response.text);
          g = response.body;
        }
      }
      assert.equal(g.status, "DONE", game);
      assert.ok(g.seed);
      assert.ok(g.result.payout >= 0);
    }
    assert.ok((await b.get("/api/history")).body.games.length >= 18);
  });
  test("six-player poker reshuffles discards without duplicate cards or lost coins", async () => {
    const players: Socket[] = [];
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const raw = randomUUID();
      const user = await db.user.create({
        data: {
          nickname: "SixPlayer_" + i,
          passwordHash: "fixture",
          recoveryHash: "fixture",
          profile: { create: {} },
          wallet: { create: {} },
          sessions: {
            create: {
              id: (await import("../server/auth.js")).hash(raw),
              expiresAt: new Date(Date.now() + 60000),
            },
          },
        },
      });
      ids.push(user.id);
      players.push(await socket("neon_session=" + raw));
    }
    const { code } = await emit(players[0], "create", {
      game: "poker",
      bet: 100,
    });
    for (const p of players.slice(1)) await emit(p, "join", { code });
    await emit(players[0], "start", { code });
    for (const p of players) await emit(p, "draw", { code, hold: [] });
    const r = await db.gameRoom.findUniqueOrThrow({ where: { code } }),
      s = r.state as any;
    assert.equal(r.status, "DONE");
    const cards = Object.values(s.hands).flat();
    assert.equal(cards.length, 30);
    assert.equal(new Set(cards).size, 30);
    assert.ok(cards.every((c) => Number.isInteger(c)));
    const w = await db.wallet.aggregate({
      where: { userId: { in: ids } },
      _sum: { coins: true },
    });
    assert.equal(w._sum.coins, 60000);
  });
  test("tournament settlement is once, expired auth removed, recovery rotates key", async () => {
    const t = await db.tournament.create({
      data: {
        title: "Test",
        startsAt: new Date(0),
        endsAt: new Date(1),
        reward: 70,
        participants: { create: { userId: aid, score: 100 } },
      },
    });
    const before = await db.wallet.findUniqueOrThrow({
      where: { userId: aid },
    });
    await maintenance();
    await maintenance();
    assert.equal(
      (await db.wallet.findUniqueOrThrow({ where: { userId: aid } })).crystals,
      before.crystals + 70,
    );
    assert.equal(
      await db.walletTransaction.count({
        where: { key: `tournament:${t.id}` },
      }),
      1,
    );
    const r = await request(app).post("/api/auth/recover").send({
      nickname: "NeonAlice",
      password: "new-secure-password",
      recoveryCode: recovery,
    });
    assert.equal(r.status, 200, r.text);
    assert.notEqual(r.body.recoveryCode, recovery);
    assert.equal((await a.get("/api/me")).status, 401);
    const oldSocket = sockets.find(
      (s) => s.connected && (s.io.opts.extraHeaders as any)?.Cookie === cookieA,
    );
    if (oldSocket) await assert.rejects(emit(oldSocket, "rooms", {}));
    assert.equal(
      (
        await request(app).post("/api/auth/recover").send({
          nickname: "NeonAlice",
          password: "new-secure-password",
          recoveryCode: recovery,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await a
          .post("/api/auth/login")
          .send({ nickname: "NeonAlice", password: "new-secure-password" })
      ).status,
      200,
    );
    const beforeRestart = (await a.get("/api/me")).body.wallet.coins;
    await db.$disconnect();
    assert.equal((await a.get("/api/me")).body.wallet.coins, beforeRestart);
  });
}
