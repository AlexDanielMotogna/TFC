-- Rename legacy table: pacifica_connections → exchange_connections
-- The Prisma model was already renamed to ExchangeConnection (supports Pacifica, Hyperliquid, Lighter)
-- but the underlying table name was still "pacifica_connections" from the initial migration.

ALTER TABLE "pacifica_connections" RENAME TO "exchange_connections";

-- Rename indexes and constraints to match new table name
ALTER INDEX IF EXISTS "pacifica_connections_pkey" RENAME TO "exchange_connections_pkey";
ALTER INDEX IF EXISTS "pacifica_connections_account_address_key" RENAME TO "exchange_connections_account_address_key";
ALTER INDEX IF EXISTS "pacifica_connections_user_id_exchange_type_key" RENAME TO "exchange_connections_user_id_exchange_type_key";
ALTER INDEX IF EXISTS "pacifica_connections_user_id_idx" RENAME TO "exchange_connections_user_id_idx";
