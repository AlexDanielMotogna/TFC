API Documentation
API
REST API
Account
Update leverage
This endpoint allows users to change their account leverage for a specific trading pair. For open positions, users can only increase the leverage setting.


Copy
POST /api/v1/account/leverage
Operation Type (for signing)
Header Field
Type
Content
"type"

string

"update_leverage"

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

"symbol"

string

required

Trading pair symbol

BTC

"leverage"

integer

required

New leverage value

10

"timestamp"

integer

required

Current timestamp in milliseconds

1716200000000

"expiry_window"

integer

optional

Signature expiry in milliseconds

30000

"agent_wallet"

string

optional

Agent wallet address

69trU9A5...

"signature"

string

required

Cryptographic signature

5j1Vy9Uq...


Copy
{
  "account": "42trU9A5...",
  "symbol": "BTC",
  "leverage": 10,
  "timestamp": 1716200000000,
  "expiry_window": 30000,
  "agent_wallet": "69trU9A5...",
  "signature": "5j1Vy9UqY..."
}
Response
Status 200: Leverage updated successfully


Copy
 {
    "success": true
  }
Status 400: Invalid request parameters


Copy
  {
    "error": "Invalid leverage",
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
    "leverage": 10
}

response = requests.post(
    "/api/v1/account/leverage",
    json=payload,
    headers={"Content-Type": "application/json"}
)

data = response.json()



API Documentation
API
REST API
Account
Get account settings
This endpoint allows users to get account margin and leverage settings (if they are not at default values)


Copy
GET /api/v1/account/settings
Query Parameters
Field
Type
Need
Description
Example
"account"

string

required

Account address

42trU9A5...


Copy
/api/v1/account/settings?account=42trU9A5...
Response
NOTE: Upon account creation, all markets have margin settings default to cross margin and leverage default to max. When querying this endpoint, all markets with default margin and leverage settings on this account will return blank.

Status 200: Successfully retrieved account settings


Copy
  {
  "success": true,
  "data": [
    {
      "symbol": "WLFI",
      "isolated": false,
      "leverage": 5,
      "created_at": 1758085929703,
      "updated_at": 1758086074002
    }
  ],
  "error": null,
  "code": null
}
Field
Type
Description
"symbol"

string

Trading pair symbol

"isolated"

boolean

If the account is set to isolated margining for this symbol

"leverage"

integer

Current leverage set by the user (default to max)

"created_at"

integer

Timestamp in milliseconds when these settings were adjusted from their default

"updated_at"

integer

Timestamp in milliseconds when these settings were last updated

Status 400: Invalid request parameters

Status 401: Unauthorized access

Status 500: Internal server error

Code Example (Python)

Copy
import requests

response = requests.get(
    "/api/v1/account/settings?account=42trU9A5...",
    headers={"Accept": "*/*"},
)

data = response.json()


