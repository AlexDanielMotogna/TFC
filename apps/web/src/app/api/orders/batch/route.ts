/**
 * Batch Orders endpoint
 * POST /api/orders/batch - Execute multiple order actions atomically
 *
 * Each action is individually signed. Max 10 actions per batch.
 * Actions execute in order; if one fails, subsequent actions are still attempted.
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { actions } = body;

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      throw new BadRequestError('actions array is required and must not be empty', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    if (actions.length > 10) {
      throw new BadRequestError('Batch cannot exceed 10 actions', ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
    }

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!action.type || !action.data) {
        throw new BadRequestError(`Action ${i} missing type or data`, ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
      if (action.type !== 'Create' && action.type !== 'Cancel') {
        throw new BadRequestError(`Action ${i} has invalid type: ${action.type}`, ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
      }
      if (!action.data.account || !action.data.signature || !action.data.timestamp) {
        throw new BadRequestError(`Action ${i} missing account, signature, or timestamp`, ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    }

    console.log('Sending batch to Pacifica:', {
      actionCount: actions.length,
      actionTypes: actions.map((a: { type: string }) => a.type),
    });

    const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions }),
    });

    const responseText = await response.text();
    console.log('Pacifica batch response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok || !result.success) {
      throw new ServiceUnavailableError(result.error || `Pacifica API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Batch executed successfully', {
      results: result.data?.results?.map((r: { success: boolean; order_id?: number; error?: string }, i: number) => ({
        index: i,
        success: r.success,
        order_id: r.order_id,
        error: r.error,
      })),
    });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
