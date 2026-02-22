For developers
API
Info endpoint
Perpetuals
The section documents the info endpoints that are specific to perpetuals. See Rate limits section for rate limiting logic and weights.

Retrieve all perpetual dexs
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"perpDexs"

200: OK Successful Response

Copy
[
  null,
  {
    "name": "test",
    "fullName": "test dex",
    "deployer": "0x5e89b26d8d66da9888c835c9bfcc2aa51813e152",
    "oracleUpdater": null,
    "feeRecipient": null,
    "assetToStreamingOiCap": [["COIN1", "100000.0"], ["COIN2", "200000.0"]],
    "assetToFundingMultiplier": [["COIN1", "1.0"], ["COIN2", "2.0"]]
  }
]
Retrieve perpetuals metadata (universe and margin tables)
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"meta"

dex

String

Perp dex name. Defaults to the empty string which represents the first perp dex.

200: OK Successful Response

Copy
{
    "universe": [
        {
            "name": "BTC",
            "szDecimals": 5,
            "maxLeverage": 50
        },
        {
            "name": "ETH",
            "szDecimals": 4,
            "maxLeverage": 50
        },
        {
            "name": "HPOS",
            "szDecimals": 0,
            "maxLeverage": 3,
            "onlyIsolated": true
        },
        {
            "name": "LOOM",
            "szDecimals": 1,
            "maxLeverage": 3,
            "isDelisted": true,
            "marginMode": "strictIsolated", // "strictIsolated" means margin cannot be removed, "noCross" means only isolated margin allowed
            "onlyIsolated": true // deprecated. Means either "strictIsolated" or "noCross"
        }
    ],
    "marginTables": [
        [
            50,
            {
                "description": "",
                "marginTiers": [
                    {
                        "lowerBound": "0.0",
                        "maxLeverage": 50
                    }
                ]
            }
        ],
        [
            51,
            {
                "description": "tiered 10x",
                "marginTiers": [
                    {
                        "lowerBound": "0.0",
                        "maxLeverage": 10
                    },
                    {
                        "lowerBound": "3000000.0",
                        "maxLeverage": 5
                    }
                ]
            }
        ]
    ]
}
Retrieve perpetuals asset contexts (includes mark price, current funding, open interest, etc.)
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"metaAndAssetCtxs"

dex

String

Perp dex name. Defaults to the empty string which represents the first perp dex.

200: OK Successful Response (first perp dex)
200: OK Successful Response (HIP-3 dex)

Copy
[
{
     "universe": [
        {
            "name": "BTC",
            "szDecimals": 5,
            "maxLeverage": 50
        },
        {
            "name": "ETH",
            "szDecimals": 4,
            "maxLeverage": 50
        },
        {
            "name": "HPOS",
            "szDecimals": 0,
            "maxLeverage": 3,
            "onlyIsolated": true
        }
    ],
    "marginTables":[
         [
            50,
            {
               "description":"",
               "marginTiers":[
                  {
                     "lowerBound":"0.0",
                     "maxLeverage":50
                  }
               ]
            }
         ]
     ],
     "collateralToken":0
},
[
    {
        "dayNtlVlm":"1169046.29406",
         "funding":"0.0000125",
         "impactPxs":[
            "14.3047",
            "14.3444"
         ],
         "markPx":"14.3161",
         "midPx":"14.314",
         "openInterest":"688.11",
         "oraclePx":"14.32",
         "premium":"0.00031774",
         "prevDayPx":"15.322"
    },
    {
         "dayNtlVlm":"1426126.295175",
         "funding":"0.0000125",
         "impactPxs":[
            "6.0386",
            "6.0562"
         ],
         "markPx":"6.0436",
         "midPx":"6.0431",
         "openInterest":"1882.55",
         "oraclePx":"6.0457",
         "premium":"0.00028119",
         "prevDayPx":"6.3611"
      },
      {
         "dayNtlVlm":"809774.565507",
         "funding":"0.0000125",
         "impactPxs":[
            "8.4505",
            "8.4722"
         ],
         "markPx":"8.4542",
         "midPx":"8.4557",
         "openInterest":"2912.05",
         "oraclePx":"8.4585",
         "premium":"0.00033694",
         "prevDayPx":"8.8097"
      }
]
]
Retrieve user's perpetuals account summary
POST https://api.hyperliquid.xyz/info

See a user's open positions and margin summary for perpetuals trading

Headers
Name
Type
Description
Content-Type*

"application/json"

Request Body
Name
Type
Description
type*

String

"clearinghouseState"

user*

String

Onchain address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000.

dex

String

Perp dex name. Defaults to the empty string which represents the first perp dex.

200: OK Successful Response

Copy
{
  "assetPositions": [
    {
      "position": {
        "coin": "ETH",
        "cumFunding": {
          "allTime": "514.085417",
          "sinceChange": "0.0",
          "sinceOpen": "0.0"
        },
        "entryPx": "2986.3",
        "leverage": {
          "rawUsd": "-95.059824",
          "type": "isolated",
          "value": 20
        },
        "liquidationPx": "2866.26936529",
        "marginUsed": "4.967826",
        "maxLeverage": 50,
        "positionValue": "100.02765",
        "returnOnEquity": "-0.0026789",
        "szi": "0.0335",
        "unrealizedPnl": "-0.0134"
      },
      "type": "oneWay"
    }
  ],
  "crossMaintenanceMarginUsed": "0.0",
  "crossMarginSummary": {
    "accountValue": "13104.514502",
    "totalMarginUsed": "0.0",
    "totalNtlPos": "0.0",
    "totalRawUsd": "13104.514502"
  },
  "marginSummary": {
    "accountValue": "13109.482328",
    "totalMarginUsed": "4.967826",
    "totalNtlPos": "100.02765",
    "totalRawUsd": "13009.454678"
  },
  "time": 1708622398623,
  "withdrawable": "13104.514502"
}
Retrieve a user's funding history or non-funding ledger updates
POST https://api.hyperliquid.xyz/info

Note: Non-funding ledger updates include deposits, transfers, and withdrawals.

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"userFunding" or "userNonFundingLedgerUpdates"

user*

String

Address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000.

startTime*

int

Start time in milliseconds, inclusive

endTime

int

End time in milliseconds, inclusive. Defaults to current time.

200: OK Successful Response (first perp dex)
200: OK Successful Response (HIP-3 dex)

Copy
[
    {
        "delta": {
            "coin": "ETH",
            "fundingRate": "0.0000417",
            "szi": "49.1477",
            "type": "funding",
            "usdc":" -3.625312",
            "nSamples": null
        },
        "hash": "0xa166e3fa63c25663024b03f2e0da011a00307e4017465df020210d3d432e7cb8",
        "time": 1681222254710
    },
    ...
]
Retrieve historical funding rates
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"fundingHistory"

coin*

String

Coin, e.g. "ETH"

startTime*

int

Start time in milliseconds, inclusive

endTime

int

End time in milliseconds, inclusive. Defaults to current time.

200: OK (first perp dex)
200: OK (HIP-3 dex)

Copy
[
    {
        "coin":"ETH",
        "fundingRate": "-0.00022196",
        "premium": "-0.00052196",
        "time":1683849600076
    }
]
Retrieve predicted funding rates for different venues
POST https://api.hyperliquid.xyz/info

Note that predicted funding rates is only supported for the first perp dex.

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"predictedFundings"

200: OK Successful Response

Copy
[
  [
    "AVAX",
    [
      [
        "BinPerp",
        {
          "fundingRate": "0.0001",
          "nextFundingTime": 1733961600000
        }
      ],
      [
        "HlPerp",
        {
          "fundingRate": "0.0000125",
          "nextFundingTime": 1733958000000
        }
      ],
      [
        "BybitPerp",
        {
          "fundingRate": "0.0001",
          "nextFundingTime": 1733961600000
        }
      ]
    ]
  ],...
]
Query perps at open interest caps
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"perpsAtOpenInterestCap"

dex

String

Perp dex name of builder-deployed dex market. If not specified, then the first perp dex is used

200: OK Successful Response

Copy
["BADGER","CANTO","FTM","LOOM","PURR"]
Retrieve information about the Perp Deploy Auction
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"perpDeployAuctionStatus"

200: OK Successful Response

Copy
{
  "startTimeSeconds": 1747656000,
  "durationSeconds": 111600,
  "startGas": "500.0",
  "currentGas": "500.0",
  "endGas": null
}
Retrieve User's Active Asset Data
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"activeAssetData"

user*

String

Address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000.

coin*

String

Coin, e.g. "ETH". See here for more details.

200: OK (first perp dex)
200: OK (HIP-3 dex)

Copy
{
  "user": "0xb65822a30bbaaa68942d6f4c43d78704faeabbbb",
  "coin": "APT",
  "leverage": {
    "type": "cross",
    "value": 3
  },
  "maxTradeSzs": ["24836370.4400000013", "24836370.4400000013"],
  "availableToTrade": ["37019438.0284740031", "37019438.0284740031"],
  "markPx": "4.4716"
}
Retrieve Builder-Deployed Perp Market Limits
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"perpDexLimits"

dex*

String

Perp dex name of builder-deployed dex market. The empty string is not allowed.

200: OK

Copy
{
  "totalOiCap": "10000000.0",
  "oiSzCapPerPerp": "10000000000.0",
  "maxTransferNtl": "100000000.0",
  "coinToOiCap": [["COIN1", "100000.0"], ["COIN2", "200000.0"]],
}
Get Perp Market Status
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"perpDexStatus"

dex*

String

Perp dex name of builder-deployed dex market. The empty string represents the first perp dex.

200: OK

Copy
{
  "totalNetDeposit": "4103492112.4478230476"
}
Retrieve all perpetuals metadata (universe and margin tables)
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"allPerpMetas"

200: OK

Copy
[ // first perp dex
    [
        {
            "universe":[
                {
                    "name":"BTC",
                    "szDecimals":5,
                    "maxLeverage":50
                },
                {
                    "name":"ETH",
                    "szDecimals":4,
                    "maxLeverage":50
                },
                {
                    "name":"HPOS",
                    "szDecimals":0,
                    "maxLeverage":3,
                    "onlyIsolated":true
                }
            ],
            "marginTables":[
                [
                    50,
                    {
                        "description":"",
                        "marginTiers":[
                            {
                                "lowerBound":"0.0",
                                "maxLeverage":50
                            }
                        ]
                    }
                ]
            ],
            "collateralToken":0
        },
        [
            {
                "dayNtlVlm":"1169046.29406",
                "funding":"0.0000125",
                "impactPxs":[
                    "14.3047",
                    "14.3444"
                ],
                "markPx":"14.3161",
                "midPx":"14.314",
                "openInterest":"688.11",
                "oraclePx":"14.32",
                "premium":"0.00031774",
                "prevDayPx":"15.322"
            },
            {
                "dayNtlVlm":"1426126.295175",
                "funding":"0.0000125",
                "impactPxs":[
                    "6.0386",
                    "6.0562"
                ],
                "markPx":"6.0436",
                "midPx":"6.0431",
                "openInterest":"1882.55",
                "oraclePx":"6.0457",
                "premium":"0.00028119",
                "prevDayPx":"6.3611"
            },
            {
                "dayNtlVlm":"809774.565507",
                "funding":"0.0000125",
                "impactPxs":[
                    "8.4505",
                    "8.4722"
                ],
                "markPx":"8.4542",
                "midPx":"8.4557",
                "openInterest":"2912.05",
                "oraclePx":"8.4585",
                "premium":"0.00033694",
                "prevDayPx":"8.8097"
            }
        ]
    ],
    [ // second perp dex
        {
            "universe":[
                {
                    "szDecimals":4,
                    "name":"xyz:XYZ100",
                    "maxLeverage":20,
                    "marginTableId":20,
                    "onlyIsolated":true,
                    "marginMode":"strictIsolated",
                    "growthMode":"enabled",
                    "lastGrowthModeChangeTime":"2025-11-23T17:21:40.390706535"
                },
                {
                    "szDecimals":3,
                    "name":"xyz:TSLA",
                    "maxLeverage":10,
                    "marginTableId":10,
                    "onlyIsolated":true,
                    "marginMode":"strictIsolated",
                    "growthMode":"enabled",
                    "lastGrowthModeChangeTime":"2025-11-23T17:21:40.390706535"
                },
                {
                    "szDecimals":3,
                    "name":"xyz:NVDA",
                    "maxLeverage":10,
                    "marginTableId":10,
                    "onlyIsolated":true,
                    "marginMode":"strictIsolated",
                    "growthMode":"enabled",
                    "lastGrowthModeChangeTime":"2025-11-23T17:21:40.390706535"
                }
            ],
            "marginTables":[
                [
                    50,
                    {
                        "description":"",
                        "marginTiers":[
                            {
                                "lowerBound":"0.0",
                                "maxLeverage":50
                            }
                        ]
                    }
                ]
            ],
            "collateralToken":0
        },
        [
            {
                "funding":"0.0002110251",
                "openInterest":"0.0854",
                "prevDayPx":"25956.0",
                "dayNtlVlm":"462.9758",
                "premium":"0.0031136686",
                "oraclePx":"25372.0",
                "markPx":"25451.0",
                "midPx":"25451.0",
                "impactPxs":[
                    "24946.0",
                    "25956.0"
                ],
                "dayBaseVlm":"0.0183"
            },
            {
                "funding":"0.0",
                "openInterest":"12.208",
                "prevDayPx":"447.49",
                "dayNtlVlm":"0.0",
                "premium":null,
                "oraclePx":"450.78",
                "markPx":"465.13",
                "midPx":"464.92",
                "impactPxs":null,
                "dayBaseVlm":"0.0"
            },
            {
                "funding":"0.0",
                "openInterest":"9.43",
                "prevDayPx":"177.0",
                "dayNtlVlm":"2192.853",
                "premium":null,
                "oraclePx":"188.15",
                "markPx":"177.06",
                "midPx":null,
                "impactPxs":null,
                "dayBaseVlm":"12.389"
            }
        ]
    ]
]
Retrieve perp annotation
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"perpAnnotation"

coin*

String

coin name, e.g. "BTC"

200: OK

Copy
{
  "category": "other",
  "description": "other perps"
}
Retrieve perp categories
POST https://api.hyperliquid.xyz/info

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
type*

String

"perpCategories"

200: OK

Copy
[["birb:PENGU","test_cat"],["nq:TEST","preipo"],["nq:TEST1","all"],["nq:TEST2","ai"]]



For developers
API
Exchange endpoint
The exchange endpoint is used to interact with and trade on the Hyperliquid chain. See the Python SDK for code to generate signatures for these requests.

Asset
Many of the requests take asset as an input. For perpetuals this is the index in the universe field returned by themeta response. For spot assets, use 10000 + index where index is the corresponding index in spotMeta.universe. For example, when submitting an order for PURR/USDC, the asset that should be used is 10000 because its asset index in the spot metadata is 0.

Subaccounts and vaults
Subaccounts and vaults do not have private keys. To perform actions on behalf of a subaccount or vault signing should be done by the master account and the vaultAddress field should be set to the address of the subaccount or vault. The basic_vault.py example in the Python SDK demonstrates this.

Expires After
Some actions support an optional field expiresAfter which is a timestamp in milliseconds after which the action will be rejected. User-signed actions such as Core USDC transfer do not support the expiresAfter field. Note that actions consume 5x the usual address-based rate limit when canceled due to a stale expiresAfter field. 

See the Python SDK for details on how to incorporate this field when signing. 

Place an order
POST https://api.hyperliquid.xyz/exchange

See Python SDK for full featured examples on the fields of the order request.

For limit orders, TIF (time-in-force) sets the behavior of the order upon first hitting the book.

ALO (add liquidity only, i.e. "post only") will be canceled instead of immediately matching.

IOC (immediate or cancel) will have the unfilled part canceled instead of resting.

GTC (good til canceled) orders have no special behavior.

Client Order ID (cloid) is an optional 128 bit hex string, e.g. 0x1234567890abcdef1234567890abcdef

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "order",
  "orders": [{

    "a": Number,

    "b": Boolean,

    "p": String,

    "s": String,

    "r": Boolean,

    "t": {

      "limit": {

        "tif": "Alo" | "Ioc" | "Gtc" 

      } or

      "trigger": {

         "isMarket": Boolean,

         "triggerPx": String,

         "tpsl": "tp" | "sl"

       }

    },

    "c": Cloid (optional)

  }],

  "grouping": "na" | "normalTpsl" | "positionTpsl",

  "builder": Optional({"b": "address", "f": Number})

}

Meaning of keys:
a is asset
b is isBuy
p is price
s is size
r is reduceOnly
t is type
c is cloid (client order id)

Meaning of keys in optional builder argument:
b is the address the should receive the additional fee
f is the size of the fee in tenths of a basis point e.g. if f is 10, 1bp of the order notional  will be charged to the user and sent to the builder

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its Onchain address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful Response (resting)
200: OK Error Response


Copy
{
   "status":"ok",
   "response":{
      "type":"order",
      "data":{
         "statuses":[
            {
               "resting":{
                  "oid":77738308
               }
            }
         ]
      }
   }
}
Cancel order(s)
POST https://api.hyperliquid.xyz/exchange

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "cancel",

  "cancels": [

    {

      "a": Number,

      "o": Number

    }

  ]

}

Meaning of keys:
a is asset
o is oid (order id)

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful Response
200: OK Error Response

Copy
{
   "status":"ok",
   "response":{
      "type":"cancel",
      "data":{
         "statuses":[
            "success"
         ]
      }
   }
}
Cancel order(s) by cloid
POST https://api.hyperliquid.xyz/exchange 

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "cancelByCloid",

  "cancels": [

    {

      "asset": Number,

      "cloid": String

    }

  ]

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful Response
200: OK Error Response
Schedule cancel (dead man's switch)
POST https://api.hyperliquid.xyz/exchange 

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "scheduleCancel",

  "time": number (optional)

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

Schedule a cancel-all operation at a future time. Not including time will remove the scheduled cancel operation. The time must be at least 5 seconds after the current time. Once the time comes, all open orders will be canceled and a trigger count will be incremented. The max number of triggers per day is 10. This trigger count is reset at 00:00 UTC.

Modify an order
POST https://api.hyperliquid.xyz/exchange  

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "modify",

  "oid": Number | Cloid,

  "order": {

    "a": Number,

    "b": Boolean,

    "p": String,

    "s": String,

    "r": Boolean,

    "t": {

      "limit": {

        "tif": "Alo" | "Ioc" | "Gtc" 

      } or

      "trigger": {

         "isMarket": Boolean,

         "triggerPx": String,

         "tpsl": "tp" | "sl"

       }

    },

    "c": Cloid (optional)

  }

}

Meaning of keys:
a is asset
b is isBuy
p is price
s is size
r is reduceOnly
t is type
c is cloid (client order id)

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its Onchain address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful Response
200: OK Error Response
Modify multiple orders
POST https://api.hyperliquid.xyz/exchange

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "batchModify",

  "modifies": [{

    "oid": Number | Cloid,

    "order": {

      "a": Number,

      "b": Boolean,

      "p": String,

      "s": String,

      "r": Boolean,

      "t": {

        "limit": {

          "tif": "Alo" | "Ioc" | "Gtc" 

        } or

        "trigger": {

           "isMarket": Boolean,

           "triggerPx": String,

           "tpsl": "tp" | "sl"

         }

      },

      "c": Cloid (optional)

    }

  }]

}

Meaning of keys:
a is asset
b is isBuy
p is price
s is size
r is reduceOnly
t is type
c is cloid (client order id)

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its Onchain address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

Update leverage
POST https://api.hyperliquid.xyz/exchange

Update cross or isolated leverage on a coin. 

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "updateLeverage",

  "asset": index of coin,

  "isCross": true or false if updating cross-leverage,

  "leverage": integer representing new leverage, subject to leverage constraints on that coin

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its Onchain address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Update isolated margin
POST https://api.hyperliquid.xyz/exchange

Add or remove margin from isolated position

Note that to target a specific leverage instead of a USDC value of margin change, there is an alternate action {"type": "topUpIsolatedOnlyMargin", "asset": <asset>, "leverage": <float string>}

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "updateIsolatedMargin",

  "asset": index of coin,

  "isBuy": true, (this parameter won't have any effect until hedge mode is introduced)

  "ntli": int representing amount to add or remove with 6 decimals, e.g. 1000000 for 1 usd,

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its Onchain address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Core USDC transfer
POST https://api.hyperliquid.xyz/exchange

Send usd to another address. This transfer does not touch the EVM bridge. The signature format is human readable for wallet interfaces.

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "usdSend",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "destination": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000,

   "amount": amount of usd to send as a string, e.g. "1" for 1 usd,

     "time": current timestamp in milliseconds as a Number, should match nonce

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Core spot transfer
POST https://api.hyperliquid.xyz/exchange

Send spot assets to another address. This transfer does not touch the EVM bridge. The signature format is human readable for wallet interfaces.

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "spotSend",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "destination": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000,
  "token": tokenName:tokenId; e.g. "PURR:0xc4bf3f870c0e9465323c0b6ed28096c2",

   "amount": amount of token to send as a string, e.g. "0.01",

     "time": current timestamp in milliseconds as a Number, should match nonce

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}

Copy
Example sign typed data for generating the signature:
{
  "types": {
    "HyperliquidTransaction:SpotSend": [
      {
        "name": "hyperliquidChain",
        "type": "string"
      },
      {
        "name": "destination",
        "type": "string"
      },
      {
        "name": "token",
        "type": "string"
      },
      {
        "name": "amount",
        "type": "string"
      },
      {
        "name": "time",
        "type": "uint64"
      }
    ]
  },
  "primaryType": "HyperliquidTransaction:SpotSend",
  "domain": {
    "name": "HyperliquidSignTransaction",
    "version": "1",
    "chainId": 42161,
    "verifyingContract": "0x0000000000000000000000000000000000000000"
  },
  "message": {
    "destination": "0x0000000000000000000000000000000000000000",
    "token": "PURR:0xc1fb593aeffbeb02f85e0308e9956a90",
    "amount": "0.1",
    "time": 1716531066415,
    "hyperliquidChain": "Mainnet"
  }
}
Initiate a withdrawal request
POST https://api.hyperliquid.xyz/exchange

This method is used to initiate the withdrawal flow. After making this request, the L1 validators will sign and send the withdrawal request to the bridge contract. There is a $1 fee for withdrawing at the time of this writing and withdrawals take approximately 5 minutes to finalize.

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{
  "type": "withdraw3",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "amount": amount of usd to send as a string, e.g. "1" for 1 usd,

  "time": current timestamp in milliseconds as a Number, should match nonce,

  "destination": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

}

nonce*

Number

Recommended to use the current timestamp in milliseconds, must match the nonce in the action Object above

signature*

Object

200: OK

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Transfer from Spot account to Perp account (and vice versa)
POST https://api.hyperliquid.xyz/exchange

This method is used to transfer USDC from the user's spot wallet to perp wallet and vice versa.

Headers

Name
Value
Content-Type*

"application/json"

Body

Name
Type
Description
action*

Object

{

  "type": "usdClassTransfer",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

 "amount": amount of usd to transfer as a string, e.g. "1" for 1 usd. If you want to use this action for a subaccount, you can include subaccount: address after the amount, e.g. "1" subaccount:0x0000000000000000000000000000000000000000,

  "toPerp": true if (spot -> perp) else false,

"nonce": current timestamp in milliseconds as a Number, must match nonce in outer request body

}

nonce*

Number

Recommended to use the current timestamp in milliseconds, must match the nonce in the action Object above

signature*

Object

Response

200: OK

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Send Asset
POST https://api.hyperliquid.xyz/exchange

This generalized method is used to transfer tokens between different perp DEXs, spot balance, users, and/or sub-accounts. Use "" to specify the default USDC perp DEX and "spot" to specify spot. Only the collateral token can be transferred to or from a perp DEX.

Headers
Name
Value
Content-Type*

application/json

Body
Name
Type
Description
action*

Object

{

  "type": "sendAsset",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),

  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "destination": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000,

  "sourceDex": name of perp dex to transfer from,

  "destinationDex": name of the perp dex to transfer to,

  "token": tokenName:tokenId; e.g. "PURR:0xc4bf3f870c0e9465323c0b6ed28096c2",

  "amount": amount of token to send as a string; e.g. "0.01",

  "fromSubAccount": address in 42-character hexadecimal format or empty string if not from a subaccount,

  "nonce": current timestamp in milliseconds as a Number, should match nonce

}

nonce*

Number

Recommended to use the current timestamp in milliseconds, must match the nonce in the action Object above

signature*

Object

Response
200: OK

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Send to EVM with data
POST https://api.hyperliquid.xyz/exchange

Specialized action for Core to EVM transfer that includes an additional data payload. See HyperCore <> HyperEVM transfers for more details. When used coreReceiveWithData will be called on the linked contract instead of transfer. IMPORTANT: it is the caller's responsibility to ensure that the token is properly linked and the linked contract supports the following interface:


Copy
interface ICoreReceiveWithData {
  function coreReceiveWithData(
    address from,
    bytes32 destinationRecipient,
    uint32 destinationChainId,
    uint256 amount,
    uint64 nonce,
    bytes calldata data
  ) external;
}
Headers
Name
Value
Content-Type*

application/json

Body
Name
Type
Description
action*

Object

{

  "type": "sendToEvmWithData",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),

  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "token": tokenName:tokenId; e.g. "PURR:0xc4bf3f870c0e9465323c0b6ed28096c2",

  "amount": amount of token to send as a string; e.g. "0.01",

  "sourceDex": name of perp dex to transfer from,

  "destinationRecipient": address in addressEncoding format,

  "addressEncoding": "hex" | "base58",

  "destinationChainId": number,

  "gasLimit": number,

  "data": bytes,

  "nonce": current timestamp in milliseconds as a Number, should match nonce

}

nonce*

Number

Recommended to use the current timestamp in milliseconds, must match the nonce in the action Object above

signature*

Object

Response
200: OK

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Deposit into staking
POST https://api.hyperliquid.xyz/exchange

This method is used to transfer native token from the user's spot account into staking for delegating to validators. 

Headers
Name
Value
Content-Type*

application/json

Body
Name
Type
Description
action*

Object

{

  "type": "cDeposit",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

 "wei": amount of wei to transfer as a number,

"nonce": current timestamp in milliseconds as a Number, must match nonce in outer request body

}

nonce*

Number

Recommended to use the current timestamp in milliseconds, must match the nonce in the action Object above

signature*

Object

Response
200: OK

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Withdraw from staking
POST https://api.hyperliquid.xyz/exchange

This method is used to transfer native token from staking into the user's spot account. Note that transfers from staking to spot account go through a 7 day unstaking queue.

Headers
Name
Value
Content-Type*

application/json

Body
Name
Type
Description
action*

Object

{

  "type": "cWithdraw",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

 "wei": amount of wei to transfer as a number,

"nonce": current timestamp in milliseconds as a Number, must match nonce in outer request body

}

nonce*

Number

Recommended to use the current timestamp in milliseconds, must match the nonce in the action Object above

signature*

Object

Response
200: OK

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Delegate or undelegate stake from validator
POST https://api.hyperliquid.xyz/exchange

Delegate or undelegate native tokens to or from a validator. Note that delegations to a particular validator have a lockup duration of 1 day.

Headers
Name
Value
Content-Type*

application/json

Body
Name
Type
Description
action*

Object

{

  "type": "tokenDelegate",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "validator": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000,
"isUndelegate": boolean,

"wei": number,

"nonce": current timestamp in milliseconds as a Number, must match nonce in outer request body

}

nonce*

number

Recommended to use the current timestamp in milliseconds

signature*

Object

Response
200: OK

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Deposit or withdraw from a vault
POST https://api.hyperliquid.xyz/exchange

Add or remove funds from a vault.

Headers

Name
Value
Content-Type*

application/json

Body

Name
Type
Description
action*

Object

{

  "type": "vaultTransfer",

  "vaultAddress": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000,
"isDeposit": boolean,

"usd": number

}

nonce*

number

Recommended to use the current timestamp in milliseconds

signature*

Object

expiresAfter

Number

Timestamp in milliseconds

Response

200

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Approve an API wallet
POST https://api.hyperliquid.xyz/exchange

Approves an API Wallet (also sometimes referred to as an Agent Wallet). See here for more details.

Headers

Name
Value
Content-Type*

application/json

Body

Name
Type
Description
action*

Object

{
  "type": "approveAgent",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "agentAddress": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000,

"agentName": Optional name for the API wallet. An account can have 1 unnamed approved wallet and up to 3 named ones. And additional 2 named agents are allowed per subaccount,

  "nonce": current timestamp in milliseconds as a Number, must match nonce in outer request body

}

nonce*

number

Recommended to use the current timestamp in milliseconds

signature*

Object

Response

200

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Approve a builder fee
POST https://api.hyperliquid.xyz/exchange

Approve a maximum fee rate for a builder.

Headers

Name
Value
Content-Type*

application/json

Body

Name
Type
Description
action*

Object

{
  "type": "approveBuilderFee",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),
  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "maxFeeRate": the maximum allowed builder fee rate as a percent string; e.g. "0.001%",

  "builder": address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000,

  "nonce": current timestamp in milliseconds as a Number, must match nonce in outer request body

}

nonce*

number

Recommended to use the current timestamp in milliseconds

signature*

Object

Response

200

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Place a TWAP order
POST https://api.hyperliquid.xyz/exchange

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "twapOrder",
  "twap": {

    "a": Number,

    "b": Boolean,

    "s": String,

    "r": Boolean,

    "m": Number,

    "t": Boolean

  }

  }

Meaning of keys:
a is asset
b is isBuy
s is size
r is reduceOnly

m is minutes
t is randomize

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its Onchain address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful Response
200: OK Error Response

Copy
{
   "status":"ok",
   "response":{
      "type":"twapOrder",
      "data":{
         "status": {
            "running":{
               "twapId":77738308
            }
         }
      }
   }
}
Cancel a TWAP order
POST https://api.hyperliquid.xyz/exchange

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "twapCancel",

   "a": Number,

   "t": Number

}

Meaning of keys:
a is asset
t is twap_id

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

vaultAddress

String

If trading on behalf of a vault or subaccount, its address in 42-character hexadecimal format; e.g. 0x0000000000000000000000000000000000000000

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful Response
200: OK Error Response

Copy
{
   "status":"ok",
   "response":{
      "type":"twapCancel",
      "data":{
         "status": "success"
      }
   }
}
Reserve Additional Actions
POST https://api.hyperliquid.xyz/exchange 

Instead of trading to increase the address based rate limits, this action allows reserving additional actions for 0.0005 USDC per request. The cost is paid from the Perps balance. 

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "reserveRequestWeight",

   "weight": Number

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Invalidate Pending Nonce (noop)
POST https://api.hyperliquid.xyz/exchange 

This action does not do anything (no operation), but causes the nonce to be marked as used. This can be a more effective way to cancel in-flight orders than the cancel action.

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "noop"

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

expiresAfter

Number

Timestamp in milliseconds

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Enable HIP-3 DEX abstraction
POST https://api.hyperliquid.xyz/exchange 

NOTE: deprecrated. Prefer userSetAbstraction. 

If set, actions on HIP-3 perps will automatically transfer collateral from validator-operated USDC perps balance for HIP-3 DEXs where USDC is the collateral token, and spot otherwise. When HIP-3 DEX abstraction is active, collateral is returned to the same source (validator-operated USDC perps or spot balance) when released from positions or open orders.

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "userDexAbstraction",

  "hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),

  "signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

  "user": address in 42-character hexadecimal format. Can be a sub-account of the user,

  "enabled": boolean,

  "nonce": current timestamp in milliseconds as a Number, should match nonce

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Enable HIP-3 DEX abstraction (agent)
NOTE: deprecrated. Prefer agentSetAbstraction. 

Same effect as UserDexAbstraction above, but only works if setting the value from null to true.

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "agentEnableDexAbstraction"

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Set User Abstraction
POST https://api.hyperliquid.xyz/exchange

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

"type": "userSetAbstraction",

"hyperliquidChain": "Mainnet" (on testnet use "Testnet" instead),

"signatureChainId": the id of the chain used when signing in hexadecimal format; e.g. "0xa4b1" for Arbitrum,

"user": address in 42-character hexadecimal format. Can be a sub-account of the user,

"abstraction": one of the strings ["disabled", "unifiedAccount", "portfolioMargin"],

"nonce": current timestamp in milliseconds as a Number, should match nonce

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Set User Abstraction (agent)
POST https://api.hyperliquid.xyz/exchange

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

"type": "agentSetAbstraction",

 "abstraction": one of the strings ["i", "u", "p"] where "i" is "disabled", "u" is "unifiedAccount", and "p" is "portfolioMargin"

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Validator vote on risk-free rate for aligned quote asset
POST https://api.hyperliquid.xyz/exchange

Headers
Name
Type
Description
Content-Type*

String

"application/json"

Request Body
Name
Type
Description
action*

Object

{

  "type": "validatorL1Stream",

  "riskFreeRate": String // e.g. "0.04" for 4% 

}

nonce*

Number

Recommended to use the current timestamp in milliseconds

signature*

Object

200: OK Successful Response

Copy
{'status': 'ok', 'response': {'type': 'default'}}
Previous
Spot
Next
Websocket


For developers
API
Websocket
Post requests
This page describes posting requests using the WebSocket API.

Request format
The WebSocket API supports posting requests that you can normally post through the HTTP API. These requests are either info requests or signed actions. For examples of info request payloads, please refer to the Info endpoint section. For examples of signed action payloads, please refer to the Exchange endpoint section.

To send such a payload for either type via the WebSocket API, you must wrap it as such:


Copy
{
  "method": "post",
  "id": <number>,
  "request": {
    "type": "info" | "action",
    "payload": { ... }
  }
}
Note: The method and id fields are mandatory. It is recommended that you use a unique id for every post request you send in order to track outstanding requests through the channel.

Note: explorer requests are not supported via WebSocket.

Response format
The server will respond to post requests with either a success or an error. For errors, a String is returned mirroring the HTTP status code and description that would have been returned if the request were sent through HTTP.


Copy
{
  "channel": "post",
  "data": {
    "id": <number>,
    "response": {
      "type": "info" | "action" | "error",
      "payload": { ... }
    }
  }
}
Examples
Here are a few examples of subscribing to different feeds using the subscription messages:

Sending an L2Book info request:


Copy
{
  "method": "post",
  "id": 123,
  "request": {
    "type": "info",
    "payload": {
      "type": "l2Book",
      "coin": "ETH",
      "nSigFigs": 5,
      "mantissa": null
    }
  }
}
Sample response:


Copy
{
  "channel": "post",
  "data": {
    "id": <number>,
    "response": {
      "type": "info",
      "payload": {
        "type": "l2Book",
        "data": {
          "coin": "ETH",
          "time": <number>,
          "levels": [
            [{"px":"3007.1","sz":"2.7954","n":1}],
            [{"px":"3040.1","sz":"3.9499","n":1}]
          ]
        }
      }
    }
  }
}
Sending an order signed action request:


Copy
{
  "method": "post",
  "id": 256,
  "request": {
    "type": "action",
    "payload": {
      "action": {
        "type": "order",
        "orders": [{"a": 4, "b": true, "p": "1100", "s": "0.2", "r": false, "t": {"limit": {"tif": "Gtc"}}}],
        "grouping": "na"
      },
      "nonce": 1713825891591,
      "signature": {
        "r": "...",
        "s": "...",
        "v": "..."
      },
      "vaultAddress": "0x12...3"
    }
  }
}
Sample response:


Copy
{
  "channel": "post",
  "data": {
    "id": 256,
    "response": {
      "type":"action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [
              {
                "resting": {
                  "oid": 88383,
                }
              }
            ]
          }
        }
      }
    }
  }
}
Previous
Subscriptions
Next
Timeouts and heartbeats
Last updated 11 months ago

For developers
API
Websocket
Timeouts and heartbeats
This page describes the measures to keep WebSocket connections alive.

The server will close any connection if it hasn't sent a message to it in the last 60 seconds. If you are subscribing to a channel that doesn't receive messages every 60 seconds, you can send heartbeat messages to keep your connection alive. The format for these messages are:


Copy
{ "method": "ping" }
The server will respond with:


Copy
{ "channel": "pong" }


For developers
API
Rate limits and user limits
The following rate limits apply per IP address:

REST requests share an aggregated weight limit of 1200 per minute. 

All documented exchange API requests have a weight of 1 + floor(batch_length / 40). For example, unbatched actions have weight 1 and a batched order request of length 79 has weight 2. Here, batch_lengthis the length of the array in the action, e.g. the number of orders in a batched order action.

The following info requests have weight 2: l2Book, allMids, clearinghouseState, orderStatus, spotClearinghouseState, exchangeStatus.

The following info requests have weight 60: userRole .

All other documented info requests have weight 20. 

The following info endpoints have an additional rate limit weight per 20 items returned in the response: recentTrades, historicalOrders, userFills, userFillsByTime, fundingHistory, userFunding, nonUserFundingUpdates, twapHistory, userTwapSliceFills, userTwapSliceFillsByTime, delegatorHistory, delegatorRewards, validatorStats .

The candleSnapshot info endpoint has an additional rate limit weight per 60 items returned in the response.

All explorer API requests have a weight of 40. blockList has an additional rate limit of 1 per block. Note that older blocks which have not been recently queried may be weighted more heavily. For large batch requests, use the S3 bucket instead.

Maximum of 10 websocket connections

Maximum of 30 new websocket connections per minute

Maximum of 1000 websocket subscriptions

Maximum of 10 unique users across user-specific websocket subscriptions

Maximum of 2000 messages sent to Hyperliquid per minute across all websocket connections

Maximum of 100 simultaneous inflight post messages across all websocket connections

Maximum of 100 EVM JSON-RPC requests per minute for rpc.hyperliquid.xyz/evm. Note that other JSON-RPC providers have more sophisticated rate limiting logic and archive node functionality. 

Use websockets for lowest latency realtime data. See the python SDK for a full-featured example.

Address-based limits
Address-based limits apply per user, with sub-accounts treated as separate users.

The rate limiting logic allows 1 request per 1 USDC traded cumulatively since address inception. For example, with an order value of 100 USDC, this requires a fill rate of 1%. Each address starts with an initial buffer of 10000 requests. When rate limited, an address is allowed one request every 10 seconds. Cancels have cumulative limit min(limit + 100000, limit * 2) where limit is the default limit for other actions. This way, hitting the address-based rate limit still allows open orders to be canceled. Note that this rate limit only applies to actions, not info requests. 

Each user has a default open order limit of 1000 plus one additional order for every 5M USDC of volume, capped at a total of 5000 open orders. When an order is placed with at least 1000 other open orders by the same user, it will be rejected if it is reduce-only or a trigger order. 

During high congestion, addresses are limited to use 2x their maker share percentage of the block space. During high traffic, it can therefore be helpful to not resend cancels whose results have already been returned via the API. 

Batched Requests
A batched request with n orders (or cancels) is treated as one request for IP based rate limiting, but as n requests for address-based rate limiting.  