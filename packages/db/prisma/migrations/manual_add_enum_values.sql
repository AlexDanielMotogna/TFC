-- Add CREATE_STOP and EDIT_ORDER to the OrderActionType enum
-- Safe to run multiple times: IF NOT EXISTS prevents errors if already added
ALTER TYPE "OrderActionType" ADD VALUE IF NOT EXISTS 'CREATE_STOP';
ALTER TYPE "OrderActionType" ADD VALUE IF NOT EXISTS 'EDIT_ORDER';
