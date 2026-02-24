-- AlterTable
ALTER TABLE "fight_participants" ADD COLUMN     "external_trade_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "external_trades_detected" BOOLEAN NOT NULL DEFAULT false;
