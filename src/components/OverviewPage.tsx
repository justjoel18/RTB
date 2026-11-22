import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import type {
  AggregatedMetrics,
  AppSettings,
  DailyMetricPoint,
  DatasetMetadata,
  DetectedAnomaly,
  EntitySummary,
  NavSection,
} from '../types/rtb';
import {
  formatCount,
  formatCurrency,
  formatDelta,
  formatPercent,
} from '../utils/rtbEngine';
import {
  BidRequestsVsResponsesChart,
  DailyCpmChart,
  DailyImpressionsChart,
  DailyRevenueChart,
  PublisherRevenueChart,
  RevenueDistributionChart,
  SspPerformanceChart,
  SubmittedBidsVsWinsChart,
} from './ChartsPanel';

interface OverviewPageProps {
  metrics: AggregatedMetrics;
  daily: DailyMetricPoint[];
  publishers: EntitySummary[];
  ssps: EntitySummary[];
  anomalies: DetectedAnomaly[];
  metadata: DatasetMetadata;
  settings: AppSettings;
  onNavigate: (section: NavSection) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  metrics,
  daily,
  publishers,
  ssps,
  anomalies,
  metadata,
  settings,
  onNavigate,
}) => {
  const winRateSubtitle =
    settings.winRateDefinition === 'wins_over_submitted'
      ? 'Formula: Auction Wins / Submitted Bids'
      : 'Formula: Auction Wins / Bid Responses';

  const renderDeltaBadge = (delta: number | null) => {
    if (delta === null) {
      return (
        <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
          Prior period: N/A
        </span>
      );
    }
    const positive = delta >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${
          positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}
      >
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {formatDelta(delta)} vs prior period
      </span>
    );
  };

  const kpiCards = [
    {
      label: 'Total Bid Requests',
      value: formatCount(metrics.totalBidRequests, settings.numberFormat),
      sub: `${metrics.distinctDays} active reporting days`,
      delta: null,
    },
    {
      label: 'Total Bid Responses',
      value: formatCount(metrics.totalBidResponses, settings.numberFormat),
      sub: `Avg ${formatCount(metrics.avgDailyBidResponses, settings.numberFormat)} / day`,
      delta: null,
    },
    {
      label: 'Bid Response Rate',
      value: formatPercent(metrics.bidResponseRate),
      sub: 'Bid Responses / Bid Requests',
      delta: null,
    },
    {
      label: 'Submitted Bids',
      value: formatCount(metrics.totalSubmittedBids, settings.numberFormat),
      sub: `Participation: ${formatPercent(metrics.bidParticipationRate)}`,
      delta: null,
    },
    {
      label: 'Auction Wins',
      value: formatCount(metrics.totalAuctionWins, settings.numberFormat),
      sub: `Render Rate: ${formatPercent(metrics.renderRate)}`,
      delta: null,
    },
    {
      label: 'Win Rate',
      value: formatPercent(metrics.winRate),
      sub: winRateSubtitle,
      delta: null,
    },
    {
      label: 'Total Impressions',
      value: formatCount(metrics.totalImpressions, settings.numberFormat),
      sub:
        metrics.fillRate !== null
          ? `Fill Rate: ${formatPercent(metrics.fillRate)}`
          : 'Fill Rate: N/A (Eligible Requests unmapped)',
      delta: metrics.comparison.impressionChangePct,
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(metrics.totalRevenue, settings.currency, settings.numberFormat),
      sub: `Currency: ${settings.currency}`,
      delta: metrics.comparison.revenueChangePct,
    },
    {
      label: 'Average CPM / eCPM',
      value: formatCurrency(metrics.cpm, settings.currency, 'standard', 2),
      sub: '(Revenue / Impressions) × 1,000',
      delta: metrics.comparison.cpmChangePct,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Synthetic Demo Banner or Missing Metric Disclosure */}
      {metadata.isDemoData && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 text-teal-400 shrink-0" />
            <span>
              <strong className="font-semibold text-white">Synthetic Demo Data:</strong> Displaying a
              30-day fictional RTB dataset with intentional fluctuations for testing analytics and anomaly detection.
              Do not treat demo numbers as real publisher or advertiser results.
            </span>
          </div>
        </div>
      )}

      {(metrics.unavailableMetrics.length > 0 || !metrics.comparison.hasComparablePriorPeriod) && (
        <div className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
          {metrics.unavailableMetrics.map((m, idx) => (
            <div key={idx}>
              <span className="font-semibold">{m.metric} unavailable:</span> {m.reason}
            </div>
          ))}
          {!metrics.comparison.hasComparablePriorPeriod && metrics.comparison.reasonIfUnavailable && (
            <div>
              <span className="font-semibold">Period-over-period comparison:</span>{' '}
              {metrics.comparison.reasonIfUnavailable}
            </div>
          )}
        </div>
      )}

      {/* 9 Core KPI Cards */}
      <section aria-label="Key Performance Indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between"
            >
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.label}
              </div>
              <div className="text-2xl font-display font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-2">
                {card.value}
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{card.sub}</span>
                {card.delta !== undefined && renderDeltaBadge(card.delta)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Primary Charts Grid (All 8 required charts accessible cleanly) */}
      <section aria-label="Campaign Charts" className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DailyRevenueChart daily={daily} settings={settings} />
        <DailyImpressionsChart daily={daily} settings={settings} />
        <DailyCpmChart daily={daily} settings={settings} />
        <RevenueDistributionChart entities={ssps} settings={settings} dimensionLabel="SSP" />
        <BidRequestsVsResponsesChart daily={daily} settings={settings} />
        <SubmittedBidsVsWinsChart daily={daily} settings={settings} />
        <PublisherRevenueChart entities={publishers} settings={settings} />
        <SspPerformanceChart entities={ssps} settings={settings} />
      </section>

      {/* Rule-Based Anomaly Snapshot */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Rule-Based Anomaly Triggers ({anomalies.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Deterministic threshold checks for AdOps investigation (not confirmed outages or fraud)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('trends')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Inspect All Anomalies
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ai-insights')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors"
            >
              Explain with AI Insights
            </button>
          </div>
        </div>

        {anomalies.length === 0 ? (
          <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
            No anomalies exceeded the configured thresholds for the active filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {anomalies.slice(0, 5).map((a) => (
              <div key={a.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-3 min-w-0">
                  <AlertTriangle
                    className={`h-4 w-4 shrink-0 mt-0.5 ${
                      a.severity === 'High'
                        ? 'text-red-600 dark:text-red-400'
                        : a.severity === 'Medium'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {a.type} · {a.entityName} ({a.entityType})
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 mt-0.5">{a.summary}</div>
                  </div>
                </div>
                <div className="text-right shrink-0 font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  <div>{a.affectedDate}</div>
                  <div className="text-[11px]">Severity: {a.severity}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
