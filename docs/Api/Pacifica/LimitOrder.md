API Documentation
API
REST API
Orders
Create limit order
This endpoint allows users to create a new limit order with optional take profit and stop loss levels.

The Pacifica Python SDK provides a comprehensive example on using this endpoint.


Copy
POST /api/v1/orders/create
Operation Type (for signing)
Header Field
Type
Content
"type"

string

"create_order"

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

"price"

string

required

Order price

50000

"amount"

string

required

Order amount

0.1

"side"

string

required

Order side (bid/ask)

bid

"tif"

string

required

Time in force (GTC, IOC, ALO. TOB)

GTC

"reduce_only"

boolean

required

Whether the order is reduce-only

false

"client_order_id"

Full UUID string

optional

Client-defined order ID

f47ac10b-58cc-4372-a567-0e02b2c3d479

"take_profit"

object

optional

Take profit stop order configuration

See next three rows

"stop_price"

string

required

Stop trigger price

55000

"limit_price"

string

optional

Limit price for the triggered order

54950

"client_order_id"

Full UUID string

optional

Client-defined order ID for the stop order

e36ac10b-58cc-4372-a567-0e02b2c3d479

"stop_loss"

object

optional

Stop loss order configuration

See next three rows

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
  "signature": "5j1Vy9Uq",
  "timestamp": 1716200000000,
  "symbol": "BTC",
  "price": "50000",
  "amount": "0.1",
  "side": "bid",
  "tif": "GTC",
  "reduce_only": false,
  "client_order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
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
  "agent_wallet": "69trU9A5...",
  "expiry_window": 30000
}
Response
Status 200: Order created successfully


Copy
  {
    "order_id": 12345
  }
Status 400: Bad request


Copy
  {
    "error": "Invalid order parameters",
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
    "price": "50000",
    "amount": "0.1",
    "side": "bid",
    "tif": "GTC",
    "reduce_only": False,
    "client_order_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}

response = requests.post(
    "/api/v1/orders/create",
    json=payload,
    headers={"Content-Type": "application/json"}
)

data = response.json()
Note: In order to protect liquidity providers from adverse selection, all TIF GTC, and TIF IOC orders are subject to a ~200ms delay.