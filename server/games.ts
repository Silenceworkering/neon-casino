import { createHash, createHmac, randomBytes } from "node:crypto";
export const gameNames = [
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
  "jackpot",
  "battle",
  "poker",
  "baccarat",
  "keno",
  "memory",
  "daily",
] as const;
export type Game = (typeof gameNames)[number];
export const titles: Record<Game, string> = {
  slots: "Slots",
  roulette: "Roulette",
  blackjack: "Blackjack",
  mines: "Mines",
  crash: "Crash",
  plinko: "Plinko",
  dice: "Dice",
  coinflip: "Coinflip",
  limbo: "Limbo",
  hilo: "Hi-Lo",
  tower: "Tower",
  wheel: "Fortune Wheel",
  cases: "Case Opening",
  jackpot: "Jackpot",
  battle: "Battle",
  poker: "Draw Poker",
  baccarat: "Baccarat",
  keno: "Keno",
  memory: "Memory",
  daily: "Daily Challenge",
};
export type State = Record<string, any>;
export function makeSeed() {
  return randomBytes(32).toString("hex");
}
export function commitment(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}
export function rng(seed: string) {
  let n = 0;
  return (max: number) => {
    if (!Number.isSafeInteger(max) || max < 1) throw Error("Invalid RNG bound");
    const range = 2 ** 48;
    const limit = range - (range % max);
    while (true) {
      const h = createHmac("sha256", seed).update(String(n++)).digest();
      const v = h.readUIntBE(0, 6);
      if (v < limit) return v % max;
    }
  };
}
export function shuffle<T>(list: T[], r: (n: number) => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function deck(r: (n: number) => number) {
  return shuffle(
    Array.from({ length: 52 }, (_, i) => i),
    r,
  );
}
export function rank(card: number) {
  return (card % 13) + 1;
}
export function points(cards: number[]) {
  let sum = cards.reduce((a, c) => a + Math.min(rank(c), 10), 0);
  if (cards.some((c) => rank(c) === 1) && sum + 10 <= 21) sum += 10;
  return sum;
}
export function pokerScore(cards: number[]) {
  const ranks = cards.map(rank).sort((a, b) => a - b),
    counts = Object.values(
      ranks.reduce(
        (a, v) => ((a[v] = (a[v] || 0) + 1), a),
        {} as Record<number, number>,
      ),
    ).sort((a, b) => b - a);
  const flush = cards.every(
    (c) => Math.floor(c / 13) === Math.floor(cards[0] / 13),
  );
  const straight =
    new Set(ranks).size === 5 &&
    (ranks[4] - ranks[0] === 4 || ranks.join(",") === "1,10,11,12,13");
  if (flush && straight)
    return {
      label:
        ranks.join(",") === "1,10,11,12,13" ? "Royal flush" : "Straight flush",
      mult: ranks.join(",") === "1,10,11,12,13" ? 250 : 50,
    };
  if (counts[0] === 4) return { label: "Four of a kind", mult: 25 };
  if (counts[0] === 3 && counts[1] === 2)
    return { label: "Full house", mult: 9 };
  if (flush) return { label: "Flush", mult: 6 };
  if (straight) return { label: "Straight", mult: 4 };
  if (counts[0] === 3) return { label: "Three of a kind", mult: 3 };
  if (counts[0] === 2 && counts[1] === 2)
    return { label: "Two pairs", mult: 2 };
  if (
    ranks.some(
      (v) => (v === 1 || v >= 11) && ranks.filter((x) => x === v).length === 2,
    )
  )
    return { label: "Jacks or better", mult: 1 };
  return { label: "No combination", mult: 0 };
}
export const slotThemes = [
  {
    name: "Neon Fruits",
    symbols: ["🍒", "🍋", "🍇", "🍉", "🔔", "7️⃣"],
    pay: [4, 5, 6, 8, 12, 25],
  },
  {
    name: "Cyber Fortune",
    symbols: ["⚡", "🔮", "🤖", "💜", "💎", "👑"],
    pay: [3, 5, 7, 10, 15, 30],
  },
  {
    name: "Lucky Seven",
    symbols: ["🍀", "⭐", "🧲", "🔔", "💰", "7️⃣"],
    pay: [2, 4, 6, 8, 14, 40],
  },
  {
    name: "Space Spin",
    symbols: ["🌙", "🪐", "🚀", "👽", "☄️", "🌌"],
    pay: [3, 4, 5, 9, 18, 35],
  },
  {
    name: "Golden Empire",
    symbols: ["🏺", "🪙", "🦅", "💎", "👑", "☀️"],
    pay: [2, 3, 5, 10, 20, 45],
  },
];
function integer(v: any, min: number, max: number, def: number) {
  if (v === undefined) return def;
  if (!Number.isInteger(v) || v < min || v > max)
    throw Error(`Число должно быть от ${min} до ${max}`);
  return v;
}
export function start(
  game: Game,
  opts: State,
  seed: string,
  now = Date.now(),
): { state: State; done: boolean; mult: number } {
  const r = rng(seed);
  const base = (state: State, mult: number) => ({ state, done: true, mult });
  switch (game) {
    case "slots": {
      const theme = integer(opts.theme, 0, 4, 0);
      const reels = Array.from({ length: 3 }, () => r(6));
      let mult = 0;
      if (reels[0] === reels[1] && reels[1] === reels[2])
        mult = slotThemes[theme].pay[reels[0]];
      else if (new Set(reels).size === 2) mult = 1;
      return base({ theme, reels }, mult);
    }
    case "roulette": {
      const number = r(37);
      const type = opts.type ?? "red";
      const value = integer(opts.number, 0, 36, 7);
      const red = [
        1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
      ].includes(number);
      if (
        ![
          "red",
          "black",
          "odd",
          "even",
          "low",
          "high",
          "number",
          "dozen1",
          "dozen2",
          "dozen3",
        ].includes(type)
      )
        throw Error("Вид ставки");
      const win =
        type === "number"
          ? number === value
          : number !== 0 &&
            (type === "red"
              ? red
              : type === "black"
                ? !red
                : type === "odd"
                  ? number % 2 === 1
                  : type === "even"
                    ? number % 2 === 0
                    : type === "low"
                      ? number <= 18
                      : type === "high"
                        ? number >= 19
                        : type === "dozen1"
                          ? number <= 12
                          : type === "dozen2"
                            ? number >= 13 && number <= 24
                            : number >= 25);
      return base(
        { number, red, type, selected: value },
        win ? (type === "number" ? 36 : type.startsWith("dozen") ? 3 : 2) : 0,
      );
    }
    case "dice": {
      const target = integer(opts.target, 2, 98, 50);
      const roll = r(10000) / 100;
      return base({ roll, target }, roll < target ? 99 / target : 0);
    }
    case "coinflip": {
      const side = opts.side ?? "heads";
      if (!["heads", "tails"].includes(side)) throw Error("Сторона монеты");
      const landed = r(2) ? "heads" : "tails";
      return base({ landed, side }, landed === side ? 1.96 : 0);
    }
    case "limbo": {
      const target = integer(opts.target, 2, 1000, 2);
      const value = Math.max(
        1,
        Math.floor(99 / (1 - r(1000000) / 1000000)) / 100,
      );
      return base({ value, target }, value >= target ? target : 0);
    }
    case "plinko": {
      const risk = integer(opts.risk, 0, 2, 1);
      const path = Array.from({ length: 12 }, () => r(2));
      const index = path.reduce((a, b) => a + b, 0);
      const tables = [
        [8, 4, 2, 1.5, 1.2, 1, 0.7, 1, 1.2, 1.5, 2, 4, 8],
        [25, 10, 5, 2, 1, 0.5, 0.3, 0.5, 1, 2, 5, 10, 25],
        [100, 25, 8, 3, 0.5, 0.2, 0.1, 0.2, 0.5, 3, 8, 25, 100],
      ];
      return base(
        { risk, path, index, multipliers: tables[risk] },
        tables[risk][index],
      );
    }
    case "wheel": {
      const segments = [0, 1, 0.5, 2, 0, 1, 0.5, 5, 0, 1, 0.5, 10];
      const index = r(12);
      return base({ index, segments }, segments[index]);
    }
    case "cases": {
      const ticket = r(10000);
      const items = [
        { name: "Неоновая пыль", mult: 0.2, rarity: "common" },
        { name: "Лунный осколок", mult: 0.7, rarity: "uncommon" },
        { name: "Киберкристалл", mult: 2, rarity: "rare" },
        { name: "Сердце галактики", mult: 10, rarity: "epic" },
        { name: "Корона неона", mult: 50, rarity: "legendary" },
      ];
      const index =
        ticket < 6000
          ? 0
          : ticket < 8500
            ? 1
            : ticket < 9700
              ? 2
              : ticket < 9975
                ? 3
                : 4;
      return base({ item: items[index], index }, items[index].mult);
    }
    case "baccarat": {
      const d = deck(r);
      let p = [d.pop()!, d.pop()!],
        b = [d.pop()!, d.pop()!];
      const score = (a: number[]) =>
        a.reduce((s, c) => s + (Math.min(rank(c), 10) % 10), 0) % 10;
      let ps = score(p),
        bs = score(b);
      if (ps < 8 && bs < 8) {
        let third: number | undefined;
        if (ps <= 5) {
          const c = d.pop()!;
          p.push(c);
          third = Math.min(rank(c), 10) % 10;
        }
        if (
          third === undefined
            ? bs <= 5
            : bs <= 2 ||
              (bs === 3 && third !== 8) ||
              (bs === 4 && third >= 2 && third <= 7) ||
              (bs === 5 && third >= 4 && third <= 7) ||
              (bs === 6 && third >= 6 && third <= 7)
        )
          b.push(d.pop()!);
      }
      ps = score(p);
      bs = score(b);
      const winner = ps === bs ? "tie" : ps > bs ? "player" : "banker";
      const side = opts.side ?? "player";
      if (!["player", "banker", "tie"].includes(side)) throw Error("Ставка");
      return base(
        { player: p, banker: b, ps, bs, winner, side },
        winner === side
          ? side === "tie"
            ? 9
            : side === "banker"
              ? 1.95
              : 2
          : winner === "tie" && side !== "tie"
            ? 1
            : 0,
      );
    }
    case "keno": {
      const picks = opts.picks ?? [7, 14, 21, 28, 35];
      if (
        !Array.isArray(picks) ||
        picks.length < 1 ||
        picks.length > 10 ||
        new Set(picks).size !== picks.length ||
        picks.some((n) => !Number.isInteger(n) || n < 1 || n > 40)
      )
        throw Error("Выберите 1–10 разных чисел от 1 до 40");
      const drawn = shuffle(
        Array.from({ length: 40 }, (_, i) => i + 1),
        r,
      ).slice(0, 10);
      const hits = picks.filter((n) => drawn.includes(n)).length;
      const tables: Record<number, number[]> = {
        1: [0, 3.8],
        2: [0, 1, 12],
        3: [0, 0, 3, 40],
        4: [0, 0, 1, 8, 100],
        5: [0, 0, 0, 3, 15, 300],
        6: [0, 0, 0, 1, 8, 50, 800],
        7: [0, 0, 0, 0.5, 3, 20, 100, 1500],
        8: [0, 0, 0, 0, 2, 10, 50, 250, 3000],
        9: [0, 0, 0, 0, 1, 5, 25, 100, 500, 5000],
        10: [0, 0, 0, 0, 0.5, 3, 10, 50, 200, 1000, 10000],
      };
      return base({ picks, drawn, hits }, tables[picks.length][hits]);
    }
    case "blackjack": {
      const d = deck(r),
        player = [d.pop()!, d.pop()!],
        dealer = [d.pop()!, d.pop()!];
      const natural = points(player) === 21 || points(dealer) === 21;
      return {
        state: { deck: d, player, dealer },
        done: natural,
        mult: natural
          ? points(player) === 21
            ? points(dealer) === 21
              ? 1
              : 2.5
            : 0
          : 0,
      };
    }
    case "poker": {
      const d = deck(r);
      return { state: { deck: d, hand: d.splice(0, 5) }, done: false, mult: 0 };
    }
    case "mines": {
      const count = integer(opts.mines, 1, 20, 3);
      return {
        state: {
          mines: shuffle(
            Array.from({ length: 25 }, (_, i) => i),
            r,
          ).slice(0, count),
          opened: [],
          count,
          mult: 1,
        },
        done: false,
        mult: 0,
      };
    }
    case "tower":
      return {
        state: {
          bad: Array.from({ length: 8 }, () => r(3)),
          level: 0,
          choices: [],
          mult: 1,
        },
        done: false,
        mult: 0,
      };
    case "hilo": {
      const d = deck(r);
      return {
        state: { deck: d, card: d.pop()!, cards: [], mult: 1 },
        done: false,
        mult: 0,
      };
    }
    case "crash": {
      const crash = Math.max(
        1,
        Math.floor(99 / (1 - r(1000000) / 1000000)) / 100,
      );
      return {
        state: { crash, startAt: now, auto: integer(opts.auto, 2, 100, 2) },
        done: false,
        mult: 0,
      };
    }
    case "memory": {
      const cards = shuffle(
        Array.from({ length: 12 }, (_, i) => i % 6),
        r,
      );
      return {
        state: { cards, opened: [], matched: [], moves: 0, started: now },
        done: false,
        mult: 0,
      };
    }
    case "daily": {
      const a = r(30) + 1,
        b = r(30) + 1;
      return {
        state: { a, b, answer: a + b, started: now },
        done: false,
        mult: 0,
      };
    }
    default:
      throw Error("Этот режим доступен в игровых комнатах");
  }
}
export function act(
  game: Game,
  s: State,
  action: State,
  now = Date.now(),
): { state: State; done: boolean; mult: number } {
  const state = structuredClone(s);
  let done = false,
    mult = 0;
  if (game === "blackjack") {
    if (!["hit", "stand", "double"].includes(action.type))
      throw Error("Действие");
    if (action.type === "double" && state.player.length !== 2)
      throw Error("Удвоение только первым ходом");
    if (action.type !== "stand") state.player.push(state.deck.pop());
    if (points(state.player) > 21) done = true;
    else if (action.type !== "hit" || points(state.player) === 21) {
      while (points(state.dealer) < 17) state.dealer.push(state.deck.pop());
      done = true;
      const p = points(state.player),
        d = points(state.dealer);
      mult = d > 21 || p > d ? 2 : p === d ? 1 : 0;
    }
  } else if (game === "poker") {
    const hold = action.hold ?? [];
    if (
      !Array.isArray(hold) ||
      hold.length > 5 ||
      new Set(hold).size !== hold.length ||
      hold.some((i) => !Number.isInteger(i) || i < 0 || i > 4)
    )
      throw Error("Неверный выбор карт");
    state.hand = state.hand.map((c: number, i: number) =>
      hold.includes(i) ? c : state.deck.pop(),
    );
    state.combination = pokerScore(state.hand);
    mult = state.combination.mult;
    done = true;
  } else if (game === "mines") {
    if (action.type === "cashout") {
      if (!state.opened.length) throw Error("Сначала откройте клетку");
      done = true;
      mult = state.mult;
    } else {
      const index = integer(action.index, 0, 24, -1);
      if (index < 0 || state.opened.includes(index))
        throw Error("Клетка уже открыта");
      state.opened.push(index);
      if (state.mines.includes(index)) done = true;
      else {
        const n = state.opened.length;
        let m = 0.97;
        for (let i = 0; i < n; i++) m *= (25 - i) / (25 - state.count - i);
        state.mult = Math.floor(m * 100) / 100;
        if (n === 25 - state.count) {
          done = true;
          mult = state.mult;
        }
      }
    }
  } else if (game === "tower") {
    if (action.type === "cashout") {
      if (!state.level) throw Error("Сначала пройдите этаж");
      done = true;
      mult = state.mult;
    } else {
      const i = integer(action.index, 0, 2, -1);
      if (i < 0) throw Error("Выберите дверь");
      state.choices.push(i);
      if (state.bad[state.level] === i) done = true;
      else {
        state.level++;
        state.mult = Math.floor(0.97 * 1.5 ** state.level * 100) / 100;
        if (state.level === 8) {
          done = true;
          mult = state.mult;
        }
      }
    }
  } else if (game === "hilo") {
    if (action.type === "cashout") {
      if (!state.cards.length) throw Error("Сначала угадайте карту");
      done = true;
      mult = state.mult;
    } else {
      if (!["higher", "lower"].includes(action.type))
        throw Error("Направление");
      const old = rank(state.card),
        next = state.deck.pop();
      state.cards.push(state.card);
      state.card = next;
      const win =
        action.type === "higher" ? rank(next) > old : rank(next) < old;
      const chance =
        action.type === "higher" ? (13 - old) / 13 : (old - 1) / 13;
      if (!chance) throw Error("Невозможное направление");
      if (!win) done = true;
      else {
        state.mult = Math.floor(((state.mult * 0.97) / chance) * 100) / 100;
        if (!state.deck.length) {
          done = true;
          mult = state.mult;
        }
      }
    }
  } else if (game === "crash") {
    const elapsed = Math.max(0, (now - state.startAt) / 1000);
    const current = Math.exp(elapsed * 0.16);
    const reachedAuto = current >= state.auto && state.auto < state.crash;
    if (action.type === "cashout" || action.type === "check") {
      if (reachedAuto) {
        done = true;
        mult = state.auto;
      } else if (current >= state.crash) {
        done = true;
        mult = 0;
      } else if (action.type === "cashout") {
        done = true;
        mult = Math.floor(current * 100) / 100;
      }
    } else throw Error("Действие");
  } else if (game === "memory") {
    const i = integer(action.index, 0, 11, -1);
    if (i < 0 || state.matched.includes(i) || state.opened.includes(i))
      throw Error("Выберите закрытую карту");
    if (state.opened.length === 2) state.opened = [];
    state.opened.push(i);
    if (state.opened.length === 2) {
      state.moves++;
      if (state.cards[state.opened[0]] === state.cards[state.opened[1]]) {
        state.matched.push(...state.opened);
        state.opened = [];
      }
    }
    if (state.matched.length === 12 || state.moves >= 18) {
      done = true;
      mult = state.matched.length === 12 ? 1 : 0;
      state.reward =
        state.matched.length === 12
          ? Math.max(100, 500 - state.moves * 15)
          : 50;
    }
  } else if (game === "daily") {
    if (!Number.isInteger(action.answer)) throw Error("Введите ответ");
    done = true;
    const valid = action.answer === state.answer && now - state.started < 60000;
    state.correct = valid;
    state.reward = valid ? 500 : 50;
    mult = valid ? 1 : 0;
  } else throw Error("Игра не поддерживает дополнительные действия");
  return { state, done, mult };
}
export function publicState(game: string, state: State, done: boolean) {
  const s = structuredClone(state);
  delete s.deck;
  if (!done) {
    if (game === "blackjack") s.dealer = [s.dealer[0], -1];
    if (game === "mines") delete s.mines;
    if (game === "tower") delete s.bad;
    if (game === "crash") {
      delete s.crash;
      s.current =
        Math.floor(
          Math.exp((Math.max(0, Date.now() - s.startAt) / 1000) * 0.16) * 100,
        ) / 100;
    }
    if (game === "memory")
      s.cards = s.cards.map((c: number, i: number) =>
        s.opened.includes(i) || s.matched.includes(i) ? c : -1,
      );
    if (game === "daily") delete s.answer;
  }
  return s;
}
