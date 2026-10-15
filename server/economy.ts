import { type Tx, credit, lockUser } from "./db.js";
import { publicState, type Game, type State } from "./games.js";
export function day() {
  return new Date().toISOString().slice(0, 10);
}
export function week() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export async function finish(
  tx: Tx,
  id: string,
  game: any,
  state: State,
  mult: number,
) {
  const payout = ["memory", "daily"].includes(game.game)
    ? state.reward
    : Math.min(1000000, Math.floor(game.bet * mult));
  await credit(tx, id, `settle:${game.id}`, payout, 0, `Игра: ${game.game}`);
  await tx.gameSession.update({
    where: { id: game.id },
    data: {
      status: "DONE",
      state,
      result: { create: { payout, details: { mult } } },
    },
  });
  await tx.profile.update({
    where: { userId: id },
    data: {
      xp: { increment: ["daily", "memory"].includes(game.game) ? 50 : 10 },
    },
  });
  const count = await tx.gameSession.count({
    where: { userId: id, status: "DONE" },
  });
  for (const a of await tx.achievement.findMany({
    where: { target: { lte: count } },
  })) {
    if (
      !(await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: id, achievementId: a.id } },
      }))
    ) {
      await tx.userAchievement.create({
        data: { userId: id, achievementId: a.id },
      });
      await credit(
        tx,
        id,
        `achievement:${a.id}`,
        0,
        a.crystals,
        `Достижение: ${a.title}`,
      );
      await tx.notification.create({
        data: {
          userId: id,
          message: `Достижение «${a.title}»: +${a.crystals} CRYSTALS`,
        },
      });
    }
  }
  for (const q of await tx.quest.findMany())
    await tx.userQuest.upsert({
      where: {
        userId_questId_period: {
          userId: id,
          questId: q.id,
          period: q.period === "daily" ? day() : week(),
        },
      },
      create: {
        userId: id,
        questId: q.id,
        period: q.period === "daily" ? day() : week(),
        progress: 1,
      },
      update: { progress: { increment: 1 } },
    });
  if (count >= 5) {
    const ref = await tx.referral.findUnique({ where: { referredId: id } });
    if (ref && !ref.rewarded) {
      await tx.referral.update({
        where: { referredId: id },
        data: { rewarded: true },
      });
      await tx.inventory.upsert({
        where: {
          userId_itemId: { userId: ref.inviterId, itemId: "friend-aura" },
        },
        create: { userId: ref.inviterId, itemId: "friend-aura" },
        update: {},
      });
      await tx.notification.create({
        data: {
          userId: ref.inviterId,
          message:
            "Ваш друг завершил 5 игр! Рамка «Связь неона» добавлена в коллекцию.",
        },
      });
    }
  }
  const tournaments = await tx.tournament.findMany({
    where: { startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
  });
  for (const t of tournaments)
    await tx.tournamentParticipant.updateMany({
      where: { userId: id, tournamentId: t.id },
      data: {
        score: { increment: ["memory", "daily"].includes(game.game) ? 50 : 10 },
      },
    });
  return payout;
}
export function present(g: any) {
  return {
    id: g.id,
    game: g.game,
    bet: g.bet,
    status: g.status,
    commitment: g.commitment,
    seed: g.status === "DONE" ? g.seed : undefined,
    state: publicState(g.game, g.state as State, g.status === "DONE"),
    result: g.result,
    createdAt: g.createdAt,
  };
}
export async function claim(
  tx: Tx,
  id: string,
  kind: string,
  period: string,
  coins: number,
  crystals = 0,
) {
  await lockUser(tx, id);
  if (
    await tx.dailyReward.findUnique({
      where: { userId_kind_period: { userId: id, kind, period } },
    })
  )
    throw Error("Награда уже получена");
  await tx.dailyReward.create({ data: { userId: id, kind, period } });
  await credit(
    tx,
    id,
    `reward:${kind}:${period}`,
    coins,
    crystals,
    `Награда: ${kind}`,
  );
  return { coins, crystals };
}
