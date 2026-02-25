-- AlterTable: ExchangeConnection (pacifica_connections)
-- Change from one-to-one (userId unique) to one-to-many (userId + exchangeType compound unique)
-- This allows a user to have one connection per exchange type (e.g., Pacifica + Hyperliquid)

-- Add new columns needed for multi-exchange support
ALTER TABLE "pacifica_connections" ADD COLUMN IF NOT EXISTS "exchange_type" TEXT NOT NULL DEFAULT 'pacifica';
ALTER TABLE "pacifica_connections" ADD COLUMN IF NOT EXISTS "encrypted_key_data" TEXT;
ALTER TABLE "pacifica_connections" ADD COLUMN IF NOT EXISTS "key_index" INTEGER;
ALTER TABLE "pacifica_connections" ADD COLUMN IF NOT EXISTS "agent_approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pacifica_connections" ADD COLUMN IF NOT EXISTS "builder_approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pacifica_connections" ADD COLUMN IF NOT EXISTS "api_key_registered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pacifica_connections" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "pacifica_connections" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Drop the old unique constraint/index on user_id alone
DROP INDEX IF EXISTS "pacifica_connections_user_id_key";
DROP INDEX IF EXISTS "pacifica_connections_account_address_key";

-- Add unique constraint on account_address (will be changed to compound in later migration)
CREATE UNIQUE INDEX IF NOT EXISTS "pacifica_connections_account_address_key" ON "pacifica_connections"("account_address");

-- Add compound unique constraint on (user_id, exchange_type)
ALTER TABLE "pacifica_connections" ADD CONSTRAINT "pacifica_connections_user_id_exchange_type_key" UNIQUE ("user_id", "exchange_type");

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS "pacifica_connections_user_id_idx" ON "pacifica_connections"("user_id");
