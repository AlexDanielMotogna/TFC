Builder Program
Pacifica's builder program allows third-party developers (“builders”) to earn fees for orders they send on behalf of the users. These must be approved by the user before they can be used on any order. Once approved, the builder may include the code in any supported order creation request. Users can revoke access at any time.

Builder codes affect only Pacifica’s order fee logic and are fully verified by the API according to user approval, fee limits, and builder configuration.

We’re setting aside up to a total of 10,000,000 points over the next three months to reward teams building on Pacifica with Builder Program (December 11th, 2025 → March 11th, 2026).

Builder Program Rewards will be distributed based on each team’s contribution to Pacifica’s growth. To ensure fairness and meaningful impact within the ecosystem, an evaluation process will be conducted. Only teams that make significant contributions to Pacifica’s development will be eligible to receive point rewards.

Step 1: Request User Authorization
Request the user to authorize placing orders with your builder code by prompting them to sign an approval request containing your builder code as builder_code and the additional fee rate you want to charge as max_fee_rate.

Important: The user's max_fee_rate must be greater than or equal to your builder's fee_rate. If they set a lower value, orders will be rejected.

Data to be Signed

To approve a builder code, the user signs:

Copy
{
"timestamp": <ms>,
"expiry_window": 5000,
"type": "approve_builder_code",
"data": {
"builder_code": "YOUR_CODE",
"max_fee_rate": "0.001"
}
}
After following the signing implementation, compact and sort this payload recursively to generate the signature.

Complete Payload (After Signing)

Copy
{
"account": "6ETn....",
"agent_wallet": null,
"signature": "5j1Vy9UqYUF2jKD9r2Lv5AoMWHJuW5a1mqVzEhC9SJL5GqbPkGEQKpW3UZmKXr4UWrHMJ5xHQFMJkZWE8J5VyA",
"timestamp": 1748970123456,
"expiry_window": 5000,
"builder_code": "YOUR_CODE",
"max_fee_rate": "0.001"
}
Endpoint: POST https://api.pacifica.fi/api/v1/account/builder_codes/approve

Check User Approvals (Optional)

You can query which builder codes a user has approved:

Endpoint: GET https://api.pacifica.fi/api/v1/account/builder_codes/approvals?account=6ETn....

Response:

Copy
[
{
"builder_code": "YOUR_CODE",
"description": "Test Builder Integration",
"max_fee_rate": "0.001",
"updated_at": 1748970123456
}
]
Revoke Builder Code Authorization (Optional)

Users can revoke authorization at any time:

Data to be Signed

Copy
{
"timestamp": 1748970123456,
"expiry_window": 5000,
"type": "revoke_builder_code",
"data": {
"builder_code": "YOUR_CODE"
}
}
Complete Payload (After Signing)

Copy
{
"account": "6ETnufiec2CxVWTS4u5Wiq33Zh5Y3Qm6Pkdpi375fuxP",
"agent_wallet": null,
"signature": "5j1Vy9UqYUF2jKD9r2Lv5AoMWHJuW5a1mqVzEhC9SJL5GqbPkGEQKpW3UZmKXr4UWrHMJ5xHQFMJkZWE8J5VyA",
"timestamp": 1748970123456,
"expiry_window": 5000,
"builder_code": "YOUR_CODE"
}
Endpoint: POST https://api.pacifica.fi/api/v1/account/builder_codes/revoke

Step 2: Include Builder Code in Order Creation Requests
All order creation requests may now include your builder code in the builder_code parameter. Update the following endpoints:

REST API:

POST /api/v1/orders/create_market

POST /api/v1/orders/create

POST /api/v1/orders/stop/create

POST /api/v1/positions/tpsl

WebSocket:

create_market_order

create_limit_order

create_stop_order

set_position_tpsl

Example: Create Market Order with Builder Code

Data to be Signed

Copy
{
"timestamp": 1716200000000,
"expiry_window": 30000,
"type": "create_market_order",
"data": {
"symbol": "BTC",
"amount": "0.1",
"side": "bid",
"slippage_percent": "0.5",
"reduce_only": false,
"client_order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
"builder_code": "YOUR_CODE"
}
}
Complete Payload (After Signing)

Copy
{
"account": "6ETnufiec2CxVWTS4u5Wiq33Zh5Y3Qm6Pkdpi375fuxP",
"agent_wallet": null,
"signature": "5j1Vy9UqYUF2jKD9r2Lv5AoMWHJuW5a1mqVzEhC9SJL5GqbPkGEQKpW3UZmKXr4UWrHMJ5xHQFMJkZWE8J5VyA",
"timestamp": 1716200000000,
"expiry_window": 30000,
"symbol": "BTC",
"amount": "0.1",
"side": "bid",
"slippage_percent": "0.5",
"reduce_only": false,
"client_order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
"builder_code": "YOUR_CODE"
}
Endpoint: POST https://api.pacifica.fi/api/v1/orders/create_market

Example: Create Limit Order with Builder Code

Data to be Signed

Copy
{
"timestamp": 1716200000000,
"expiry_window": 30000,
"type": "create_order",
"data": {
"symbol": "BTC",
"amount": "0.1",
"side": "bid",
"tick_level": 1000,
"tif": "gtc",
"reduce_only": false,
"client_order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
"builder_code": "YOUR_CODE"
}
}
Endpoint: POST https://api.pacifica.fi/api/v1/orders/create

Example: Set Position TP/SL with Builder Code

Data to be Signed

Copy
{
"timestamp": 1716200000000,
"expiry_window": 30000,
"type": "set_position_tpsl",
"data": {
"symbol": "BTC",
"side": "bid",
"take_profit": {
"stop_price": "55000",
"limit_price": "54950",
"client_order_id": "e36ac10b-58cc-4372-a567-0e02b2c3d479"
},
"stop_loss": {
"stop_price": "48000",
"limit_price": "47950",
"client_order_id": "d25ac10b-58cc-4372-a567-0e02b2c3d479"
},
"builder_code": "YOUR_CODE"
}
}
Complete Payload (After Signing)

Copy
{
"account": "6ETnufiec2CxVWTS4u5Wiq33Zh5Y3Qm6Pkdpi375fuxP",
"agent_wallet": null,
"signature": "5j1Vy9UqYUF2jKD9r2Lv5AoMWHJuW5a1mqVzEhC9SJL5GqbPkGEQKpW3UZmKXr4UWrHMJ5xHQFMJkZWE8J5VyA",
"timestamp": 1716200000000,
"expiry_window": 30000,
"symbol": "BTC",
"side": "bid",
"take_profit": {
"stop_price": "55000",
"limit_price": "54950",
"client_order_id": "e36ac10b-58cc-4372-a567-0e02b2c3d479"
},
"stop_loss": {
"stop_price": "48000",
"limit_price": "47950",
"client_order_id": "d25ac10b-58cc-4372-a567-0e02b2c3d479"
},
"builder_code": "YOUR_CODE"
}
Endpoint: POST https://api.pacifica.fi/api/v1/positions/tpsl

Note: builder_code is provided only at the top level for TP/SL creation, not within individual take_profit or stop_loss objects.

Implementation Notes
Signature Generation: Follow the standard signing implementation for all requests

Builder Code Placement: The builder_code must be included in the data object when creating the payload to be signed

Recursive Sorting: All JSON keys must be recursively sorted alphabetically before creating the compact JSON string

Timestamps: All times are in milliseconds

Expiry Window: Defaults to 30 seconds (30,000 ms) if not specified

Backwards Compatibility: The builder_code field is optional on all order creation endpoints

Validation: Orders with builder codes will be rejected if:

The builder code doesn't exist

The user hasn't approved the builder code

The user's max_fee_rate is less than the builder's fee_rate

Referral Code Claim
Users can claim a referral code to establish a referral relationship with the code's owner. Referral codes can optionally generate and claim access codes automatically, providing both referral tracking and whitelist access in one action.

How It Works
Step 1: Request User Authorization

Request the user to authorize claiming a referral code by prompting them to sign an approval request containing the referral code.

Data to be Signed

Copy
{
"timestamp": <ms>,
"expiry_window": 5000,
"type": "claim_referral_code",
"data": {
"code": "YOUR_CODE"
}
}
After following the signing implementation, compact and sort this payload recursively to generate the signature.

Complete Payload (After Signing)

Copy
{
"account": "6ETn....",
"agent_wallet": null,
"signature": "5jHM.....",
"timestamp": 1748970123456,
"expiry_window": 5000,
"code": "YOUR_CODE"
}
Endpoint: POST https://api.pacifica.fi/api/v1/referral/user/code/claim

Error Handling
Common Error Codes:

403 Unauthorized: User hasn't approved the builder code or max_fee_rate is too low

404 Not Found: Builder code doesn't exist

400 Bad Request: Invalid builder code format (must be alphanumeric, max 16 characters)

Full Details and Onboarding
For more Pacifica Builder Program specs and details, as well as to onboard to the program, please reach out to us at ops@pacifica.fi, open a support ticket on our Discord or text @PacificaTGPortalBot on telegram.
