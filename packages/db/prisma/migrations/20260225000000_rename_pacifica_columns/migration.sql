-- Rename pacifica_* columns to generic exchange_* names
ALTER TABLE "fight_trades" RENAME COLUMN "pacifica_history_id" TO "exchange_history_id";
ALTER TABLE "fight_trades" RENAME COLUMN "pacifica_order_id" TO "exchange_order_id";

ALTER TABLE "trades" RENAME COLUMN "pacifica_history_id" TO "exchange_history_id";
ALTER TABLE "trades" RENAME COLUMN "pacifica_order_id" TO "exchange_order_id";

ALTER TABLE "tfc_order_actions" RENAME COLUMN "pacifica_order_id" TO "exchange_order_id";
ALTER TABLE "tfc_order_actions" RENAME COLUMN "pacifica_history_id" TO "exchange_history_id";

-- Rename indexes that reference old column names
ALTER INDEX "fight_trades_fight_id_pacifica_history_id_key"
  RENAME TO "fight_trades_fight_id_exchange_history_id_key";

ALTER INDEX "trades_pacifica_history_id_key"
  RENAME TO "trades_exchange_history_id_key";
