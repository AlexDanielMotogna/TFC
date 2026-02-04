/**
 * TradingView Charting Library Type Definitions
 * These types reference the charting library installed in public/charting_library
 */

// Re-export types from the library's type definitions
export type {
  IChartingLibraryWidget,
  ChartingLibraryWidgetOptions,
  ResolutionString,
  IBasicDataFeed,
  LibrarySymbolInfo,
  DatafeedConfiguration,
  Bar,
  PeriodParams,
  HistoryCallback,
  HistoryMetadata,
  SubscribeBarsCallback,
  SearchSymbolResultItem,
  Timezone,
} from '../../public/charting_library/charting_library';

export type {
  IDatafeedChartApi,
  IExternalDatafeed,
  OnReadyCallback,
  ResolveCallback,
  DatafeedErrorCallback,
  SearchSymbolsCallback,
} from '../../public/charting_library/datafeed-api';

// Extend Window interface for TradingView widget
declare global {
  interface Window {
    TradingView?: {
      widget: new (options: import('../../public/charting_library/charting_library').ChartingLibraryWidgetOptions) => import('../../public/charting_library/charting_library').IChartingLibraryWidget;
    };
  }
}
