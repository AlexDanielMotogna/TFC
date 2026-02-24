-- CreateEnum
CREATE TYPE "FightStatus" AS ENUM ('WAITING', 'LIVE', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "wallet_address" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacifica_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_address" TEXT NOT NULL,
    "vault_key_reference" TEXT NOT NULL,
    "builder_code_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacifica_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fights" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "stake_usdc" INTEGER NOT NULL,
    "status" "FightStatus" NOT NULL DEFAULT 'WAITING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "winner_id" TEXT,
    "is_draw" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fight_participants" (
    "id" TEXT NOT NULL,
    "fight_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "final_pnl_percent" DECIMAL(18,8),
    "final_score_usdc" DECIMAL(18,6),
    "trades_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fight_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fight_trades" (
    "id" TEXT NOT NULL,
    "fight_id" TEXT NOT NULL,
    "participant_user_id" TEXT NOT NULL,
    "pacifica_history_id" BIGINT NOT NULL,
    "pacifica_order_id" BIGINT,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "fee" DECIMAL(18,8) NOT NULL,
    "pnl" DECIMAL(18,8),
    "executed_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fight_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fight_snapshots" (
    "id" TEXT NOT NULL,
    "fight_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participant_a_user_id" TEXT NOT NULL,
    "participant_a_pnl_percent" DECIMAL(18,8) NOT NULL,
    "participant_a_score_usdc" DECIMAL(18,6) NOT NULL,
    "participant_a_trades_count" INTEGER NOT NULL,
    "participant_b_user_id" TEXT NOT NULL,
    "participant_b_pnl_percent" DECIMAL(18,8) NOT NULL,
    "participant_b_score_usdc" DECIMAL(18,6) NOT NULL,
    "participant_b_trades_count" INTEGER NOT NULL,
    "leader_id" TEXT,

    CONSTRAINT "fight_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "total_fights" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "total_pnl_usdc" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "avg_pnl_percent" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_handle_key" ON "users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "pacifica_connections_user_id_key" ON "pacifica_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pacifica_connections_account_address_key" ON "pacifica_connections"("account_address");

-- CreateIndex
CREATE INDEX "fights_status_idx" ON "fights"("status");

-- CreateIndex
CREATE INDEX "fights_created_at_idx" ON "fights"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "fight_participants_fight_id_user_id_key" ON "fight_participants"("fight_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fight_participants_fight_id_slot_key" ON "fight_participants"("fight_id", "slot");

-- CreateIndex
CREATE INDEX "fight_trades_fight_id_participant_user_id_idx" ON "fight_trades"("fight_id", "participant_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fight_trades_fight_id_pacifica_history_id_key" ON "fight_trades"("fight_id", "pacifica_history_id");

-- CreateIndex
CREATE INDEX "fight_snapshots_fight_id_timestamp_idx" ON "fight_snapshots"("fight_id", "timestamp");

-- CreateIndex
CREATE INDEX "leaderboard_snapshots_range_rank_idx" ON "leaderboard_snapshots"("range", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_snapshots_user_id_range_key" ON "leaderboard_snapshots"("user_id", "range");

-- AddForeignKey
ALTER TABLE "pacifica_connections" ADD CONSTRAINT "pacifica_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fights" ADD CONSTRAINT "fights_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fight_participants" ADD CONSTRAINT "fight_participants_fight_id_fkey" FOREIGN KEY ("fight_id") REFERENCES "fights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fight_participants" ADD CONSTRAINT "fight_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fight_trades" ADD CONSTRAINT "fight_trades_fight_id_fkey" FOREIGN KEY ("fight_id") REFERENCES "fights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fight_snapshots" ADD CONSTRAINT "fight_snapshots_fight_id_fkey" FOREIGN KEY ("fight_id") REFERENCES "fights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
