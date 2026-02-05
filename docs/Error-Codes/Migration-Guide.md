# Error Code Migration Guide

## Overview

This guide explains how to update existing error handling to use centralized error codes aligned with Pacifica API standards.

**Current Status:** Infrastructure complete ✅
- `error-codes.ts` - 61 error codes across 11 categories
- `logger.ts` - Structured logging with in-memory storage
- `errors.ts` - Enhanced error classes with codes and tracking IDs

**Next Steps:** Gradually migrate API routes to use error codes (73 total routes)

---

## IMPORTANT: Do NOT Touch Business Logic

**✅ DO:**
- Update error throw statements to add error codes
- Change error class types (e.g., BadRequestError → ConflictError) for better HTTP semantics
- Add request context to `errorResponse()` calls

**❌ DO NOT:**
- Modify validation logic, calculations, or business rules
- Change database queries or schema
- Alter response success format
- Modify authentication/authorization logic
- Change Pacifica API integration logic

---

## Migration Pattern

### Basic Pattern

**Before (Old):**
```typescript
throw new BadRequestError('Fight not found');
```

**After (New):**
```typescript
import { ErrorCode } from '@/lib/server/error-codes';
throw new NotFoundError('Fight not found', ErrorCode.ERR_FIGHT_NOT_FOUND);
```

### With Details

**Before (Old):**
```typescript
if (!account || !symbol || !side) {
  throw new BadRequestError('account, symbol, and side are required');
}
```

**After (New):**
```typescript
import { ErrorCode } from '@/lib/server/error-codes';

if (!account || !symbol || !side) {
  throw new BadRequestError(
    'account, symbol, and side are required',
    ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS
  );
}
```

### Changing Error Classes

Some errors should use more specific HTTP status codes:

**Before (Old):**
```typescript
throw new BadRequestError('You are already in this fight'); // 400
```

**After (New):**
```typescript
import { ErrorCode } from '@/lib/server/error-codes';
import { ConflictError } from '@/lib/server/errors';

throw new ConflictError(
  'You are already in this fight',
  ErrorCode.ERR_FIGHT_USER_ALREADY_JOINED
); // 409 - more semantically correct
```

### Adding Request Context

Enhance `errorResponse()` calls with context for better logging:

**Before (Old):**
```typescript
export async function POST(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      // ... route logic ...
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

**After (New):**
```typescript
export async function POST(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      // ... route logic ...
    });
  } catch (error) {
    return errorResponse(error, {
      userId: user?.userId,
      requestPath: request.url,
      requestMethod: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
    });
  }
}
```

---

## Error Code Mapping Reference

### Authentication Errors

| Current Error | New Error Code | New Class | Notes |
|---------------|----------------|-----------|-------|
| `throw new UnauthorizedError('Missing authorization token')` | `ErrorCode.ERR_AUTH_MISSING_TOKEN` | UnauthorizedError | Keep 401 |
| `throw new UnauthorizedError('Invalid or expired token')` | `ErrorCode.ERR_AUTH_INVALID_TOKEN` | UnauthorizedError | Keep 401 |
| `throw new ForbiddenError('Admin access required')` | `ErrorCode.ERR_AUTH_ADMIN_REQUIRED` | ForbiddenError | Keep 403 |
| `throw new ForbiddenError('Your account has been banned')` | `ErrorCode.ERR_AUTH_USER_BANNED` | ForbiddenError | Keep 403 |

### Fight Errors

| Current Error | New Error Code | New Class | Notes |
|---------------|----------------|-----------|-------|
| `throw new NotFoundError('Fight not found')` | `ErrorCode.ERR_FIGHT_NOT_FOUND` | NotFoundError | Keep 404 |
| `throw new BadRequestError('Fight has already started')` | `ErrorCode.ERR_FIGHT_ALREADY_STARTED` | BadRequestError | Keep 400 |
| `throw new BadRequestError('You are already in this fight')` | `ErrorCode.ERR_FIGHT_USER_ALREADY_JOINED` | **ConflictError** | Change to 409 |
| `throw new BadRequestError('You already have an active fight')` | `ErrorCode.ERR_FIGHT_USER_HAS_ACTIVE` | **ConflictError** | Change to 409 |
| `throw new ForbiddenError('You are not a participant')` | `ErrorCode.ERR_FIGHT_NOT_PARTICIPANT` | ForbiddenError | Keep 403 |
| `throw new ForbiddenError('Only the creator can cancel')` | `ErrorCode.ERR_FIGHT_NOT_CREATOR` | ForbiddenError | Keep 403 |

### Order Errors

| Current Error | New Error Code | New Class | Notes |
|---------------|----------------|-----------|-------|
| `throw new BadRequestError('account, symbol, side required')` | `ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS` | BadRequestError | Keep 400 |
| `throw new BadRequestError('amount must be positive')` | `ErrorCode.ERR_ORDER_INVALID_AMOUNT` | BadRequestError | Keep 400 |
| `throw new BadRequestError('price is required for limit orders')` | `ErrorCode.ERR_ORDER_PRICE_REQUIRED` | BadRequestError | Keep 400 |
| `throw new StakeLimitError(...)` | `ErrorCode.ERR_ORDER_STAKE_LIMIT_EXCEEDED` | StakeLimitError | Auto-applied (422) |
| `throw new BadRequestError('Symbol blocked for this fight')` | `ErrorCode.ERR_ORDER_SYMBOL_BLOCKED` | BadRequestError | Keep 400 |

### Prize/Referral Errors

| Current Error | New Error Code | New Class | Notes |
|---------------|----------------|-----------|-------|
| `throw new NotFoundError('Prize not found')` | `ErrorCode.ERR_PRIZE_NOT_FOUND` | NotFoundError | Keep 404 |
| `throw new ForbiddenError('This prize does not belong to you')` | `ErrorCode.ERR_PRIZE_NOT_OWNED` | ForbiddenError | Keep 403 |
| `throw new BadRequestError('Prize already claimed')` | `ErrorCode.ERR_PRIZE_ALREADY_CLAIMED` | **ConflictError** | Change to 409 |
| `throw new BadRequestError('No wallet address')` | `ErrorCode.ERR_PRIZE_NO_WALLET` | BadRequestError | Keep 400 |
| `throw new BadRequestError('Total unclaimed earnings below minimum')` | `ErrorCode.ERR_REFERRAL_BELOW_MINIMUM` | BadRequestError | Keep 400 |
| `throw new BadRequestError('Payout was already initiated')` | `ErrorCode.ERR_REFERRAL_PAYOUT_PENDING` | **ConflictError** | Change to 409 (idempotent) |

### External API Errors

| Current Error | New Error Code | New Class | Notes |
|---------------|----------------|-----------|-------|
| `throw new BadRequestError('Pacifica API error: ...')` | `ErrorCode.ERR_EXTERNAL_PACIFICA_API` | **GatewayTimeoutError** or **ServiceUnavailableError** | Change to 502/504/503 |
| `throw new BadRequestError('Active Pacifica connection required')` | `ErrorCode.ERR_PACIFICA_CONNECTION_REQUIRED` | BadRequestError | Keep 400 |

---

## Updating API Routes

### Step-by-Step Process

1. **Import error codes**
   ```typescript
   import { ErrorCode } from '@/lib/server/error-codes';
   ```

2. **Import new error classes** (if changing error types)
   ```typescript
   import { ConflictError, GatewayTimeoutError } from '@/lib/server/errors';
   ```

3. **Find all `throw` statements**
   - Use IDE search: `throw new` in the file
   - Identify which error code applies

4. **Update each throw**
   - Add error code as second parameter
   - Change error class if needed (e.g., BadRequestError → ConflictError)

5. **Update errorResponse() calls**
   - Add context parameter with user ID, path, method

6. **Test the route**
   - Trigger each error scenario
   - Verify response includes `code` and `errorId`
   - Check console logs for structured output

### Example: Complete Route Migration

**File:** `apps/web/src/app/api/fights/[id]/join/route.ts`

**Before:**
```typescript
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { BadRequestError, NotFoundError, ForbiddenError, errorResponse } from '@/lib/server/errors';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await withAuth(request, async (user) => {
      const fight = await prisma.fight.findUnique({ where: { id: params.id } });

      if (!fight) {
        throw new NotFoundError('Fight not found');
      }

      if (fight.creatorId === user.userId || fight.opponentId === user.userId) {
        throw new BadRequestError('You are already in this fight');
      }

      if (fight.status !== 'WAITING') {
        throw new BadRequestError('Fight has already started or finished');
      }

      // ... business logic ...

      return { success: true, data: updatedFight };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

**After:**
```typescript
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  errorResponse,
} from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await withAuth(request, async (user) => {
      const fight = await prisma.fight.findUnique({ where: { id: params.id } });

      if (!fight) {
        throw new NotFoundError('Fight not found', ErrorCode.ERR_FIGHT_NOT_FOUND);
      }

      if (fight.creatorId === user.userId || fight.opponentId === user.userId) {
        throw new ConflictError(
          'You are already in this fight',
          ErrorCode.ERR_FIGHT_USER_ALREADY_JOINED
        );
      }

      if (fight.status !== 'WAITING') {
        throw new BadRequestError(
          'Fight has already started or finished',
          ErrorCode.ERR_FIGHT_ALREADY_STARTED
        );
      }

      // ... business logic unchanged ...

      return { success: true, data: updatedFight };
    });
  } catch (error) {
    return errorResponse(error, {
      userId: user?.userId,
      requestPath: request.url,
      requestMethod: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
    });
  }
}
```

---

## Files to Update (Priority Order)

### Priority 1: High Traffic User-Facing (10 routes)

1. [apps/web/src/app/api/fights/[id]/route.ts](../../apps/web/src/app/api/fights/[id]/route.ts) - Fight details
2. [apps/web/src/app/api/fights/[id]/join/route.ts](../../apps/web/src/app/api/fights/[id]/join/route.ts) - Join fight
3. [apps/web/src/app/api/fights/[id]/cancel/route.ts](../../apps/web/src/app/api/fights/[id]/cancel/route.ts) - Cancel fight
4. [apps/web/src/app/api/fights/route.ts](../../apps/web/src/app/api/fights/route.ts) - Create/list fights
5. [apps/web/src/app/api/orders/route.ts](../../apps/web/src/app/api/orders/route.ts) - Place orders
6. [apps/web/src/app/api/prize/claim/route.ts](../../apps/web/src/app/api/prize/claim/route.ts) - Claim prizes
7. [apps/web/src/app/api/referrals/claim/route.ts](../../apps/web/src/app/api/referrals/claim/route.ts) - Claim referral earnings
8. [apps/web/src/lib/server/auth.ts](../../apps/web/src/lib/server/auth.ts) - Auth middleware
9. [apps/web/src/app/api/positions/route.ts](../../apps/web/src/app/api/positions/route.ts) - Position management
10. [apps/web/src/app/api/pacifica/connect/route.ts](../../apps/web/src/app/api/pacifica/connect/route.ts) - Pacifica connection

### Priority 2: Admin Routes (15 routes)

All routes in `apps/web/src/app/api/admin/**/route.ts`:
- User management (ban, delete, stats)
- Fight management (admin view, forced cancel)
- Leaderboard management
- System settings

### Priority 3: Remaining Routes (48 routes)

All other API routes in `apps/web/src/app/api/`

---

## Testing After Migration

After updating error codes in a route:

### 1. Test Error Scenarios

Trigger each error condition manually or with tests:
```bash
# Example: Test fight not found
curl -X POST http://localhost:3000/api/fights/invalid-id/join \
  -H "Authorization: Bearer <token>"

# Expected response:
{
  "success": false,
  "error": "Fight not found",
  "code": "ERR_FIGHT_NOT_FOUND",
  "errorId": "550e8400-e29b-41d4-a716-446655440000",
  "statusCode": 404
}
```

### 2. Verify Response Format

Check that response includes:
- ✅ `success: false`
- ✅ `error` (message)
- ✅ `code` (ErrorCode enum value)
- ✅ `errorId` (UUID)
- ✅ `statusCode` (HTTP status)
- ✅ `details` (if applicable - e.g., StakeLimitError)

### 3. Check Console Logs

Verify structured logging in server logs:
```javascript
[ERROR] {
  errorId: '550e8400-e29b-41d4-a716-446655440000',
  code: 'ERR_FIGHT_NOT_FOUND',
  category: 'FIGHT',
  severity: 'LOW',
  message: 'Fight not found',
  userId: 'user-123',
  path: '/api/fights/invalid-id/join'
}
```

### 4. Frontend Compatibility

Ensure frontend still works (backward compatible):

**Old frontend (still works):**
```typescript
if (!response.ok) {
  const data = await response.json();
  alert(data.error); // Works - ignores code/errorId
}
```

**New frontend (enhanced):**
```typescript
if (!response.ok) {
  const data = await response.json();

  // Handle specific errors
  if (data.code === 'ERR_FIGHT_USER_ALREADY_JOINED') {
    showNotification('You are already in this fight!');
  } else if (data.code === 'ERR_ORDER_STAKE_LIMIT_EXCEEDED') {
    showExposureModal(data.details);
  } else {
    // Fallback to generic message
    alert(data.error);
  }
}
```

---

## Common Pitfalls

### ❌ DON'T: Guess Error Codes

**Wrong:**
```typescript
throw new BadRequestError('Something went wrong', ErrorCode.ERR_FIGHT_NOT_FOUND);
// ❌ Error code doesn't match the error class or message
```

**Right:**
```typescript
throw new NotFoundError('Fight not found', ErrorCode.ERR_FIGHT_NOT_FOUND);
// ✅ Error code matches the error type and message
```

### ❌ DON'T: Use Wrong Error Class

**Wrong:**
```typescript
throw new BadRequestError('You are already in this fight', ErrorCode.ERR_FIGHT_USER_ALREADY_JOINED);
// ❌ Should be ConflictError (409), not BadRequestError (400)
```

**Right:**
```typescript
throw new ConflictError('You are already in this fight', ErrorCode.ERR_FIGHT_USER_ALREADY_JOINED);
// ✅ ConflictError is semantically correct for duplicate/conflict scenarios
```

### ❌ DON'T: Modify Business Logic

**Wrong:**
```typescript
// Before migration
if (!fight || fight.status !== 'WAITING') {
  throw new BadRequestError('Fight not available');
}

// After migration - WRONG
if (!fight) {
  throw new NotFoundError('Fight not found', ErrorCode.ERR_FIGHT_NOT_FOUND);
}
if (fight.status === 'ACTIVE') { // ❌ Changed validation logic
  throw new BadRequestError('Fight already started', ErrorCode.ERR_FIGHT_ALREADY_STARTED);
}
```

**Right:**
```typescript
// After migration - CORRECT
if (!fight || fight.status !== 'WAITING') {
  // ✅ Kept original validation logic
  if (!fight) {
    throw new NotFoundError('Fight not found', ErrorCode.ERR_FIGHT_NOT_FOUND);
  } else {
    throw new BadRequestError('Fight not available', ErrorCode.ERR_FIGHT_ALREADY_STARTED);
  }
}
```

---

## Migration Checklist Per Route

Use this checklist when migrating a route:

- [ ] Import `ErrorCode` from `@/lib/server/error-codes`
- [ ] Import new error classes if needed (e.g., `ConflictError`, `GatewayTimeoutError`)
- [ ] Find all `throw new` statements in the file
- [ ] For each throw:
  - [ ] Add error code as second parameter
  - [ ] Change error class if semantically incorrect (e.g., 400 → 409)
  - [ ] Keep error message unchanged
  - [ ] Preserve all business logic
- [ ] Update `errorResponse()` call to include context
- [ ] Test all error scenarios
- [ ] Verify response format includes `code` and `errorId`
- [ ] Check console logs for structured output
- [ ] Confirm frontend still works

---

## Success Metrics

After complete migration (all 73 routes):

1. ✅ All API routes throw errors with error codes
2. ✅ All errors logged with structured format (category, severity, etc.)
3. ✅ Error responses include `code` and `errorId` fields
4. ✅ Frontend remains backward compatible
5. ✅ Console logs show structured error data
6. ✅ Error statistics available via `errorLogger.getErrorStats()`

---

## Future Enhancements

### Phase 6: Admin Panel Error Monitoring

Create `/api/admin/errors` endpoint and `/admin/errors` UI page:
- View error logs table with filtering
- Error statistics dashboard by code/category/severity
- Export logs to CSV
- Link to Sentry (when integrated)

### Phase 7: Sentry Integration

Add Sentry SDK to capture all errors with tags:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.captureException(error, {
  tags: {
    errorId: error.errorId,
    code: error.code,
    category: metadata.category,
    severity: metadata.severity,
  },
  extra: {
    userId: context.userId,
    requestPath: context.requestPath,
    details: error.details,
  },
});
```

### Phase 8: Discord Alerts for Critical Errors

Send Discord webhook for `severity: 'CRITICAL'` errors:
- Treasury insufficient funds
- Database connection failures
- System-wide issues

---

## Support

Questions or issues with migration:
- Check [error-codes.ts](../../apps/web/src/lib/server/error-codes.ts) for full error code list
- Check [errors.ts](../../apps/web/src/lib/server/errors.ts) for error class definitions
- Check [logger.ts](../../apps/web/src/lib/server/logger.ts) for logging implementation

---

**Migration Status:** Infrastructure complete, route migration in progress
**Last Updated:** 2026-02-05
