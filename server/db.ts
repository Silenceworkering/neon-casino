import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
export type Tx = Prisma.TransactionClient;
export async function atomic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let i = 0; i < 5; i++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (e: any) {
      if (e.code === "P2034" && i < 4) continue;
      throw e;
    }
  }
  throw Error("Транзакция не завершена");
}
export async function lockUser(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
}
export async function credit(
  tx: Tx,
  id: string,
  key: string,
  coins: number,
  crystals: number,
  reason: string,
) {
  if (!Number.isSafeInteger(coins) || !Number.isSafeInteger(crystals))
    throw Error("Некорректная сумма");
  const old = await tx.walletTransaction.findUnique({
    where: { userId_key: { userId: id, key } },
  });
  if (old) return old;
  const changed = await tx.wallet.updateMany({
    where: {
      userId: id,
      coins: { gte: Math.max(0, -coins) },
      crystals: { gte: Math.max(0, -crystals) },
    },
    data: { coins: { increment: coins }, crystals: { increment: crystals } },
  });
  if (!changed.count) throw Error("Недостаточно валюты");
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: id } });
  if (wallet.coins > 2000000000 || wallet.crystals > 2000000000)
    throw Error("Достигнут предел кошелька");
  return tx.walletTransaction.create({
    data: {
      userId: id,
      key,
      coins,
      crystals,
      balanceAfter: wallet.coins,
      reason,
    },
  });
}
