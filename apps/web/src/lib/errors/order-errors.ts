/**
 * Maps technical Pacifica API errors to user-friendly messages
 *
 * This utility transforms raw API errors into messages that users can understand
 * and act upon, without exposing technical details like wallet addresses or
 * internal error codes.
 */

const ERROR_MAPPINGS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /insufficient balance/i,
    message: 'Insufficient balance. Please deposit more funds or reduce your position size.',
  },
  {
    pattern: /rate limit|429/i,
    message: 'Too many requests. Please wait a moment and try again.',
  },
  {
    // Signature timeout: when wallet signing takes too long (5-10+ seconds)
    // This happens when user needs to enter wallet password
    pattern: /invalid message|message.*expired|timestamp.*expired|expired.*timestamp/i,
    message: 'Transaction expired. Signing took too long. Please try again quickly.',
  },
  {
    pattern: /invalid signature|signature.*(verification|failed)/i,
    message: 'Authentication failed. Please reconnect your wallet and try again.',
  },
  {
    pattern: /position closed|liquidat/i,
    message: 'This position has been liquidated or closed.',
  },
  {
    pattern: /invalid.*symbol/i,
    message: 'Invalid trading pair. Please select a valid market.',
  },
  {
    pattern: /invalid.*amount|size.*small/i,
    message: 'Invalid order size. Please enter a valid amount.',
  },
  {
    pattern: /invalid.*price/i,
    message: 'Invalid price. Please enter a valid price.',
  },
  {
    pattern: /MAKER_ORDER/i,
    message: 'This order can only be placed as a maker (limit) order.',
  },
  {
    pattern: /TAKER_ORDER/i,
    message: 'This order must be filled immediately as a taker order.',
  },
  {
    pattern: /size.*too.*large|exceed.*max/i,
    message: 'Order size exceeds maximum allowed. Please reduce the size.',
  },
  {
    pattern: /trading.*disabled/i,
    message: 'Trading is temporarily disabled. Please try again later.',
  },
  {
    pattern: /market.*closed/i,
    message: 'This market is currently closed.',
  },
];

/**
 * Converts a technical error message to a user-friendly message
 * @param technicalError - The raw error message from Pacifica or other services
 * @returns A user-friendly error message
 */
export function getUserFriendlyError(technicalError: string): string {
  for (const { pattern, message } of ERROR_MAPPINGS) {
    if (pattern.test(technicalError)) {
      return message;
    }
  }

  // Default message for unknown errors
  return 'Order failed. Please try again or contact support.';
}
