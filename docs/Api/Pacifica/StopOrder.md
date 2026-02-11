API Documentation
API
REST API
Orders
Create stop order
This endpoint allows users to create stop order.


Copy
POST /api/v1/orders/stop/create
Operation Type (for signing)
Header Field
Type
Content
"type"

string

"create_stop_order"

Request Body
Field
Type
Need
Description
Example
"account"

string

required

User's wallet address

42trU9A5...

"signature"

string

required

Cryptographic signature

5j1Vy9Uq...

"timestamp"

integer

required

Current timestamp in milliseconds

1716200000000

"symbol"

string

required

Trading pair symbol

BTC

"side"

string

required

Order side (bid/ask)

bid

"reduce_only"

boolean

required

Whether the order is reduce-only

false

"stop_order"

object

required

Stop order configuration

See next four rows

"stop_price"

string

required

Stop trigger price

48000

"limit_price"

string

optional

Limit price for the triggered order

47950

"client_order_id"

Full UUID string

optional

Client-defined order ID for the stop order

d25ac10b-58cc-4372-a567-0e02b2c3d479

"amount"

string

required

Order amount

0.1

"agent_wallet"

string

optional

Agent wallet address

69trU9A5...

"expiry_window"

integer

optional

Signature expiry in milliseconds

30000


Copy
{
  "account": "42trU9A5...",
  "signature": "5j1Vy9Uq...",
  "timestamp": 1716200000000,
  "symbol": "BTC",
  "side": "long",
  "reduce_only": true,
  "stop_order": {
    "stop_price": "48000",
    "limit_price": "47950",
    "client_order_id": "d25ac10b-58cc-4372-a567-0e02b2c3d479",
    "amount": "0.1"
  },
  "agent_wallet": "69trU9A5...",
  "expiry_window": 30000
}
Response
Status 200: Stop order created successfully


Copy
  {
    "order_id": 12345
  }
Status 400: Bad request


Copy
  {
    "error": "Invalid stop order parameters",
    "code": 400
  }
Status 500: Internal server error

Code Example (Python)

Copy
import requests

payload = {
    "account": "42trU9A5...",
    "signature": "5j1Vy9Uq...",
    "timestamp": 1716200000000,
    "symbol": "BTC",
    "side": "long",
    "reduce_only": True,
    "stop_order": {
        "stop_price": "48000",
        "limit_price": "47950",
        "amount": "0.1"
    }
}

response = requests.post(
    "/api/v1/orders/stop/create",
    json=payload,
    headers={"Content-Type": "application/json"}
)

data = response.json()