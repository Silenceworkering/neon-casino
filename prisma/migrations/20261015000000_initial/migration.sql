-- Initial persistent schema. All money operations additionally use serializable transactions.

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "nickname" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "recoveryHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "guest" BOOLEAN NOT NULL DEFAULT false,
  "banned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Profile" (
  "userId" TEXT NOT NULL,
  "avatar" TEXT NOT NULL DEFAULT '⚡',
  "bio" TEXT NOT NULL DEFAULT '',
  "xp" INTEGER NOT NULL DEFAULT 0,
  "prestige" INTEGER NOT NULL DEFAULT 0,
  "settings" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Wallet" (
  "userId" TEXT NOT NULL,
  "coins" INTEGER NOT NULL DEFAULT 10000,
  "crystals" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "WalletTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "coins" INTEGER NOT NULL,
  "crystals" INTEGER NOT NULL DEFAULT 0,
  "balanceAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "game" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "bet" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "state" JSONB NOT NULL,
  "commitment" TEXT NOT NULL,
  "seed" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameResult" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "payout" INTEGER NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Achievement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "target" INTEGER NOT NULL,
  "crystals" INTEGER NOT NULL,
  CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAchievement" (
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId", "achievementId")
);

CREATE TABLE "Quest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "target" INTEGER NOT NULL,
  "coins" INTEGER NOT NULL,
  CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserQuest" (
  "userId" TEXT NOT NULL,
  "questId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "claimed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "UserQuest_pkey" PRIMARY KEY ("userId", "questId", "period")
);

CREATE TABLE "CosmeticItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  CONSTRAINT "CosmeticItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Inventory" (
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "equipped" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Inventory_pkey" PRIMARY KEY ("userId", "itemId")
);

CREATE TABLE "Friendship" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "pair" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoCode" (
  "code" TEXT NOT NULL,
  "coins" INTEGER NOT NULL,
  "crystals" INTEGER NOT NULL DEFAULT 0,
  "limit" INTEGER NOT NULL,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "PromoRedemption" (
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoRedemption_pkey" PRIMARY KEY ("userId", "code")
);

CREATE TABLE "Tournament" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reward" INTEGER NOT NULL,
  "settled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TournamentParticipant" (
  "tournamentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("tournamentId", "userId")
);

CREATE TABLE "Leaderboard" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "entries" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Leaderboard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminAction" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetId" TEXT,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyReward" (
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyReward_pkey" PRIMARY KEY ("userId", "kind", "period")
);

CREATE TABLE "GameRoom" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "game" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'WAITING',
  "state" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomMember" (
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("roomId", "userId")
);

CREATE TABLE "EconomyConfig" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "daily" INTEGER NOT NULL DEFAULT 1000,
  "weekly" INTEGER NOT NULL DEFAULT 5000,
  "maxBet" INTEGER NOT NULL DEFAULT 10000,
  "minBet" INTEGER NOT NULL DEFAULT 10,
  CONSTRAINT "EconomyConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "coins" INTEGER NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistrationGuard" (
  "ipHash" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "RegistrationGuard_pkey" PRIMARY KEY ("ipHash", "day")
);

CREATE TABLE "Referral" (
  "referredId" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "rewarded" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("referredId")
);

CREATE UNIQUE INDEX "User_nickname_key" ON "User" ("nickname");

CREATE INDEX "User_createdAt_idx" ON "User" ("createdAt");

CREATE INDEX "AuthSession_userId_idx" ON "AuthSession" ("userId");

CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession" ("expiresAt");

CREATE UNIQUE INDEX "WalletTransaction_userId_key_key" ON "WalletTransaction" ("userId", "key");

CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction" ("userId", "createdAt");

CREATE UNIQUE INDEX "GameSession_userId_key_key" ON "GameSession" ("userId", "key");

CREATE INDEX "GameSession_userId_status_idx" ON "GameSession" ("userId", "status");

CREATE INDEX "GameSession_game_createdAt_idx" ON "GameSession" ("game", "createdAt");

CREATE UNIQUE INDEX "GameResult_sessionId_key" ON "GameResult" ("sessionId");

CREATE INDEX "GameResult_createdAt_idx" ON "GameResult" ("createdAt");

CREATE UNIQUE INDEX "Friendship_pair_key" ON "Friendship" ("pair");

CREATE INDEX "Friendship_receiverId_status_idx" ON "Friendship" ("receiverId", "status");

CREATE INDEX "Friendship_senderId_status_idx" ON "Friendship" ("senderId", "status");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");

CREATE INDEX "TournamentParticipant_tournamentId_score_idx" ON "TournamentParticipant" ("tournamentId", "score");

CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction" ("createdAt");

CREATE UNIQUE INDEX "GameRoom_code_key" ON "GameRoom" ("code");

CREATE INDEX "GameRoom_status_createdAt_idx" ON "GameRoom" ("status", "createdAt");

CREATE INDEX "Referral_inviterId_idx" ON "Referral" ("inviterId");

ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserQuest" ADD CONSTRAINT "UserQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserQuest" ADD CONSTRAINT "UserQuest_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CosmeticItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromoRedemption" ADD CONSTRAINT "PromoRedemption_code_fkey" FOREIGN KEY ("code") REFERENCES "PromoCode"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyReward" ADD CONSTRAINT "DailyReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_nonnegative" CHECK (coins >= 0 AND crystals >= 0);
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_bet_nonnegative" CHECK (bet >= 0);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_uses_limit" CHECK (uses >= 0 AND uses <= "limit");
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_distinct" CHECK ("senderId" <> "receiverId");
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_sender_fkey" FOREIGN KEY ("senderId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_receiver_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_owner_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referred_fkey" FOREIGN KEY ("referredId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviter_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"(id) ON DELETE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_distinct" CHECK ("referredId" <> "inviterId");
