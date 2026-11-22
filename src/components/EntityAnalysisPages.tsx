import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Info } from 'lucide-react';
import type {
  AggregatedMetrics,
  AppSettings,
  DailyMetricPoint,
  EntitySummary,
} from '../types/rtb';
import { formatCount, formatCurrency, formatDelta, formatPercent } from '../utils/rtbEngine';
import {
  BidRequestsVsResponsesChart,
  PublisherRevenueChart,
  SspPerformanceChart,
  SubmittedBidsVsWinsChart,
} from './ChartsPanel';

type SortKey =
  | 'name'
  | 'totalBidRequests'
  | 'totalBidResponses'
  | 'totalSubmittedBids'
  | 'totalAuctionWins'
  | 'totalImpressions'
  | 'totalRevenue'
  | 'cpm'
  | 'bidResponseRate'
  | 'winRate'
  | 'renderRate';

function useSortableEntities(entities: EntitySummary[]) {
  const [sortKey, setSortKey] = useState<SortKey>('totalRevenue');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...entities];
    copy.sort((a, b) => {
      if (sortKey === 'name') {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const va = a[sortKey] ?? -Infinity;
      const vb = b[sortKey] ?? -Infinity;
      return sortAsc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
    return copy;
  }, [entities, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return { sorted, sortKey, sortAsc, toggleSort };
}

/* -------------------------------------------------------------------------- */
/* CAMPAIGN ANALYSIS VIEW                                                     */
/* -------------------------------------------------------------------------- */

interface CampaignAnalysisProps {
  campaigns: EntitySummary[];
  daily: DailyMetricPoint[];
  metrics: AggregatedMetrics;
  settings: AppSettings;
}

export const CampaignAnalysisView: React.FC<CampaignAnalysisProps> = ({
  campaigns,
  daily,
  metrics,
  settings,
}) => {
  const { sorted, toggleSort } = useSortableEntities(campaigns);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            Campaign Analysis
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Bid funnel efficiency, delivery rates, and campaign-level revenue performance
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Win Rate Definition:{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {settings.winRateDefinition === 'wins_over_submitted'
              ? 'Auction Wins / Submitted Bids'
              : 'Auction Wins / Bid Responses'}
          </span>
        </div>
      </div>

      {/* Delivery & Funnel Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Bid Participation Rate', value: formatPercent(metrics.bidParticipationRate), note: 'Submitted Bids / Requests' },
          { label: 'Render Rate', value: formatPercent(metrics.renderRate), note: 'Impressions / Auction Wins' },
          {
            label: 'Fill Rate',
            value: formatPercent(metrics.fillRate),
            note: metrics.fillRate !== null ? 'Impressions / Eligible Ad Requests' : 'Requires Eligible Ad Requests',
          },
          { label: 'Avg Daily Bid Responses', value: formatCount(metrics.avgDailyBidResponses, settings.numberFormat), note: `Across ${metrics.distinctDays} days` },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
            <div className="text-xl font-display font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
              {item.value}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{item.note}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <BidRequestsVsResponsesChart daily={daily} settings={settings} />
        <SubmittedBidsVsWinsChart daily={daily} settings={settings} />
      </div>

      <EntityMetricsTable
        title="Campaign Performance Breakdown"
        entities={sorted}
        settings={settings}
        includeRenderRate
        onSort={toggleSort}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* PUBLISHER ANALYSIS VIEW                                                    */
/* -------------------------------------------------------------------------- */

interface PublisherAnalysisProps {
  publishers: EntitySummary[];
  settings: AppSettings;
}

export const PublisherAnalysisView: React.FC<PublisherAnalysisProps> = ({
  publishers,
  settings,
}) => {
  const { sorted, toggleSort } = useSortableEntities(publishers);

  const topByRevenue = useMemo(
    () => [...publishers].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5),
    [publishers],
  );
  const topByCpm = useMemo(
    () => [...publishers].sort((a, b) => (b.cpm ?? -1) - (a.cpm ?? -1)).slice(0, 5),
    [publishers],
  );
  const decliningRevenue = useMemo(
    () => publishers.filter((p) => p.revenueTrendPct !== null && p.revenueTrendPct <= -10),
    [publishers],
  );
  const highFluctuation = useMemo(
    () => publishers.filter((p) => p.volatilityScore !== null && p.volatilityScore >= 25),
    [publishers],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
          Publisher Analysis
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Revenue rankings, CPM yield, declining trend detection, and volatility across publishers
        </p>
      </div>

      {/* Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Top 5 Publishers by Revenue
          </h3>
          <div className="space-y-2 text-xs">
            {topByRevenue.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700 dark:text-slate-300">{p.name}</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                  {formatCurrency(p.totalRevenue, settings.currency, settings.numberFormat)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Top 5 Publishers by CPM
          </h3>
          <div className="space-y-2 text-xs">
            {topByCpm.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700 dark:text-slate-300">{p.name}</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                  {formatCurrency(p.cpm, settings.currency, 'standard', 2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Declining Revenue (&le; -10% Half-Period)
          </h3>
          {decliningRevenue.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No publishers declined more than 10% between the first and second halves of the selected window.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {decliningRevenue.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700 dark:text-slate-300">{p.name}</span>
                  <span className="font-mono tabular-nums font-semibold text-red-600 dark:text-red-400 shrink-0">
                    {formatDelta(p.revenueTrendPct)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-3">
            Unusual Performance Fluctuations (CV &ge; 25%)
          </h3>
          {highFluctuation.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily revenue volatility across publishers remained within normal variance.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {highFluctuation.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700 dark:text-slate-300">{p.name}</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                    CV {p.volatilityScore?.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PublisherRevenueChart entities={publishers} settings={settings} />

      <EntityMetricsTable
        title="Publisher Performance Table (Click Any Header to Sort)"
        entities={sorted}
        settings={settings}
        includeRenderRate={false}
        onSort={toggleSort}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* SSP ANALYSIS VIEW                                                          */
/* -------------------------------------------------------------------------- */

interface SspAnalysisProps {
  ssps: EntitySummary[];
  settings: AppSettings;
}

export const SspAnalysisView: React.FC<SspAnalysisProps> = ({ ssps, settings }) => {
  const { sorted, toggleSort } = useSortableEntities(ssps);

  const highestRev = useMemo(
    () => [...ssps].sort((a, b) => b.totalRevenue - a.totalRevenue)[0] ?? null,
    [ssps],
  );
  const highestCpm = useMemo(
    () => [...ssps].sort((a, b) => (b.cpm ?? -1) - (a.cpm ?? -1))[0] ?? null,
    [ssps],
  );
  const highestWinRate = useMemo(
    () => [...ssps].sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1))[0] ?? null,
    [ssps],
  );
  const lowestBrr = useMemo(
    () =>
      [...ssps]
        .filter((s) => s.bidResponseRate !== null)
        .sort((a, b) => (a.bidResponseRate ?? 999) - (b.bidResponseRate ?? 999))[0] ?? null,
    [ssps],
  );
  const significantChanges = useMemo(
    () => ssps.filter((s) => s.revenueTrendPct !== null && Math.abs(s.revenueTrendPct) >= 10),
    [ssps],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
          SSP Analysis
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Multi-metric exchange comparison across bid response, win rate, render rate, and eCPM yield
        </p>
      </div>

      {/* Mandatory balanced interpretation notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900 dark:text-white">
            Multi-Factor SSP Evaluation Context:
          </span>{' '}
          No SSP should be judged objectively best from a single metric alone. Evaluate exchange partners in
          relation to inventory quality, traffic volume scale, endpoint latency (timeout rate), auction mechanics
          (first-price shading vs floor rules), and commercial fee/rev-share agreements.
        </div>
      </div>

      {/* SSP Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Highest Revenue SSP</div>
          <div className="font-semibold text-sm text-slate-900 dark:text-white mt-1 truncate">
            {highestRev?.name ?? 'N/A'}
          </div>
          <div className="text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {highestRev ? formatCurrency(highestRev.totalRevenue, settings.currency, settings.numberFormat) : 'N/A'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Highest CPM SSP</div>
          <div className="font-semibold text-sm text-slate-900 dark:text-white mt-1 truncate">
            {highestCpm?.name ?? 'N/A'}
          </div>
          <div className="text-xs font-mono tabular-nums text-teal-600 dark:text-teal-400 mt-1">
            {highestCpm ? formatCurrency(highestCpm.cpm, settings.currency, 'standard', 2) : 'N/A'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Highest Win-Rate SSP</div>
          <div className="font-semibold text-sm text-slate-900 dark:text-white mt-1 truncate">
            {highestWinRate?.name ?? 'N/A'}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 mt-1">
            {highestWinRate ? formatPercent(highestWinRate.winRate) : 'N/A'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Lowest Bid Response Rate</div>
          <div className="font-semibold text-sm text-slate-900 dark:text-white mt-1 truncate">
            {lowestBrr?.name ?? 'N/A'}
          </div>
          <div className="text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {lowestBrr ? formatPercent(lowestBrr.bidResponseRate) : 'N/A'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">Significant Changes (&ge;10%)</div>
          {significantChanges.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">Stable across period</div>
          ) : (
            <div className="mt-1 space-y-1 text-xs">
              {significantChanges.slice(0, 2).map((s) => (
                <div key={s.name} className="flex justify-between gap-2">
                  <span className="truncate text-slate-800 dark:text-slate-200">{s.name}</span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {formatDelta(s.revenueTrendPct)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SspPerformanceChart entities={ssps} settings={settings} />

      <EntityMetricsTable
        title="SSP Partner Comparison Table (Click Any Header to Sort)"
        entities={sorted}
        settings={settings}
        includeRenderRate
        onSort={toggleSort}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* SHARED SORTABLE ENTITY TABLE                                               */
/* -------------------------------------------------------------------------- */

interface EntityMetricsTableProps {
  title: string;
  entities: EntitySummary[];
  settings: AppSettings;
  includeRenderRate: boolean;
  onSort: (key: SortKey) => void;
}

const EntityMetricsTable: React.FC<EntityMetricsTableProps> = ({
  title,
  entities,
  settings,
  includeRenderRate,
  onSort,
}) => {
  const columns: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'name', label: 'Name', align: 'left' },
    { key: 'totalBidRequests', label: 'Bid Requests', align: 'right' },
    { key: 'totalBidResponses', label: 'Bid Responses', align: 'right' },
    { key: 'totalSubmittedBids', label: 'Submitted Bids', align: 'right' },
    { key: 'totalAuctionWins', label: 'Auction Wins', align: 'right' },
    { key: 'totalImpressions', label: 'Impressions', align: 'right' },
    { key: 'totalRevenue', label: 'Revenue', align: 'right' },
    { key: 'cpm', label: 'CPM/eCPM', align: 'right' },
    { key: 'bidResponseRate', label: 'Bid Resp Rate', align: 'right' },
    { key: 'winRate', label: 'Win Rate', align: 'right' },
  ];

  if (includeRenderRate) {
    columns.push({ key: 'renderRate', label: 'Render Rate', align: 'right' });
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">{title}</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {entities.length} records
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3.5 py-3 font-semibold whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 ${
                      col.align === 'right' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <span>{col.label}</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {entities.map((e) => (
              <tr key={e.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                  {e.name}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCount(e.totalBidRequests, settings.numberFormat)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCount(e.totalBidResponses, settings.numberFormat)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCount(e.totalSubmittedBids, settings.numberFormat)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCount(e.totalAuctionWins, settings.numberFormat)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCount(e.totalImpressions, settings.numberFormat)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(e.totalRevenue, settings.currency, settings.numberFormat)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(e.cpm, settings.currency, 'standard', 2)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatPercent(e.bidResponseRate)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {formatPercent(e.winRate)}
                </td>
                {includeRenderRate && (
                  <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatPercent(e.renderRate)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
