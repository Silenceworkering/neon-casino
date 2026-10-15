import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export const achievements = [
  {
    id: "first",
    title: "Первый импульс",
    description: "Завершите первую игру",
    target: 1,
    crystals: 25,
  },
  {
    id: "ten",
    title: "В ритме неона",
    description: "Завершите 10 игр",
    target: 10,
    crystals: 50,
  },
  {
    id: "hundred",
    title: "Легенда города",
    description: "Завершите 100 игр",
    target: 100,
    crystals: 150,
  },
];
export const cosmetics = [
  {
    id: "friend-aura",
    name: "Связь неона",
    kind: "frame",
    value: "#67d6a3",
    price: 0,
  },
  {
    id: "avatar-dragon",
    name: "Кибердракон",
    kind: "avatar",
    value: "🐉",
    price: 50,
  },
  {
    id: "avatar-gem",
    name: "Кристальный дух",
    kind: "avatar",
    value: "💎",
    price: 75,
  },
  {
    id: "frame-gold",
    name: "Золотой контур",
    kind: "frame",
    value: "#f4c86a",
    price: 100,
  },
  {
    id: "frame-pink",
    name: "Неоновая аура",
    kind: "frame",
    value: "#ed63d3",
    price: 60,
  },
  {
    id: "avatar-planet",
    name: "Орбита",
    kind: "avatar",
    value: "🪐",
    price: 40,
  },
];
export async function seed(db: PrismaClient) {
  for (const a of achievements)
    await db.achievement.upsert({ where: { id: a.id }, create: a, update: {} });
  for (const item of cosmetics)
    await db.cosmeticItem.upsert({
      where: { id: item.id },
      create: item,
      update: {},
    });
  for (const q of [
    {
      id: "daily-play",
      title: "Завершите 5 игр",
      period: "daily",
      target: 5,
      coins: 750,
    },
    {
      id: "weekly-play",
      title: "Завершите 30 игр",
      period: "weekly",
      target: 30,
      coins: 4000,
    },
  ])
    await db.quest.upsert({ where: { id: q.id }, create: q, update: {} });
  await db.event.upsert({
    where: { id: "season-one" },
    create: {
      id: "season-one",
      title: "Первый свет",
      description: "Подарок участникам первого сезона NEON.",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 86400000),
      coins: 1500,
    },
    update: {},
  });
  await db.tournament.upsert({
    where: { id: "opening-week" },
    create: {
      id: "opening-week",
      title: "Неделя первого света",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 86400000),
      reward: 250,
    },
    update: {},
  });
  await db.economyConfig.upsert({
    where: { id: "main" },
    create: {},
    update: {},
  });
}
if (process.argv[1]?.endsWith("seed.ts")) {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await seed(db);
  await db.$disconnect();
}
