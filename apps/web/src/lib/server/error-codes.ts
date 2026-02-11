/**
 * Centralized Error Codes for TradeFightClub API
 * Aligned with Pacifica API error standards
 *
 * Format: ERR_<DOMAIN>_<ISSUE>
 * Domains: AUTH, FIGHT, ORDER, POSITION, PRIZE, REFERRAL, VALIDATION, EXTERNAL, INTERNAL, USER, PACIFICA
 *
 * Pacifica API Standards:
 * - REST API codes: 400, 403, 404, 409, 422, 429, 500, 503, 504
 * - Business Logic Errors (422): ACCOUNT_NOT_FOUND, INSUFFICIENT_BALANCE, etc.
 * - WebSocket codes: 200, 400, 401, 402, 403, 420, 429, 500
 */

export enum ErrorCode {
  // ==================== AUTH (Authentication/Authorization) ====================
  ERR_AUTH_MISSING_TOKEN = 'ERR_AUTH_MISSING_TOKEN', // 401
  ERR_AUTH_INVALID_TOKEN = 'ERR_AUTH_INVALID_TOKEN', // 401
  ERR_AUTH_EXPIRED_TOKEN = 'ERR_AUTH_EXPIRED_TOKEN', // 401
  ERR_AUTH_UNAUTHORIZED = 'ERR_AUTH_UNAUTHORIZED', // 401
  ERR_AUTH_FORBIDDEN = 'ERR_AUTH_FORBIDDEN', // 403
  ERR_AUTH_USER_BANNED = 'ERR_AUTH_USER_BANNED', // 403
  ERR_AUTH_USER_DELETED = 'ERR_AUTH_USER_DELETED', // 403
  ERR_AUTH_ADMIN_REQUIRED = 'ERR_AUTH_ADMIN_REQUIRED', // 403
  ERR_AUTH_SIGNATURE_INVALID = 'ERR_AUTH_SIGNATURE_INVALID', // 401 (Pacifica WS: 401)

  // ==================== FIGHT (Fight Management) ====================
  ERR_FIGHT_NOT_FOUND = 'ERR_FIGHT_NOT_FOUND', // 404
  ERR_FIGHT_ALREADY_STARTED = 'ERR_FIGHT_ALREADY_STARTED', // 400
  ERR_FIGHT_ALREADY_FINISHED = 'ERR_FIGHT_ALREADY_FINISHED', // 400
  ERR_FIGHT_USER_ALREADY_JOINED = 'ERR_FIGHT_USER_ALREADY_JOINED', // 409 (Conflict)
  ERR_FIGHT_USER_HAS_ACTIVE = 'ERR_FIGHT_USER_HAS_ACTIVE', // 409 (MVP-1: 1 fight at a time)
  ERR_FIGHT_FULL = 'ERR_FIGHT_FULL', // 400
  ERR_FIGHT_CANNOT_MATCH_OPPONENT = 'ERR_FIGHT_CANNOT_MATCH_OPPONENT', // 400 (anti-cheat)
  ERR_FIGHT_CANNOT_CANCEL = 'ERR_FIGHT_CANNOT_CANCEL', // 400
  ERR_FIGHT_NOT_PARTICIPANT = 'ERR_FIGHT_NOT_PARTICIPANT', // 403
  ERR_FIGHT_NOT_CREATOR = 'ERR_FIGHT_NOT_CREATOR', // 403
  ERR_FIGHT_INVALID_STATUS = 'ERR_FIGHT_INVALID_STATUS', // 400

  // ==================== ORDER (Trading/Orders) ====================
  ERR_ORDER_MISSING_REQUIRED_FIELDS = 'ERR_ORDER_MISSING_REQUIRED_FIELDS', // 400
  ERR_ORDER_INVALID_AMOUNT = 'ERR_ORDER_INVALID_AMOUNT', // 400
  ERR_ORDER_INVALID_PRICE = 'ERR_ORDER_INVALID_PRICE', // 400
  ERR_ORDER_INVALID_SIDE = 'ERR_ORDER_INVALID_SIDE', // 400
  ERR_ORDER_PRICE_REQUIRED = 'ERR_ORDER_PRICE_REQUIRED', // 400 (limit orders)
  ERR_ORDER_STAKE_LIMIT_EXCEEDED = 'ERR_ORDER_STAKE_LIMIT_EXCEEDED', // 422 (Business Logic - Pacifica alignment)
  ERR_ORDER_SYMBOL_BLOCKED = 'ERR_ORDER_SYMBOL_BLOCKED', // 400 (pre-fight position)
  ERR_ORDER_TRADING_DISABLED = 'ERR_ORDER_TRADING_DISABLED', // 503
  ERR_ORDER_NOT_FOUND = 'ERR_ORDER_NOT_FOUND', // 404

  // ==================== POSITION (Position Management) ====================
  ERR_POSITION_NOT_FOUND = 'ERR_POSITION_NOT_FOUND', // 404 (Pacifica: POSITION_NOT_FOUND)
  ERR_POSITION_INSUFFICIENT_BALANCE = 'ERR_POSITION_INSUFFICIENT_BALANCE', // 422 (Pacifica: INSUFFICIENT_BALANCE)

  // ==================== PRIZE (Prize/Rewards) ====================
  ERR_PRIZE_NOT_FOUND = 'ERR_PRIZE_NOT_FOUND', // 404
  ERR_PRIZE_NOT_OWNED = 'ERR_PRIZE_NOT_OWNED', // 403
  ERR_PRIZE_ALREADY_CLAIMED = 'ERR_PRIZE_ALREADY_CLAIMED', // 409 (Conflict)
  ERR_PRIZE_ALREADY_DISTRIBUTED = 'ERR_PRIZE_ALREADY_DISTRIBUTED', // 409
  ERR_PRIZE_NOT_FINALIZED = 'ERR_PRIZE_NOT_FINALIZED', // 400
  ERR_PRIZE_NOT_AVAILABLE = 'ERR_PRIZE_NOT_AVAILABLE', // 400
  ERR_PRIZE_NO_WALLET = 'ERR_PRIZE_NO_WALLET', // 400
  ERR_PRIZE_TREASURY_INSUFFICIENT = 'ERR_PRIZE_TREASURY_INSUFFICIENT', // 503
  ERR_PRIZE_TRANSFER_FAILED = 'ERR_PRIZE_TRANSFER_FAILED', // 503

  // ==================== REFERRAL (Referral/Payouts) ====================
  ERR_REFERRAL_NO_EARNINGS = 'ERR_REFERRAL_NO_EARNINGS', // 400
  ERR_REFERRAL_BELOW_MINIMUM = 'ERR_REFERRAL_BELOW_MINIMUM', // 400
  ERR_REFERRAL_PAYOUT_PENDING = 'ERR_REFERRAL_PAYOUT_PENDING', // 409 (already processing)
  ERR_REFERRAL_NO_WALLET = 'ERR_REFERRAL_NO_WALLET', // 400
  ERR_REFERRAL_TREASURY_INSUFFICIENT = 'ERR_REFERRAL_TREASURY_INSUFFICIENT', // 503

  // ==================== VALIDATION (Input Validation) ====================
  ERR_VALIDATION_MISSING_FIELD = 'ERR_VALIDATION_MISSING_FIELD', // 400
  ERR_VALIDATION_INVALID_FORMAT = 'ERR_VALIDATION_INVALID_FORMAT', // 400
  ERR_VALIDATION_INVALID_DATE = 'ERR_VALIDATION_INVALID_DATE', // 400
  ERR_VALIDATION_START_AFTER_END = 'ERR_VALIDATION_START_AFTER_END', // 400
  ERR_VALIDATION_INVALID_PARAMETER = 'ERR_VALIDATION_INVALID_PARAMETER', // 400

  // ==================== EXTERNAL (External API Failures) ====================
  ERR_EXTERNAL_PACIFICA_API = 'ERR_EXTERNAL_PACIFICA_API', // 502 (Bad Gateway)
  ERR_EXTERNAL_PACIFICA_TIMEOUT = 'ERR_EXTERNAL_PACIFICA_TIMEOUT', // 504 (Gateway Timeout)
  ERR_EXTERNAL_PACIFICA_RATE_LIMIT = 'ERR_EXTERNAL_PACIFICA_RATE_LIMIT', // 429 (Pacifica WS: 429)
  ERR_EXTERNAL_PACIFICA_UNAUTHORIZED = 'ERR_EXTERNAL_PACIFICA_UNAUTHORIZED', // 403

  // ==================== INTERNAL (System/Database Errors) ====================
  ERR_INTERNAL_DATABASE = 'ERR_INTERNAL_DATABASE', // 500
  ERR_INTERNAL_UNKNOWN = 'ERR_INTERNAL_UNKNOWN', // 500
  ERR_INTERNAL_TRANSACTION_FAILED = 'ERR_INTERNAL_TRANSACTION_FAILED', // 500
  ERR_INTERNAL_CONCURRENT_CLAIM = 'ERR_INTERNAL_CONCURRENT_CLAIM', // 409 (Serialization failure)

  // ==================== USER (User Management) ====================
  ERR_USER_NOT_FOUND = 'ERR_USER_NOT_FOUND', // 404
  ERR_USER_ACCOUNT_NOT_FOUND = 'ERR_USER_ACCOUNT_NOT_FOUND', // 404 (Pacifica: ACCOUNT_NOT_FOUND)
  ERR_USER_CANNOT_BAN_ADMIN = 'ERR_USER_CANNOT_BAN_ADMIN', // 400
  ERR_USER_CANNOT_BAN_SELF = 'ERR_USER_CANNOT_BAN_SELF', // 400

  // ==================== PACIFICA (Pacifica Connection) ====================
  ERR_PACIFICA_CONNECTION_REQUIRED = 'ERR_PACIFICA_CONNECTION_REQUIRED', // 400
  ERR_PACIFICA_CONNECTION_NOT_FOUND = 'ERR_PACIFICA_CONNECTION_NOT_FOUND', // 404 (Pacifica: BOOK_NOT_FOUND equivalent)
  ERR_PACIFICA_FEATURE_DISABLED = 'ERR_PACIFICA_FEATURE_DISABLED', // 503
}

/**
 * Error Code Metadata
 * Maps error codes to HTTP status codes and categories
 */
export const ErrorCodeMetadata: Record<
  ErrorCode,
  {
    statusCode: number;
    category: 'AUTH' | 'FIGHT' | 'ORDER' | 'POSITION' | 'PRIZE' | 'REFERRAL' | 'VALIDATION' | 'EXTERNAL' | 'INTERNAL' | 'USER' | 'PACIFICA';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    userFacing: boolean; // true = user error, false = system error
  }
> = {
  // AUTH errors
  [ErrorCode.ERR_AUTH_MISSING_TOKEN]: { statusCode: 401, category: 'AUTH', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_AUTH_INVALID_TOKEN]: { statusCode: 401, category: 'AUTH', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_AUTH_EXPIRED_TOKEN]: { statusCode: 401, category: 'AUTH', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_AUTH_UNAUTHORIZED]: { statusCode: 401, category: 'AUTH', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_AUTH_FORBIDDEN]: { statusCode: 403, category: 'AUTH', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_AUTH_USER_BANNED]: { statusCode: 403, category: 'AUTH', severity: 'HIGH', userFacing: true },
  [ErrorCode.ERR_AUTH_USER_DELETED]: { statusCode: 403, category: 'AUTH', severity: 'HIGH', userFacing: true },
  [ErrorCode.ERR_AUTH_ADMIN_REQUIRED]: { statusCode: 403, category: 'AUTH', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_AUTH_SIGNATURE_INVALID]: { statusCode: 401, category: 'AUTH', severity: 'MEDIUM', userFacing: true },

  // FIGHT errors
  [ErrorCode.ERR_FIGHT_NOT_FOUND]: { statusCode: 404, category: 'FIGHT', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_FIGHT_ALREADY_STARTED]: { statusCode: 400, category: 'FIGHT', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_FIGHT_ALREADY_FINISHED]: { statusCode: 400, category: 'FIGHT', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_FIGHT_USER_ALREADY_JOINED]: { statusCode: 409, category: 'FIGHT', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_FIGHT_USER_HAS_ACTIVE]: { statusCode: 409, category: 'FIGHT', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_FIGHT_FULL]: { statusCode: 400, category: 'FIGHT', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_FIGHT_CANNOT_MATCH_OPPONENT]: { statusCode: 400, category: 'FIGHT', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_FIGHT_CANNOT_CANCEL]: { statusCode: 400, category: 'FIGHT', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_FIGHT_NOT_PARTICIPANT]: { statusCode: 403, category: 'FIGHT', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_FIGHT_NOT_CREATOR]: { statusCode: 403, category: 'FIGHT', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_FIGHT_INVALID_STATUS]: { statusCode: 400, category: 'FIGHT', severity: 'LOW', userFacing: true },

  // ORDER errors
  [ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS]: { statusCode: 400, category: 'ORDER', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_ORDER_INVALID_AMOUNT]: { statusCode: 400, category: 'ORDER', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_ORDER_INVALID_PRICE]: { statusCode: 400, category: 'ORDER', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_ORDER_INVALID_SIDE]: { statusCode: 400, category: 'ORDER', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_ORDER_PRICE_REQUIRED]: { statusCode: 400, category: 'ORDER', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_ORDER_STAKE_LIMIT_EXCEEDED]: { statusCode: 422, category: 'ORDER', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_ORDER_SYMBOL_BLOCKED]: { statusCode: 400, category: 'ORDER', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_ORDER_TRADING_DISABLED]: { statusCode: 503, category: 'ORDER', severity: 'HIGH', userFacing: false },
  [ErrorCode.ERR_ORDER_NOT_FOUND]: { statusCode: 404, category: 'ORDER', severity: 'LOW', userFacing: true },

  // POSITION errors
  [ErrorCode.ERR_POSITION_NOT_FOUND]: { statusCode: 404, category: 'POSITION', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_POSITION_INSUFFICIENT_BALANCE]: { statusCode: 422, category: 'POSITION', severity: 'MEDIUM', userFacing: true },

  // PRIZE errors
  [ErrorCode.ERR_PRIZE_NOT_FOUND]: { statusCode: 404, category: 'PRIZE', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_PRIZE_NOT_OWNED]: { statusCode: 403, category: 'PRIZE', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_PRIZE_ALREADY_CLAIMED]: { statusCode: 409, category: 'PRIZE', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_PRIZE_ALREADY_DISTRIBUTED]: { statusCode: 409, category: 'PRIZE', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_PRIZE_NOT_FINALIZED]: { statusCode: 400, category: 'PRIZE', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_PRIZE_NOT_AVAILABLE]: { statusCode: 400, category: 'PRIZE', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_PRIZE_NO_WALLET]: { statusCode: 400, category: 'PRIZE', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_PRIZE_TREASURY_INSUFFICIENT]: { statusCode: 503, category: 'PRIZE', severity: 'CRITICAL', userFacing: false },
  [ErrorCode.ERR_PRIZE_TRANSFER_FAILED]: { statusCode: 503, category: 'PRIZE', severity: 'CRITICAL', userFacing: false },

  // REFERRAL errors
  [ErrorCode.ERR_REFERRAL_NO_EARNINGS]: { statusCode: 400, category: 'REFERRAL', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_REFERRAL_BELOW_MINIMUM]: { statusCode: 400, category: 'REFERRAL', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_REFERRAL_PAYOUT_PENDING]: { statusCode: 409, category: 'REFERRAL', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_REFERRAL_NO_WALLET]: { statusCode: 400, category: 'REFERRAL', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_REFERRAL_TREASURY_INSUFFICIENT]: { statusCode: 503, category: 'REFERRAL', severity: 'CRITICAL', userFacing: false },

  // VALIDATION errors
  [ErrorCode.ERR_VALIDATION_MISSING_FIELD]: { statusCode: 400, category: 'VALIDATION', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_VALIDATION_INVALID_FORMAT]: { statusCode: 400, category: 'VALIDATION', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_VALIDATION_INVALID_DATE]: { statusCode: 400, category: 'VALIDATION', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_VALIDATION_START_AFTER_END]: { statusCode: 400, category: 'VALIDATION', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_VALIDATION_INVALID_PARAMETER]: { statusCode: 400, category: 'VALIDATION', severity: 'LOW', userFacing: true },

  // EXTERNAL errors
  [ErrorCode.ERR_EXTERNAL_PACIFICA_API]: { statusCode: 502, category: 'EXTERNAL', severity: 'HIGH', userFacing: false },
  [ErrorCode.ERR_EXTERNAL_PACIFICA_TIMEOUT]: { statusCode: 504, category: 'EXTERNAL', severity: 'HIGH', userFacing: false },
  [ErrorCode.ERR_EXTERNAL_PACIFICA_RATE_LIMIT]: { statusCode: 429, category: 'EXTERNAL', severity: 'MEDIUM', userFacing: false },
  [ErrorCode.ERR_EXTERNAL_PACIFICA_UNAUTHORIZED]: { statusCode: 403, category: 'EXTERNAL', severity: 'HIGH', userFacing: false },

  // INTERNAL errors
  [ErrorCode.ERR_INTERNAL_DATABASE]: { statusCode: 500, category: 'INTERNAL', severity: 'CRITICAL', userFacing: false },
  [ErrorCode.ERR_INTERNAL_UNKNOWN]: { statusCode: 500, category: 'INTERNAL', severity: 'CRITICAL', userFacing: false },
  [ErrorCode.ERR_INTERNAL_TRANSACTION_FAILED]: { statusCode: 500, category: 'INTERNAL', severity: 'CRITICAL', userFacing: false },
  [ErrorCode.ERR_INTERNAL_CONCURRENT_CLAIM]: { statusCode: 409, category: 'INTERNAL', severity: 'MEDIUM', userFacing: false },

  // USER errors
  [ErrorCode.ERR_USER_NOT_FOUND]: { statusCode: 404, category: 'USER', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_USER_ACCOUNT_NOT_FOUND]: { statusCode: 404, category: 'USER', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_USER_CANNOT_BAN_ADMIN]: { statusCode: 400, category: 'USER', severity: 'LOW', userFacing: true },
  [ErrorCode.ERR_USER_CANNOT_BAN_SELF]: { statusCode: 400, category: 'USER', severity: 'LOW', userFacing: true },

  // PACIFICA errors
  [ErrorCode.ERR_PACIFICA_CONNECTION_REQUIRED]: { statusCode: 400, category: 'PACIFICA', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_PACIFICA_CONNECTION_NOT_FOUND]: { statusCode: 404, category: 'PACIFICA', severity: 'MEDIUM', userFacing: true },
  [ErrorCode.ERR_PACIFICA_FEATURE_DISABLED]: { statusCode: 503, category: 'PACIFICA', severity: 'HIGH', userFacing: false },
};
