API Documentation
API
REST API
Orders
Batch order
This endpoint allows users to submit multiple order operations in a single request. Batched orders are executed in the order they are batched in, and will not be split up by other users' orders.

The Pacifica Python SDK provides a comprehensive example on using this endpoint


Copy
POST /api/v1/orders/batch
Operation Type (for signing)
Header Field
Type
Content
None

-

Batch orders are not signed as a whole, but rather by its individual actions components.

Request Body
Field
Type
Need
Description
Example
"actions"

array

required

List of order actions to perform

Each action has an "type" field and action-specific "data"

See next two rows

"type"

string

required

Specifies type of action. This is DIFFERENT to the "type" used in signature headers

"Create"
"Cancel"


(case sensitive)

"data"

object

required

Contains signed request payloads of individual "Create" or "Cancel" actions

See code block below. Messages and corresponding fields are identical to create and cancel requests.


Copy
{
   "actions":[
      {
         "type":"Create",
         "data":{
            "account":"42trU9A5...",
            "signature":"5UpRZ14Q...",
            "timestamp":1749190500355,
            "expiry_window":5000,
            "symbol":"BTC",
            "price":"100000",
            "reduce_only":false,
            "amount":"0.1",
            "side":"bid",
            "tif":"GTC",
            "client_order_id":"57a5efb1-bb96-49a5-8bfd-f25d5f22bc7e"
         }
      },
      {
         "type":"Cancel",
         "data":{
            "account":"42trU9A5...",
            "signature":"4NDFHyTG...",
            "timestamp":1749190500355,
            "expiry_window":5000,
            "symbol":"BTC",
            "order_id":42069
         }
      }
   ]
}
Response
Status 200: Batch operations processed successfully


Copy
{
  "success": true,
  "data": {
    "results": [
      {
        "success": true,
        "order_id": 470506,
        "error": null
      },
      {
        "success": true,
      }
    ]
  },
    "error": null,
    "code": null
}
Status 400: Bad request


Copy
  {
    "error": "Invalid batch operation parameters",
    "code": 400
  }
Status 500: Internal server error

Notes on Batch Ordering:
Speed Bump (Latency Protection)
Batch orders are subject to a conditional ~200ms delay to protect liquidity providers from adverse selection:

Speed bump is applied if the batch contains:

Market orders (CreateMarket)

Limit orders with TIF = GTC or IOC

Speed bump is NOT applied if the batch only contains:

Add Liquidity Only orders (TIF = ALO)

Top of Book orders (TIF = TOB)

Cancel operations

TP/SL operations

Signature Requirements
Each action in the batch must be individually signed

All signatures must be valid for the batch to process

Execution Behavior and Limits
Maximum 10 actions per batch request

Actions are executed atomically in the order provided

If one action fails, subsequent actions are still attempted



WEBSOCKET

API Documentation
API
Websocket
Trading operations
Batch order
This endpoint allows users to submit multiple order operations in a single websocket request.

The Pacifica Python SDK provides a comprehensive example on using this endpoint

Request

Copy
{
  "id": "660065de-8f32-46ad-ba1e-83c93d3e3966",
  "params": {
    "batch_orders": {
      "actions": [
        {
          "type": "Create",
          "data": {
            "account": "42trU9A5...",
            "signature": "5UpRZ14Q...",
            "timestamp": 1749190500355,
            "expiry_window": 5000,
            "symbol": "BTC",
            "price": "100000",
            "reduce_only": false,
            "amount": "0.1",
            "side": "bid",
            "tif": "GTC",
            "client_order_id": "57a5efb1-bb96-49a5-8bfd-f25d5f22bc7e"
          }
        },
        {
          "type": "Cancel",
          "data": {
            "account": "42trU9A5...",
            "signature": "4NDFHyTG...",
            "timestamp": 1749190500355,
            "expiry_window": 5000,
            "symbol": "SOL",
            "order_id": 42069
          }
        }
      ]
    }
  }
}
Field
Type
Need
Description
Example
"id"

Full UUID string

required

Client-defined request ID

660065de-8f32-46ad-ba1e-83c93d3e3966

"actions"

array

required

List of order actions to perform

Each action has an "type" field and action-specific "data"

See next two rows

"type"

string

required

Specifies type of action. This is DIFFERENT to the "type" used in signature headers

"Create"
"Cancel"


(case sensitive)

"data"

object

required

Contains signed request payloads of individual "Create" or "Cancel" actions

See code block below. Messages and corresponding fields are identical to create and cancel requests.

Response
Status 200: Batch operations processed successfully


Copy
{
  "code": 200,
  "data": {
    "results": [
      {
        "success": true,
        "order_id": 645953,
        "client_order_id": "57a5efb1-bb96-49a5-8bfd-f25d5f22bc7e",
        "symbol": "BTC"
      },
      {
        "success": true,
        "order_id": 645954,
        "symbol": "ETH"
      }
    ]
  },
  "id": "660065de-8f32-46ad-ba1e-83c93d3e3966",
  "t": 1749223025962,
  "type": "batch_orders"
}
Status 400: Bad request


Copy
  {
    "error": "Invalid batch operation parameters",
    "code": 400
  }
Status 500: Internal server error

Notes on Batch Ordering:
Speed Bump (Latency Protection)
Batch orders are subject to a conditional randomized 50-100ms delay to protect liquidity providers from adverse selection:

Speed bump is applied if the batch contains:

Market orders (CreateMarket)

Limit orders with TIF = GTC or IOC

Speed bump is NOT applied if the batch only contains:

Add Liquidity Only orders (TIF = ALO)

Top of Book orders (TIF = TOB)

Cancel operations

TP/SL operations

Signature Requirements
Each action in the batch must be individually signed

All signatures must be valid for the batch to process

Execution Behavior and Limits
Maximum 10 actions per batch request

Actions are executed atomically in the order provided

If one action fails, subsequent actions are still attempted