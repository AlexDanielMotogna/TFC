API Documentation
API
REST API
Orders
Get order history
This endpoint allows users to get a summarized order history.


Copy
GET /api/v1/orders/history
Query Parameters
Field
Type
Need
Description
Example
"account"

string

required

Account address to filter orders

42trU9A5...

"limit"

integer

optional

Maximum number of records to return, default to 100

100

"cursor"

string

optional

Cursor pagination to access records. Default to none

1115hVka


Copy
/api/v1/orders/history?account=42trU9A5...&limit=100
Response
Status 200: Successfully retrieved order history


Copy
{
  "success": true,
  "data": [
    {
      "order_id": 315992721,
      "client_order_id": "ade",
      "symbol": "XPL",
      "side": "ask",
      "initial_price": "1.0865",
      "average_filled_price": "0",
      "amount": "984",
      "filled_amount": "0",
      "order_status": "open",
      "order_type": "limit",
      "stop_price": null,
      "stop_parent_order_id": null,
      "reduce_only": false,
      "reason": null,
      "created_at": 1759224893638,
      "updated_at": 1759224893638
    },
    ...
  ],
  "next_cursor": "1111Hyd74",
  "has_more": true
}
Field
Type
Description
"order_id"

integer

Order id assigned to order 

"client_order_id"

UUID

CLOID of order if assigned by user

"symbol"

string

Trading pair symbol

"side"

string

Whether the order is a bid or an ask

"price"

decimal string

Price set by the order

"initial_price"

decimal string

Amount (in token denomination) of the order placed

"average_filled_price"

decimal string

VWAP of price at which the order was filled at

"amount"

decimal string

Amount (in token denomination) of the order placed 

"filled_amount"

decimal string

Amount (in token denomination) of the order placed that was filled

"order_status"

string

"open"
"partially_filled"
"filled"
"cancelled"
"rejected"

"order_type"

string

"limit"
"market"
"stop_limit"
"stop_market"
"take_profit_limit"
"stop_loss_limit"
"take_profit_market"
"stop_loss_market"

"stop_price"

decimal string

Stop price assigned upon order creation for subsequent position if order is filled if specified by user.

"stop_parent_order_id"

integer

Order id of stop order attached to original order

"reduce_only"

boolean

If the order is reduce only

"reason"

string

Provides reason for an order being "cancelled" or "rejected":
"cancel"
"force_cancel"
"expired"
"post_only_rejected"
"self_trade_prevented"

"created_at"

integer

Timestamp in milliseconds when the order was created on Pacifica

"updated_at"

integer

Timestamp in milliseconds when any of the order was last modified 

'next_cursor'

string

Next cursor for pagination

'has_more'

boolean

True if there exists a 'next_cursor'

Status 400: Invalid request parameters

Status 401: Unauthorized access

Status 500: Internal server error

Code Example (Python)

Copy
import requests

response = requests.get(
    "/api/v1/orders/history?account=42trU9A5...&limit=100",
    headers={"Accept": "*/*"},
)

data = response.json()