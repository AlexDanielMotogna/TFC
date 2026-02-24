-- AlterTable: ExchangeConnection (pacifica_connections)
-- Change from one-to-one (userId unique) to one-to-many (userId + exchangeType compound unique)
-- This allows a user to have one connection per exchange type (e.g., Pacifica + Hyperliquid)

-- Drop the old unique constraint/index on user_id alone
-- Need to drop both constraint and index because Prisma creates them as unique indexes
DROP INDEX IF EXISTS "pacifica_connections_user_id_key";
DROP INDEX IF EXISTS "pacifica_connections_account_address_key";

-- Add compound unique constraint on (user_id, exchange_type)
ALTER TABLE "pacifica_connections" ADD CONSTRAINT "pacifica_connections_user_id_exchange_type_key" UNIQUE ("user_id", "exchange_type");

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS "pacifica_connections_user_id_idx" ON "pacifica_connections"("user_id");
