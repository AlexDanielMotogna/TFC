-- CreateEnum
CREATE TYPE "PrizeStatus" AS ENUM ('PENDING', 'EARNED', 'DISTRIBUTED');

-- CreateTable
CREATE TABLE "weekly_prize_pools" (
    "id" TEXT NOT NULL,
    "week_start_date" TIMESTAMP(3) NOT NULL,
    "week_end_date" TIMESTAMP(3) NOT NULL,
    "total_fees_collected" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "total_prize_pool" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "is_finalized" BOOLEAN NOT NULL DEFAULT false,
    "is_distributed" BOOLEAN NOT NULL DEFAULT false,
    "finalized_at" TIMESTAMP(3),
    "distributed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_prize_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_prizes" (
    "id" TEXT NOT NULL,
    "prize_pool_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "prize_percentage" DECIMAL(5,2) NOT NULL,
    "prize_amount" DECIMAL(18,6) NOT NULL,
    "total_pnl_usdc" DECIMAL(18,6) NOT NULL,
    "total_fights" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "user_handle" TEXT NOT NULL,
    "status" "PrizeStatus" NOT NULL DEFAULT 'PENDING',
    "distributed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_prizes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_prize_pools_is_finalized_is_distributed_idx" ON "weekly_prize_pools"("is_finalized", "is_distributed");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_prize_pools_week_start_date_key" ON "weekly_prize_pools"("week_start_date");

-- CreateIndex
CREATE INDEX "weekly_prizes_user_id_idx" ON "weekly_prizes"("user_id");

-- CreateIndex
CREATE INDEX "weekly_prizes_status_idx" ON "weekly_prizes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_prizes_prize_pool_id_rank_key" ON "weekly_prizes"("prize_pool_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_prizes_prize_pool_id_user_id_key" ON "weekly_prizes"("prize_pool_id", "user_id");

-- AddForeignKey
ALTER TABLE "weekly_prizes" ADD CONSTRAINT "weekly_prizes_prize_pool_id_fkey" FOREIGN KEY ("prize_pool_id") REFERENCES "weekly_prize_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
