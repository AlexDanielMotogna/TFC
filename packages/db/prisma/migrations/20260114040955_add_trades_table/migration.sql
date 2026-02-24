-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pacifica_history_id" BIGINT NOT NULL,
    "pacifica_order_id" BIGINT,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "fee" DECIMAL(18,8) NOT NULL,
    "pnl" DECIMAL(18,8),
    "leverage" INTEGER,
    "fight_id" TEXT,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trades_pacifica_history_id_key" ON "trades"("pacifica_history_id");

-- CreateIndex
CREATE INDEX "trades_user_id_idx" ON "trades"("user_id");

-- CreateIndex
CREATE INDEX "trades_executed_at_idx" ON "trades"("executed_at");

-- CreateIndex
CREATE INDEX "trades_symbol_idx" ON "trades"("symbol");

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
