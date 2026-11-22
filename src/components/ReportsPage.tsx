import React, { useState } from 'react';
import Papa from 'papaparse';
import { Download, FileText, Printer } from 'lucide-react';
import type {
  AggregatedMetrics,
  AiCampaignAnalysis,
  AppSettings,
  DailyMetricPoint,
  DatasetMetadata,
  DetectedAnomaly,
  EntitySummary,
  RtbRecord,
} from '../types/rtb';
import { formatCount, formatCurrency, formatDelta, formatPercent } from '../utils/rtbEngine';
import { DailyCpmChart, DailyRevenueChart } from './ChartsPanel';

type ReportType = 'executive' | 'detailed' | 'publishers' | 'ssps';

interface ReportsPageProps {
  metadata: DatasetMetadata;
  filteredRecords: RtbRecord[];
  metrics: AggregatedMetrics;
  daily: DailyMetricPoint[];
  publishers: EntitySummary[];
  ssps: EntitySummary[];
  anomalies: DetectedAnomaly[];
  startDate: string;
  endDate: string;
  settings: AppSettings;
  aiAnalysis: AiCampaignAnalysis | null;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  metadata,
  filteredRecords,
  metrics,
  daily,
  publishers,
  ssps,
  anomalies,
  startDate,
  endDate,
  settings,
  aiAnalysis,
}) => {
  const [reportType, setReportType] = useState<ReportType>('executive');

  const reportTitles: Record<ReportType, string> = {
    executive: 'Executive Campaign Summary Report',
    detailed: 'Detailed RTB Performance Report',
    publishers: 'Publisher Comparison Report',
    ssps: 'SSP Partner Comparison Report',
  };

  const handleDownloadCsv = () => {
    const csvData = Papa.unparse(
      filteredRecords.map((r) => ({
        Date: r.date,
        Publisher: r.publisher,
        SSP: r.ssp,
        Campaign: r.campaign,
        Ad_Unit: r.adUnit,
        Country: r.country,
        Device: r.device,
        Bid_Requests: r.bidRequests ?? '',
        Bid_Responses: r.bidResponses ?? '',
        Submitted_Bids: r.submittedBids ?? '',
        Auction_Wins: r.auctionWins ?? '',
        Impressions: r.impressions ?? '',
        Revenue: r.revenue ?? '',
        Eligible_Ad_Requests: r.eligibleAdRequests ?? '',
      })),
    );
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rtb-intelligence-${reportType}-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Controls bar (hidden in print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-1" />
          {(
            [
              { id: 'executive', label: 'Executive Summary' },
              { id: 'detailed', label: 'Detailed RTB' },
              { id: 'publishers', label: 'Publisher Comparison' },
              { id: 'ssps', label: 'SSP Comparison' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                reportType === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Filtered CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Report Canvas */}
      <article className="print-only-container bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
        {/* Report Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              RTB Intelligence · Smarter Insights for Programmatic Advertising
            </div>
            <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-white mt-1">
              {reportTitles[reportType]}
            </h1>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 space-y-0.5">
              <div>
                <span className="font-semibold">Reporting Period:</span> {startDate} to {endDate} (
                {metrics.distinctDays} reporting days)
              </div>
              <div>
                <span className="font-semibold">Data Source:</span> {metadata.sourceName} (
                {filteredRecords.length.toLocaleString()} filtered records
                {metadata.isDemoData ? ' — Synthetic Demo Data' : ''})
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <div>Generated: {new Date().toLocaleDateString()}</div>
            <div>Currency: {settings.currency}</div>
          </div>
        </header>

        {/* KPI Summary Grid */}
        <section className="print-break-inside-avoid">
          <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white mb-3">
            1. KPI Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Revenue', val: formatCurrency(metrics.totalRevenue, settings.currency, settings.numberFormat) },
              { label: 'Total Impressions', val: formatCount(metrics.totalImpressions, settings.numberFormat) },
              { label: 'Average CPM', val: formatCurrency(metrics.cpm, settings.currency, 'standard', 2) },
              { label: 'Bid Response Rate', val: formatPercent(metrics.bidResponseRate) },
              { label: 'Win Rate', val: formatPercent(metrics.winRate) },
              { label: 'Bid Requests', val: formatCount(metrics.totalBidRequests, settings.numberFormat) },
              { label: 'Bid Responses', val: formatCount(metrics.totalBidResponses, settings.numberFormat) },
              { label: 'Submitted Bids', val: formatCount(metrics.totalSubmittedBids, settings.numberFormat) },
              { label: 'Auction Wins', val: formatCount(metrics.totalAuctionWins, settings.numberFormat) },
              { label: 'Render Rate', val: formatPercent(metrics.renderRate) },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
              >
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{kpi.label}</div>
                <div className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {kpi.val}
                </div>
              </div>
            ))}
          </div>
          {metrics.comparison.hasComparablePriorPeriod && (
            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              Prior-period change ({metrics.comparison.priorStartDate} to {metrics.comparison.priorEndDate}):
              Revenue {formatDelta(metrics.comparison.revenueChangePct)} · Impressions{' '}
              {formatDelta(metrics.comparison.impressionChangePct)} · CPM{' '}
              {formatDelta(metrics.comparison.cpmChangePct)}
            </div>
          )}
        </section>

        {/* Performance Charts */}
        {(reportType === 'executive' || reportType === 'detailed') && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 print-break-inside-avoid">
            <DailyRevenueChart daily={daily} settings={settings} />
            <DailyCpmChart daily={daily} settings={settings} />
          </section>
        )}

        {/* Publisher Analysis */}
        {(reportType === 'executive' || reportType === 'detailed' || reportType === 'publishers') && (
          <section className="print-break-inside-avoid space-y-2">
            <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              2. Publisher Analysis
            </h2>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Publisher</th>
                    <th className="px-3 py-2 text-right">Requests</th>
                    <th className="px-3 py-2 text-right">Impressions</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">CPM</th>
                    <th className="px-3 py-2 text-right">Bid Resp Rate</th>
                    <th className="px-3 py-2 text-right">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {publishers.map((p) => (
                    <tr key={p.name}>
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCount(p.totalBidRequests, settings.numberFormat)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCount(p.totalImpressions, settings.numberFormat)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{formatCurrency(p.totalRevenue, settings.currency, settings.numberFormat)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(p.cpm, settings.currency, 'standard', 2)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatPercent(p.bidResponseRate)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatPercent(p.winRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* SSP Analysis */}
        {(reportType === 'executive' || reportType === 'detailed' || reportType === 'ssps') && (
          <section className="print-break-inside-avoid space-y-2">
            <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              3. SSP Partner Analysis
            </h2>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">SSP / Exchange</th>
                    <th className="px-3 py-2 text-right">Requests</th>
                    <th className="px-3 py-2 text-right">Impressions</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">CPM</th>
                    <th className="px-3 py-2 text-right">Win Rate</th>
                    <th className="px-3 py-2 text-right">Render Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {ssps.map((s) => (
                    <tr key={s.name}>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCount(s.totalBidRequests, settings.numberFormat)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCount(s.totalImpressions, settings.numberFormat)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">{formatCurrency(s.totalRevenue, settings.currency, settings.numberFormat)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatCurrency(s.cpm, settings.currency, 'standard', 2)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatPercent(s.winRate)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{formatPercent(s.renderRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Anomalies (Detailed report) */}
        {reportType === 'detailed' && anomalies.length > 0 && (
          <section className="print-break-inside-avoid space-y-2">
            <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              4. Rule-Based Anomaly Triggers ({anomalies.length})
            </h2>
            <ul className="list-disc pl-5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              {anomalies.slice(0, 12).map((a) => (
                <li key={a.id}>
                  <span className="font-semibold">
                    [{a.severity}] {a.affectedDate} — {a.type} ({a.entityName}):
                  </span>{' '}
                  {a.summary}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* AI Recommendations */}
        <section className="print-break-inside-avoid space-y-2">
          <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
            AI Recommendations & Executive Insights
          </h2>
          {aiAnalysis ? (
            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <p>{aiAnalysis.executiveSummary}</p>
              <ul className="list-disc pl-5 space-y-1.5">
                {aiAnalysis.optimizationRecommendations.map((rec, i) => (
                  <li key={i}>
                    <span className="font-semibold">
                      [{rec.priority} Priority · {rec.category}] {rec.title}:
                    </span>{' '}
                    {rec.recommendation}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              AI campaign analysis has not been generated for this session yet. Visit the AI Insights section to generate structured recommendations before printing if desired.
            </p>
          )}
        </section>

        {/* Metric Definitions, Limitations & Mandatory Disclaimer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 pt-4 text-[11px] text-slate-500 dark:text-slate-400 space-y-2">
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Metric Definitions & Data Limitations:
            </span>{' '}
            Bid Response Rate = (Bid Responses / Bid Requests) × 100 · Win Rate ={' '}
            {settings.winRateDefinition === 'wins_over_submitted'
              ? '(Auction Wins / Submitted Bids) × 100'
              : '(Auction Wins / Bid Responses) × 100'}{' '}
            · Render Rate = (Impressions / Auction Wins) × 100 · CPM = (Revenue / Impressions) × 1,000.
            {metrics.unavailableMetrics.length > 0 &&
              ` Unavailable: ${metrics.unavailableMetrics.map((u) => `${u.metric} (${u.reason})`).join('; ')}.`}
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            <strong>Disclaimer:</strong> AI-generated analyses and optimization recommendations are decision-support suggestions derived strictly from aggregated metrics and must be reviewed and validated by a qualified Ad Operations professional before making bid, floor-price, or partner changes.
          </div>
        </footer>
      </article>
    </div>
  );
};
