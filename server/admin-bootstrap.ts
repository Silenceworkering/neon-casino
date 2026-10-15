import { z } from "zod";
import { compare, hash as passwordHash } from "bcryptjs";
import { atomic, lockUser } from "./db.js";
import { hash, token } from "./auth.js";
const settings = z.object({
  login: z.string().regex(/^[a-zA-Zа-яА-ЯёЁ0-9_]{3,20}$/),
  password: z
    .string()
    .min(16)
    .refine((v) => Buffer.byteLength(v, "utf8") <= 72),
});
export async function bootstrapAdmin(
  config = {
    login: process.env.ADMIN_LOGIN,
    password: process.env.ADMIN_PASSWORD,
  },
) {
  if (!config.login && !config.password) return;
  const parsed = settings.safeParse(config);
  if (!parsed.success)
    throw Error(
      "Configure ADMIN_LOGIN (3–20 letters/digits/underscore) and ADMIN_PASSWORD (16+ characters, max 72 UTF-8 bytes) together.",
    );
  const { login, password } = parsed.data;
  return atomic(async (tx) => {
    let user = await tx.user.findUnique({ where: { nickname: login } });
    if (user) {
      await lockUser(tx, user.id);
      user = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (user.role !== "ADMIN" || user.guest)
        throw Error(
          "ADMIN_LOGIN belongs to a regular player. Choose a separate administrator login.",
        );
      if (await compare(password, user.passwordHash)) return user;
      const changed = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await passwordHash(password, 12),
          recoveryHash: hash(token()),
        },
      });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await tx.adminAction.create({
        data: {
          actorId: "environment-bootstrap",
          action: "rotate-admin-password",
          targetId: user.id,
          details: { source: "ADMIN_PASSWORD" },
        },
      });
      return changed;
    }
    user = await tx.user.create({
      data: {
        nickname: login,
        passwordHash: await passwordHash(password, 12),
        recoveryHash: hash(token()),
        role: "ADMIN",
        profile: { create: { avatar: "⚡" } },
        wallet: { create: { coins: 0 } },
      },
    });
    await tx.walletTransaction.create({
      data: {
        userId: user.id,
        key: "admin-bootstrap",
        coins: 0,
        balanceAfter: 0,
        reason: "Administrator wallet created",
      },
    });
    await tx.adminAction.create({
      data: {
        actorId: "environment-bootstrap",
        action: "create-admin",
        targetId: user.id,
        details: { source: "ADMIN_LOGIN" },
      },
    });
    return user;
  });
}
