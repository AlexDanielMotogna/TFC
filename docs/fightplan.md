Plan: Enforce Stake Limit on Trade Positions
Goal
Implement fair trading by limiting the total position value a user can have during a fight to the stake amount they chose. This ensures all participants trade with equal capital.

Current Behavior (Unfair)
User chooses stake (e.g., 1000 USDC)
User can open positions of any size their Pacifica account allows
Someone with more capital has unfair advantage
Stake is only used for score calculation, not as a limit
Desired Behavior (Fair)
User chooses stake (e.g., 1000 USDC)
User can only open positions up to 1000 USDC total notional value
All participants trade with equal capital
Enforced during fights only
Implementation Approach
1. Position Value Tracking
What needs to be tracked:

Current open positions and their notional values
When placing a new order, calculate if it would exceed the stake limit
Formula:


Notional Value = Price × Amount
Total Exposure = Sum of all open position notional values
Available Capital = Stake - Total Exposure
2. Validation Logic
Location: apps/web/src/app/api/orders/route.ts

Before placing order:

Check if user is in an active LIVE fight
If yes, get the fight's stake amount
Fetch current open positions from Pacifica
Calculate total notional value of open positions
Calculate notional value of new order
If (current exposure + new order) > stake → REJECT
Pseudocode:


// In POST /api/orders handler
if (userIsInLiveFight) {
  const fight = await getFightForUser(userId);
  const stake = fight.stakeUsdc;

  // Get current positions from Pacifica
  const positions = await pacifica.getPositions(accountAddress);
  const currentExposure = positions.reduce((sum, pos) => {
    return sum + (parseFloat(pos.entry_price) * Math.abs(parseFloat(pos.amount)));
  }, 0);

  // Calculate new order notional
  const orderPrice = type === 'MARKET'
    ? await getCurrentPrice(symbol)
    : parseFloat(price);
  const orderNotional = orderPrice * parseFloat(amount);

  // Check limit
  if (currentExposure + orderNotional > stake) {
    throw new BadRequestError(
      `Order would exceed stake limit of ${stake} USDC. ` +
      `Current exposure: ${currentExposure.toFixed(2)} USDC, ` +
      `Order size: ${orderNotional.toFixed(2)} USDC`
    );
  }
}
3. Edge Cases
a) Market Orders (no price specified):

Need to fetch current market price to calculate notional
Use mark price from Pacifica /api/v1/info/prices
b) Reduce-Only Orders (closing positions):

Should NOT count against limit (they reduce exposure)
Check reduce_only flag
c) Partial Fills:

Pacifica may partially fill orders
Initial validation uses full order size (conservative)
Actual fills will be smaller
d) Multiple Open Positions:

Sum notional across all symbols
Long positions: price × amount
Short positions: price × |amount| (absolute value)
e) Price Changes:

Validation uses entry price of positions (fixed)
Current PnL doesn't affect the limit
Only initial notional matters
4. Critical Files to Modify
Primary:

apps/web/src/app/api/orders/route.ts - Add validation logic in POST handler
Helper Functions Needed:


// Get current market price for a symbol
async function getCurrentPrice(symbol: string): Promise<number>

// Calculate total position exposure for an account
async function calculatePositionExposure(accountAddress: string): Promise<number>

// Get active fight for a user (if any)
async function getActiveFightForUser(userId: string): Promise<Fight | null>

// Validate order against stake limit
async function validateStakeLimit(
  userId: string,
  accountAddress: string,
  symbol: string,
  amount: string,
  price: string | undefined,
  type: 'MARKET' | 'LIMIT',
  reduceOnly: boolean
): Promise<void> // throws error if exceeds limit
Database Schema:

No changes needed - use existing Fight.stakeUsdc field
5. Implementation Steps
Step 1: Create helper functions

Add to apps/web/src/lib/server/orders.ts (new file)
getCurrentPrice()
calculatePositionExposure()
getActiveFightForUser()
validateStakeLimit()
Step 2: Integrate validation

Modify apps/web/src/app/api/orders/route.ts POST handler
Call validateStakeLimit() before sending to Pacifica
Return clear error message if validation fails
Step 3: Add error handling

Create new error type: STAKE_LIMIT_EXCEEDED
Include details: current exposure, order size, limit
Display user-friendly message in frontend
Step 4: Frontend improvements (optional)

Show available capital in trade UI
Disable order button if would exceed limit
Live validation before submission
6. Testing Plan
Test Scenarios:

Basic limit enforcement:

Stake: 1000 USDC
Open BTC position: 600 USDC notional
Try to open ETH position: 500 USDC notional
Expected: REJECTED (600 + 500 > 1000)
Successful order within limit:

Stake: 1000 USDC
Open BTC position: 600 USDC notional
Try to open ETH position: 300 USDC notional
Expected: ACCEPTED (600 + 300 < 1000)
Reduce-only orders allowed:

Stake: 1000 USDC
Open BTC position: 1000 USDC notional (maxed out)
Try to CLOSE position (reduce_only=true)
Expected: ACCEPTED (closing doesn't count)
Market order price fetching:

Stake: 1000 USDC
Place MARKET order (no price specified)
Expected: Uses current mark price for validation
No fight = no limits:

User not in any fight
Can place orders of any size
Expected: No validation applied
Multiple positions across symbols:

Stake: 1000 USDC
BTC: 400 USDC, ETH: 300 USDC, SOL: 200 USDC
Try to add AVAX: 200 USDC
Expected: REJECTED (400+300+200+200 > 1000)
7. User Experience
Error Message (when rejected):


Cannot place order: Stake limit exceeded

Your fight stake: 1,000 USDC
Current positions: 750.50 USDC
This order: 300.00 USDC
Total would be: 1,050.50 USDC

Close some positions or reduce order size.
Success Flow:

No change - order proceeds normally
User sees confirmation as usual
8. Performance Considerations
API Calls Added:

1 extra call to Pacifica /api/v1/positions per order
1 extra call to /api/v1/info/prices for market orders
Minimal latency impact (~100-200ms)
Optimization:

Could cache prices for 1 second to avoid repeated calls
Not critical for initial implementation
9. Limitations & Future Improvements
Current Limitations:

Only tracks initial position notional (not current value)
Doesn't account for leverage changes
Price slippage on market orders might cause minor over/under
Future Enhancements:

Real-time capital display in UI
Pre-validation before order submission
Historical exposure tracking
Warnings at 80% stake usage
10. Code Locations
Files to modify:

apps/web/src/app/api/orders/route.ts - Main validation logic
apps/web/src/lib/server/orders.ts (new) - Helper functions
apps/web/src/lib/server/errors.ts - Add STAKE_LIMIT_EXCEEDED error
Files to read:

apps/web/src/lib/server/pacifica.ts - Understand Pacifica API
packages/db/prisma/schema.prisma - Fight schema
Verification
After implementation:

Start server: npm run dev
Create fight with stake 1000 USDC
Join with second account
Start fight
Account A: Open BTC position 700 USDC notional
Account A: Try to open ETH position 400 USDC notional
Expected: Error "Stake limit exceeded"
Account A: Try to open ETH position 200 USDC notional
Expected: Success
Account A: Close all positions
Expected: Both closes succeed
Complexity: Medium
New validation logic: ~50 lines
Helper functions: ~100 lines
Error handling: ~20 lines
Testing: 1 hour
Total effort: 2-3 hours

User approved the plan
Perfecto! El plan está aprobado. No es difícil - son aproximadamente 2-3 horas de trabajo.

Resumen de lo que haré:

Crear funciones helper para validar el stake limit
Modificar el endpoint de órdenes para rechazar si excede el límite
Mostrar mensajes de error claros