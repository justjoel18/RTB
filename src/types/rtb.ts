export type NavSection =
  | 'overview'
  | 'campaigns'
  | 'publishers'
  | 'ssps'
  | 'trends'
  | 'ai-insights'
  | 'reports'
  | 'settings';

export type WinRateDefinition = 'wins_over_submitted' | 'wins_over_responses';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY';

export type NumberFormatMode = 'compact' | 'standard';

export type ThemePreference = 'light' | 'dark';

export type DefaultDatePreset = 'all' | '7d' | '14d' | '30d';

export interface AnomalyThresholds {
  revenueChangePct: number; // default 20
  impressionChangePct: number; // default 20
  cpmChangePct: number; // default 25
  bidResponseRateChangePts: number; // default 15
  winRateChangePts: number; // default 15
  trafficSurgePct: number; // default 35
}

export interface AppSettings {
  currency: CurrencyCode;
  defaultDatePreset: DefaultDatePreset;
  winRateDefinition: WinRateDefinition;
  anomalyThresholds: AnomalyThresholds;
  numberFormat: NumberFormatMode;
  theme: ThemePreference;
}

export interface RtbRecord {
  date: string; // YYYY-MM-DD
  bidRequests: number | null;
  bidResponses: number | null;
  submittedBids: number | null;
  auctionWins: number | null;
  impressions: number | null;
  revenue: number | null;
  eligibleAdRequests: number | null;
  publisher: string;
  ssp: string;
  campaign: string;
  adUnit: string;
  country: string;
  device: string;
}

export type StandardFieldKey =
  | 'date'
  | 'bidRequests'
  | 'bidResponses'
  | 'submittedBids'
  | 'auctionWins'
  | 'impressions'
  | 'revenue'
  | 'eligibleAdRequests'
  | 'publisher'
  | 'ssp'
  | 'campaign'
  | 'adUnit'
  | 'country'
  | 'device';

export type ColumnMapping = Record<StandardFieldKey, string | null>;

export interface RejectedRowInfo {
  rowNumber: number;
  reasons: string[];
  rawPreview: Record<string, string>;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingValuesCount: number;
  duplicateCount: number;
  importedRows: number;
  rejectedRows: RejectedRowInfo[];
}

export interface DatasetMetadata {
  sourceName: string;
  isDemoData: boolean;
  uploadedAt: string;
  mappedFields: Record<StandardFieldKey, boolean>;
  missingRequiredFields: StandardFieldKey[];
  uncalculableMetrics: { metric: string; reason: string }[];
  importSummary: ImportSummary;
}

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  publisher: string;
  ssp: string;
  campaign: string;
  country: string;
  device: string;
}

export interface PeriodComparison {
  revenueChangePct: number | null;
  impressionChangePct: number | null;
  cpmChangePct: number | null;
  hasComparablePriorPeriod: boolean;
  priorStartDate: string | null;
  priorEndDate: string | null;
  reasonIfUnavailable?: string;
}

export interface AggregatedMetrics {
  totalBidRequests: number | null;
  totalBidResponses: number | null;
  totalSubmittedBids: number | null;
  totalAuctionWins: number | null;
  totalImpressions: number | null;
  totalRevenue: number | null;
  totalEligibleAdRequests: number | null;

  bidResponseRate: number | null;
  bidParticipationRate: number | null;
  winRate: number | null;
  renderRate: number | null;
  fillRate: number | null;
  cpm: number | null;
  avgDailyBidResponses: number | null;
  distinctDays: number;
  recordCount: number;
  comparison: PeriodComparison;
  unavailableMetrics: { metric: string; reason: string }[];
}

export interface DailyMetricPoint {
  date: string;
  bidRequests: number;
  bidResponses: number;
  submittedBids: number;
  auctionWins: number;
  impressions: number;
  revenue: number;
  eligibleAdRequests: number;
  cpm: number | null;
  bidResponseRate: number | null;
  winRate: number | null;
  renderRate: number | null;
}

export interface EntitySummary {
  name: string;
  totalBidRequests: number;
  totalBidResponses: number;
  totalSubmittedBids: number;
  totalAuctionWins: number;
  totalImpressions: number;
  totalRevenue: number;
  totalEligibleAdRequests: number;
  cpm: number | null;
  bidResponseRate: number | null;
  bidParticipationRate: number | null;
  winRate: number | null;
  renderRate: number | null;
  fillRate: number | null;
  revenueSharePct: number | null;
  revenueTrendPct: number | null;
  volatilityScore: number | null; // std dev / mean of daily revenue
}

export type AnomalySeverity = 'High' | 'Medium' | 'Low';

export type AnomalyType =
  | 'Impression Drop'
  | 'Revenue Drop'
  | 'CPM Shift'
  | 'Bid Response Deterioration'
  | 'Win Rate Deterioration'
  | 'Traffic Surge'
  | 'Zero-Impression Period'
  | 'Missing Reporting Date';

export interface DetectedAnomaly {
  id: string;
  type: AnomalyType;
  affectedDate: string;
  entityType: 'Overall' | 'Publisher' | 'SSP';
  entityName: string;
  previousValue: number | null;
  currentValue: number | null;
  percentageChange: number | null;
  unit: 'currency' | 'count' | 'percent' | 'cpm' | 'days';
  severity: AnomalySeverity;
  summary: string;
  suggestedInvestigationSteps: string[];
}

export interface AiCampaignAnalysis {
  executiveSummary: string;
  performanceAnalysis: {
    bidResponse: string;
    winRate: string;
    impressionDelivery: string;
    revenueTrends: string;
    cpmChanges: string;
    publisherPerformance: string;
    sspPerformance: string;
  };
  anomalyExplanations: {
    anomalyRef: string;
    whatChanged: string;
    possibleCauses: string[];
    investigationSteps: string[];
    additionalDataNeeded: string[];
  }[];
  optimizationRecommendations: {
    category: string;
    priority: 'High' | 'Medium' | 'Low';
    title: string;
    recommendation: string;
    supportingMetrics: string[];
    assumptions: string[];
    missingInformation: string[];
    factsVsHypotheses: string;
  }[];
  confidenceAndLimitations: {
    overallConfidenceNote: string;
    dataGaps: string[];
    methodologicalNotes: string[];
  };
}
