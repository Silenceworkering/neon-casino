// Explicit local-only destructive process test; never run against hosted infrastructure.
import "dotenv/config";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import pg from "pg";
const connectionString = process.env.DATABASE_URL;
assert.equal(
  new URL(connectionString).hostname,
  "127.0.0.1",
  "Local database required",
);
const c = new pg.Client({ connectionString });
await c.connect();
const { rows } = await c.query(
  'SELECT nickname FROM "User" WHERE nickname LIKE $1 ORDER BY "createdAt" DESC LIMIT 1',
  ["Browser_%"],
);
await c.end();
assert.ok(rows.length, "Run browser-qa first");
const base = "http://localhost:3001";
let child;
async function start() {
  child = spawn(process.execPath, ["dist/server.js"], {
    env: {
      ...process.env,
      PORT: "3001",
      APP_URL: base,
      NODE_ENV: "development",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base + "/api/health");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Startup timeout");
}
async function stop() {
  if (!child) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  });
}
try {
  await start();
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      nickname: rows[0].nickname,
      password: "browser-test-password-123",
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie()[0].split(";")[0];
  const headers = { "content-type": "application/json", cookie };
  const round = await fetch(base + "/api/games/start", {
    method: "POST",
    headers,
    body: JSON.stringify({
      game: "mines",
      bet: 10,
      key: crypto.randomUUID(),
      options: { mines: 3 },
    }),
  }).then((r) => r.json());
  assert.ok(round.id, JSON.stringify(round));
  const before = await fetch(base + "/api/me", { headers }).then((r) =>
    r.json(),
  );
  await stop();
  await start();
  const after = await fetch(base + "/api/me", { headers }).then((r) =>
    r.json(),
  );
  assert.deepEqual(after.wallet, before.wallet);
  const active = await fetch(base + "/api/games/active", { headers }).then(
    (r) => r.json(),
  );
  assert.ok(active.some((r) => r.id === round.id));
  await fetch(base + `/api/games/${round.id}/action`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      key: crypto.randomUUID(),
      action: { type: "forfeit" },
    }),
  });
  console.log(
    "Restart QA passed: real Node process restart preserves cookie session, wallet, and active game.",
  );
} finally {
  await stop();
}
