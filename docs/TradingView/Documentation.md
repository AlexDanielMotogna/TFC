Module: Datafeed
Datafeed JS API for TradingView Advanced Charts

Enumerations
SearchInitiationPoint
Interfaces
Bar
CurrencyItem
DOMData
DOMLevel
DatafeedConfiguration
DatafeedQuoteValues
DatafeedSymbolType
Exchange
HistoryMetadata
IDatafeedChartApi
IDatafeedQuotesApi
IExternalDatafeed
LibrarySubsessionInfo
LibrarySymbolInfo
Mark
MarkCustomColor
PeriodParams
QuoteDataResponse
QuoteErrorData
QuoteOkData
SearchSymbolResultItem
SymbolInfoPriceSource
SymbolResolveExtension
SymbolSearchPaginatedOptions
TimescaleMark
Unit
Type Aliases
CustomTimezones
Ƭ CustomTimezones: "Africa/Cairo" | "Africa/Casablanca" | "Africa/Johannesburg" | "Africa/Lagos" | "Africa/Nairobi" | "Africa/Tunis" | "America/Anchorage" | "America/Argentina/Buenos_Aires" | "America/Bogota" | "America/Caracas" | "America/Chicago" | "America/El_Salvador" | "America/Juneau" | "America/Lima" | "America/Los_Angeles" | "America/Mexico_City" | "America/New_York" | "America/Phoenix" | "America/Santiago" | "America/Sao_Paulo" | "America/Toronto" | "America/Vancouver" | "Asia/Almaty" | "Asia/Ashkhabad" | "Asia/Bahrain" | "Asia/Bangkok" | "Asia/Chongqing" | "Asia/Colombo" | "Asia/Dhaka" | "Asia/Dubai" | "Asia/Ho_Chi_Minh" | "Asia/Hong_Kong" | "Asia/Jakarta" | "Asia/Jerusalem" | "Asia/Kabul" | "Asia/Karachi" | "Asia/Kathmandu" | "Asia/Kolkata" | "Asia/Kuala_Lumpur" | "Asia/Kuwait" | "Asia/Manila" | "Asia/Muscat" | "Asia/Nicosia" | "Asia/Qatar" | "Asia/Riyadh" | "Asia/Seoul" | "Asia/Shanghai" | "Asia/Singapore" | "Asia/Taipei" | "Asia/Tehran" | "Asia/Tokyo" | "Asia/Yangon" | "Atlantic/Azores" | "Atlantic/Reykjavik" | "Australia/Adelaide" | "Australia/Brisbane" | "Australia/Perth" | "Australia/Sydney" | "Europe/Amsterdam" | "Europe/Athens" | "Europe/Belgrade" | "Europe/Berlin" | "Europe/Bratislava" | "Europe/Brussels" | "Europe/Bucharest" | "Europe/Budapest" | "Europe/Copenhagen" | "Europe/Dublin" | "Europe/Helsinki" | "Europe/Istanbul" | "Europe/Lisbon" | "Europe/London" | "Europe/Luxembourg" | "Europe/Madrid" | "Europe/Malta" | "Europe/Moscow" | "Europe/Oslo" | "Europe/Paris" | "Europe/Prague" | "Europe/Riga" | "Europe/Rome" | "Europe/Stockholm" | "Europe/Tallinn" | "Europe/Vienna" | "Europe/Vilnius" | "Europe/Warsaw" | "Europe/Zurich" | "Pacific/Auckland" | "Pacific/Chatham" | "Pacific/Fakaofo" | "Pacific/Honolulu" | "Pacific/Norfolk" | "US/Mountain"

DOMCallback
Ƭ DOMCallback: (data: DOMData) => void

Type declaration
▸ (data): void

Parameters
Name	Type
data	DOMData
Returns
void

DatafeedErrorCallback
Ƭ DatafeedErrorCallback: (reason: string) => void

Type declaration
▸ (reason): void

Parameters
Name	Type
reason	string
Returns
void

GetMarksCallback
Ƭ GetMarksCallback<T>: (marks: T[]) => void

Type parameters
Name
T
Type declaration
▸ (marks): void

Parameters
Name	Type
marks	T[]
Returns
void

HistoryCallback
Ƭ HistoryCallback: (bars: Bar[], meta?: HistoryMetadata) => void

Type declaration
▸ (bars, meta?): void

Parameters
Name	Type
bars	Bar[]
meta?	HistoryMetadata
Returns
void

LibrarySessionId
Ƭ LibrarySessionId: "regular" | "extended" | "premarket" | "postmarket"

MarkConstColors
Ƭ MarkConstColors: "red" | "green" | "blue" | "yellow"

Nominal
Ƭ Nominal<T, Name>: T & { [species]: Name }

This is the generic type useful for declaring a nominal type, which does not structurally matches with the base type and the other types declared over the same base type

Usage:

Example

type Index = Nominal<number, 'Index'>;
// let i: Index = 42; // this fails to compile
let i: Index = 42 as Index; // OK

Example

type TagName = Nominal<string, 'TagName'>;

Type parameters
Name	Type
T	T
Name	extends string
OnReadyCallback
Ƭ OnReadyCallback: (configuration: DatafeedConfiguration) => void

Type declaration
▸ (configuration): void

Parameters
Name	Type
configuration	DatafeedConfiguration
Returns
void

QuoteData
Ƭ QuoteData: QuoteOkData | QuoteErrorData

QuotesCallback
Ƭ QuotesCallback: (data: QuoteData[]) => void

Type declaration
▸ (data): void

Callback to provide Quote data.

Parameters
Name	Type	Description
data	QuoteData[]	Quote Data
Returns
void

QuotesErrorCallback
Ƭ QuotesErrorCallback: (reason: string) => void

Type declaration
▸ (reason): void

Error callback for quote data request.

Parameters
Name	Type	Description
reason	string	message describing the reason for the error
Returns
void

ResolutionString
Ƭ ResolutionString: Nominal<string, "ResolutionString">

Resolution or time interval is a time period of one bar. Advanced Charts supports tick, intraday (seconds, minutes, hours), and DWM (daily, weekly, monthly) resolutions. The table below describes how to specify different types of resolutions:

Resolution	Format	Example
Ticks	xT	1T — one tick, 5T — five ticks, 100T — one hundred ticks
Seconds	xS	1S — one second
Minutes	x	1 — one minute
Hours	x minutes	60 — one hour
Days	xD	1D — one day
Weeks	xW	1W — one week
Months	xM	1M — one month
Years	xM months	12M — one year
Refer to Resolution for more information.

ResolveCallback
Ƭ ResolveCallback: (symbolInfo: LibrarySymbolInfo) => void

Type declaration
▸ (symbolInfo): void

Parameters
Name	Type
symbolInfo	LibrarySymbolInfo
Returns
void

SearchSymbolsCallback
Ƭ SearchSymbolsCallback: (items: SearchSymbolResultItem[]) => void

Type declaration
▸ (items): void

Parameters
Name	Type
items	SearchSymbolResultItem[]
Returns
void

SearchSymbolsPaginatedCallback
Ƭ SearchSymbolsPaginatedCallback: (items: SearchSymbolResultItem[], symbolsRemaining: number) => void

Type declaration
▸ (items, symbolsRemaining): void

Parameters
Name	Type
items	SearchSymbolResultItem[]
symbolsRemaining	number
Returns
void

SeriesFormat
Ƭ SeriesFormat: "price" | "volume"

ServerTimeCallback
Ƭ ServerTimeCallback: (serverTime: number) => void

Type declaration
▸ (serverTime): void

Parameters
Name	Type
serverTime	number
Returns
void

SubscribeBarsCallback
Ƭ SubscribeBarsCallback: (bar: Bar) => void

Type declaration
▸ (bar): void

Parameters
Name	Type
bar	Bar
Returns
void

TimeScaleMarkShape
Ƭ TimeScaleMarkShape: "circle" | "earningUp" | "earningDown" | "earning"

Timezone
Ƭ Timezone: "Etc/UTC" | CustomTimezones

VisiblePlotsSet
Ƭ VisiblePlotsSet: "ohlcv" | "ohlc" | "c" | "hlc"



Widget Constructor
The Widget Constructor is the entry point to the library. It allows you to embed the library within your web page. You can use the Widget Constructor parameters to customize the widget's appearance and behavior. All parameters are listed in the ChartingLibraryWidgetOptions interface. If you use Trading Platform, you can specify some additional parameters.

The following video tutorial describes Widget Constructor parameters and demonstrates how to use them.



The code sample below shows how to adjust some basic parameters using Widget Constructor.


Advanced Charts parameters
The following parameters relate to Advanced Charts and Trading Platform.

Widget configuration
Use the parameters below to configure basic widget settings:

Parameter	Description
container#	Represents either a reference to an attribute of a DOM element inside which the iframe with the chart will be placed or the HTMLElement itself.
library_path#	A path to a static folder.
debug#	Makes the library write detailed Datafeed API logs into the browser console. Refer to How to enable debug mode for more information.
Chart configuration
Use the parameters below to configure basic chart settings:

Parameter	Description
symbol#	The default chart symbol.
interval#	The default chart interval.
timeframe#	The default chart time frame.
time_frames#	The list of visible time frames that can be selected at the bottom of the chart.
timezone#	The default chart time zone.
locale#	The default chart locale.
favorites#	Items that should be marked as favorite by default.
Data configuration
Use the parameters below to connect data to the chart:

Parameter	Description
datafeed#	A JavaScript object that implements the IBasicDataFeed interface to supply the chart with data.
additional_symbol_info_fields#	An optional field containing an array of custom symbol info fields to be shown in the Security Info dialog.
snapshot_url#	A URL that is used to send a POST request with binary chart snapshots when a user presses the snapshot button.
Chart size
Use the parameters below to customize the chart size:

Parameter	Description
width#	The desired width of the widget.
height#	The desired height of the widget.
fullscreen#	A Boolean value showing whether the chart should use all the available space in the window.
autosize#	A Boolean value showing whether the chart should use all the available space in the container and resize when the container itself is resized.
UI customization
Use the parameters below to customize colors, fonts, price and date formats, and more:

Parameter	Description
toolbar_bg#	A background color of the toolbars.
theme#	The predefined custom theme color for the chart.
custom_themes#	The custom color palette.
custom_css_url#	Adds your custom CSS to the chart.
custom_font_family#	Changes the font family used on the chart.
custom_formatters#	Custom formatters for adjusting the display format of price, date, and time values.
custom_translate_function#	Use this property to set custom translations for UI elements.
numeric_formatting#	An object that contains formatting options for numbers.
overrides#	Overrides values for the default widget properties.
settings_overrides#	An object that contains new values for values saved to the settings.
loading_screen#	An object that allows you to customize the loading spinner.
context_menu#	A property that allows you to customize the context menu.
time_scale#	An additional optional field to add more bars on screen.
header_widget_buttons_mode#	An additional optional field to change the look and feel of buttons on the top toolbar.
Chart features
If you want to change the chart's behavior or show/hide UI elements, you should use featuresets. The following parameters allow you to enable/disable a certain featureset:

Parameter	Description
enabled_features#	The array containing names of features that should be enabled by default.
disabled_features#	The array containing names of features that should be disabled by default.
Indicators and drawings
Use the parameters below to customize indicators (studies) and drawings:

Parameter	Description
study_count_limit#	Maximum amount of studies allowed at one time within the layout.
studies_access#	An object that allows you to specify indicators available for users.
studies_overrides#	Use this option to customize the style or inputs of the indicators. Refer to Indicator Overrides for more information.
custom_indicators_getter#	A function that returns the Promise object with the array of your custom indicators.
drawings_access#	An object that allows you to specify drawing tools available for users.
Symbol search and comparison
Use the parameters below to customize the Symbol Search:

Parameter	Description
symbol_search_request_delay#	A threshold delay in milliseconds that is used to reduce the number of search requests when the user enters the symbol name in the Symbol Search.
symbol_search_complete#	Takes an additional search result object parameter, and returns an additional human-friendly symbol name.
compare_symbols#	An array of custom compare symbols for the Compare window.
Saving and loading chart
The following properties are used for saving and loading charts. For a detailed guide on which save/load approach to choose, see Saving and loading charts.

High-level APIs
Specify the following parameters to save/load a chart using the high-level APIs (REST API or API handlers).

Parameter	Description	API type
charts_storage_url#	A storage URL endpoint.	REST API
charts_storage_api_version#	A version of your backend. Supported values are: 1.0 or 1.1.	REST API
client_id#	A client ID that represents a user group.	REST API
user_id#	A user ID that uniquely identifies each user within a client_id group.	REST API
save_load_adapter#	An object containing your custom save/load functions.	API handlers
load_last_chart#	A Boolean value showing whether the library should load the last saved chart for a user.	REST API or API handlers
Low-level API
Specify the following parameters to save/load a chart using the low-level API:

Parameter	Description
auto_save_delay#	A threshold delay in seconds that is used to reduce the number of onAutoSaveNeeded calls.
saved_data#	An object containing saved chart layout.
saved_data_meta_info#	An object containing saved chart content meta info.
User settings
User settings are stored independently of chart layouts to ensure that users have control over their specific preferences. Use settings_adapter to save user settings.

Trading Platform parameters
All Trading Platform parameters are listed in the TradingTerminalWidgetOptions interface. Most of them duplicate the Advanced Charts parameters. Additional parameters are listed below:

Parameter	Description
broker_config#	Configuration flags for Trading Platform. Refer to Trading features configuration for more information.
debug_broker#	Makes the library write detailed Broker API and Trading Host logs into the browser console. Refer to How to enable debug mode for more information.
restConfig#	Connection configuration settings for the Broker API.
widgetbar#	Settings for the widget panel on the right side of the chart. You can enable Watchlist, News, Details and Data Window widgets on the right side of the chart using this property.
rss_news_feed#	Use this property to change the RSS feed for news.
rss_news_title#	Use this property to change the title for news widget when using a RSS feed.
news_provider#	Use this property to set your own news getter function.
trading_customization#	Overrides order and position lines created using the createOrderLine and createPositionLine methods.