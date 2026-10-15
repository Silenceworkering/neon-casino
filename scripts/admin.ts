import "dotenv/config";
import { db } from "../server/db.js";
const nickname = process.argv[2];
if (!nickname) throw Error("Usage: npm run admin -- nickname");
await db.$transaction(async (tx) => {
  const user = await tx.user.update({
    where: { nickname },
    data: { role: "ADMIN" },
  });
  await tx.adminAction.create({
    data: {
      actorId: "bootstrap-cli",
      action: "grant-admin",
      targetId: user.id,
      details: { nickname },
    },
  });
});
console.log("Administrator role granted to the specified account.");
await db.$disconnect();
