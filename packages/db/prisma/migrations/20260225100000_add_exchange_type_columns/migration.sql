-- Add exchange_type column to trades and fight_trades (defaults to 'pacifica' for existing rows)
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "exchange_type" TEXT NOT NULL DEFAULT 'pacifica';
ALTER TABLE "fight_trades" ADD COLUMN IF NOT EXISTS "exchange_type" TEXT NOT NULL DEFAULT 'pacifica';

-- Add exchange_type and signer_address to tfc_order_actions
ALTER TABLE "tfc_order_actions" ADD COLUMN IF NOT EXISTS "exchange_type" TEXT;
ALTER TABLE "tfc_order_actions" ADD COLUMN IF NOT EXISTS "signer_address" TEXT;
