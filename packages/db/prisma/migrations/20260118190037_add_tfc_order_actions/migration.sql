-- CreateEnum
CREATE TYPE "OrderActionType" AS ENUM ('MARKET_ORDER', 'LIMIT_ORDER', 'CANCEL_ORDER', 'CANCEL_ALL', 'SET_TPSL', 'CANCEL_STOP', 'ORDER_FILLED', 'ORDER_PARTIAL');

-- CreateTable
CREATE TABLE "tfc_order_actions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "action_type" "OrderActionType" NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT,
    "order_type" TEXT,
    "amount" DECIMAL(18,8),
    "price" DECIMAL(18,8),
    "take_profit" DECIMAL(18,8),
    "stop_loss" DECIMAL(18,8),
    "pacifica_order_id" BIGINT,
    "pacifica_history_id" BIGINT,
    "filled_amount" DECIMAL(18,8),
    "filled_price" DECIMAL(18,8),
    "fee" DECIMAL(18,8),
    "pnl" DECIMAL(18,8),
    "leverage" INTEGER,
    "fight_id" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tfc_order_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tfc_order_actions_user_id_idx" ON "tfc_order_actions"("user_id");

-- CreateIndex
CREATE INDEX "tfc_order_actions_wallet_address_idx" ON "tfc_order_actions"("wallet_address");

-- CreateIndex
CREATE INDEX "tfc_order_actions_created_at_idx" ON "tfc_order_actions"("created_at");

-- CreateIndex
CREATE INDEX "tfc_order_actions_action_type_idx" ON "tfc_order_actions"("action_type");

-- CreateIndex
CREATE INDEX "tfc_order_actions_symbol_idx" ON "tfc_order_actions"("symbol");
