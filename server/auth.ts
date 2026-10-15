import { randomBytes, createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export async function session(
  res: Response,
  userId: string,
  maxAge = 30 * 86400000,
) {
  const raw = token();
  await db.authSession.create({
    data: {
      id: hash(raw),
      userId,
      expiresAt: new Date(Date.now() + maxAge),
    },
  });
  res.cookie("neon_session", raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}
export async function userFor(raw?: string) {
  if (!raw) return null;
  const s = await db.authSession.findUnique({
    where: { id: hash(raw) },
    include: { user: true },
  });
  return s && s.expiresAt > new Date() && !s.user.banned ? s.user : null;
}
export async function auth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userFor(req.cookies?.neon_session);
    if (!user) return res.status(401).json({ error: "Войдите в аккаунт" });
    res.locals.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
export function admin(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.user.role !== "ADMIN")
    return res.status(403).json({ error: "Требуются права администратора" });
  next();
}
