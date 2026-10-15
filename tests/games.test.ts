import { test } from "node:test";
import assert from "node:assert/strict";
import {
  start,
  act,
  publicState,
  points,
  deck,
  rng,
  pokerScore,
  commitment,
  gameNames,
} from "../server/games.js";
const seed = "test-seed-2026";
test("seed reproducibility and unbiased bounded generator", () => {
  const a = rng(seed),
    b = rng(seed);
  for (let i = 0; i < 1000; i++) {
    const x = a(37);
    assert.equal(x, b(37));
    assert.ok(x >= 0 && x < 37);
  }
  assert.equal(commitment(seed).length, 64);
  assert.equal(new Set(deck(rng(seed))).size, 52);
});
test("all 18 single-player engines start and finish with valid payouts", () => {
  for (const game of gameNames.filter(
    (g) => !["battle", "jackpot"].includes(g),
  )) {
    const out = start(game, {}, seed, 0);
    assert.ok(Number.isFinite(out.mult) && out.mult >= 0, game);
    if (!out.done) {
      let result;
      if (game === "mines")
        result = act(game, out.state, { index: out.state.mines[0] });
      else if (game === "tower")
        result = act(game, out.state, { index: out.state.bad[0] });
      else if (game === "hilo")
        result = act(game, out.state, {
          type: out.state.card % 13 === 0 ? "higher" : "lower",
        });
      else if (game === "blackjack")
        result = act(game, out.state, { type: "stand" });
      else if (game === "poker") result = act(game, out.state, { hold: [] });
      else if (game === "crash")
        result = act(game, out.state, { type: "check" }, 100000000);
      else if (game === "daily")
        result = act(game, out.state, { answer: out.state.answer }, 1000);
      else if (game === "memory") {
        let s = out.state;
        for (let c = 0; c < 6; c++) {
          const ids = s.cards
            .map((v: number, i: number) => (v === c ? i : -1))
            .filter((i: number) => i >= 0);
          for (const index of ids) {
            const o = act(game, s, { index });
            s = o.state;
            result = o;
          }
        }
      }
      assert.ok(result);
      assert.ok(Number.isFinite(result!.mult), game);
    }
  }
});
test("blackjack counts multiple aces and dealer stands on soft 17", () => {
  assert.equal(points([0, 13, 8]), 21);
  assert.equal(points([0, 5]), 17);
  const o = act(
    "blackjack",
    { player: [9, 8], dealer: [0, 5], deck: [12, 11, 10] },
    { type: "stand" },
  );
  assert.equal(o.state.dealer.length, 2);
  assert.equal(o.mult, 2);
  assert.throws(() =>
    act("blackjack", { player: [1, 2, 3] }, { type: "double" }),
  );
});
test("hidden state is never exposed during active rounds", () => {
  for (const game of [
    "mines",
    "tower",
    "crash",
    "memory",
    "daily",
    "blackjack",
    "poker",
  ] as const) {
    const out = start(game, {}, seed);
    const s = publicState(game, out.state, false);
    assert.equal(s.deck, undefined);
    assert.equal(s.mines, undefined);
    assert.equal(s.bad, undefined);
    assert.equal(s.crash, undefined);
    assert.equal(s.answer, undefined);
    if (game === "memory") assert.ok(s.cards.every((c: number) => c === -1));
    if (game === "blackjack") assert.equal(s.dealer[1], -1);
  }
});
test("mines cashout returns correct combinatorial payout; duplicate cell rejected", () => {
  const s = start("mines", { mines: 3 }, seed).state;
  const safe = Array.from({ length: 25 }, (_, i) => i).find(
    (i) => !s.mines.includes(i),
  )!;
  const opened = act("mines", s, { index: safe });
  assert.equal(opened.state.mult, Math.floor(((0.97 * 25) / 22) * 100) / 100);
  assert.throws(() => act("mines", opened.state, { index: safe }));
  const paid = act("mines", opened.state, { type: "cashout" });
  assert.equal(paid.mult, opened.state.mult);
  assert.equal(paid.done, true);
});
test("crash autocollect survives late reconnection", () => {
  const state = { crash: 5, auto: 2, startAt: 0 };
  assert.equal(act("crash", state, { type: "check" }, 100000).mult, 2);
  assert.equal(
    act("crash", { ...state, crash: 1.5 }, { type: "check" }, 100000).mult,
    0,
  );
  assert.equal(
    act("crash", { ...state, crash: 2 }, { type: "check" }, 100000).mult,
    0,
  );
});
test("draw poker hand evaluation and invalid inputs", () => {
  assert.equal(pokerScore([0, 9, 10, 11, 12]).label, "Royal flush");
  assert.equal(pokerScore([0, 13, 26, 39, 1]).mult, 25);
  assert.equal(pokerScore([0, 13, 26, 1, 14]).mult, 9);
  assert.throws(() => start("keno", { picks: [1, 1] }, seed));
  assert.throws(() => start("mines", { mines: -1 }, seed));
  assert.throws(() => start("roulette", { type: "hacked" }, seed));
});
