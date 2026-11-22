import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type {
  AggregatedMetrics,
  AiCampaignAnalysis,
  AppSettings,
  DatasetMetadata,
  DetectedAnomaly,
  EntitySummary,
} from '../types/rtb';
import { formatCount, formatCurrency, formatPercent } from '../utils/rtbEngine';

interface AiInsightsPageProps {
  metadata: DatasetMetadata;
  metrics: AggregatedMetrics;
  publishers: EntitySummary[];
  ssps: EntitySummary[];
  anomalies: DetectedAnomaly[];
  startDate: string;
  endDate: string;
  settings: AppSettings;
  analysis: AiCampaignAnalysis | null;
  analysisMeta: { generatedAt: string; modelUsed: string } | null;
  onAnalysisComplete: (
    analysis: AiCampaignAnalysis,
    meta: { generatedAt: string; modelUsed: string },
  ) => void;
}

export const AiInsightsPage: React.FC<AiInsightsPageProps> = ({
  metadata,
  metrics,
  publishers,
  ssps,
  anomalies,
  startDate,
  endDate,
  settings,
  analysis,
  analysisMeta,
  onAnalysisComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'High' | 'Medium' | 'Low'>('ALL');
  const [showPayloadPreview, setShowPayloadPreview] = useState(false);

  // Build strict minimal aggregated payload (zero raw rows, zero PII)
  const buildAggregatedPayload = () => ({
    dataSourceLabel: metadata.isDemoData ? 'Synthetic Demo Data (30d)' : metadata.sourceName,
    currency: settings.currency,
    reportingPeriod: {
      startDate,
      endDate,
      distinctReportingDays: metrics.distinctDays,
      priorPeriodCompared: metrics.comparison.hasComparablePriorPeriod
        ? `${metrics.comparison.priorStartDate} to ${metrics.comparison.priorEndDate}`
        : 'Unavailable',
    },
    metricDefinitions: {
      winRateDefinition:
        settings.winRateDefinition === 'wins_over_submitted'
          ? '(Auction Wins / Submitted Bids) * 100'
          : '(Auction Wins / Bid Responses) * 100',
      bidResponseRate: '(Bid Responses / Bid Requests) * 100',
      renderRate: '(Impressions / Auction Wins) * 100',
      fillRate: '(Impressions / Eligible Ad Requests) * 100 (only if Eligible Ad Requests mapped)',
      cpm: '(Revenue / Impressions) * 1000',
    },
    aggregatedMetrics: {
      totalBidRequests: metrics.totalBidRequests,
      totalBidResponses: metrics.totalBidResponses,
      bidResponseRatePct: metrics.bidResponseRate,
      bidParticipationRatePct: metrics.bidParticipationRate,
      submittedBids: metrics.totalSubmittedBids,
      auctionWins: metrics.totalAuctionWins,
      winRatePct: metrics.winRate,
      renderRatePct: metrics.renderRate,
      fillRatePct: metrics.fillRate,
      totalImpressions: metrics.totalImpressions,
      totalRevenue: metrics.totalRevenue,
      averageCpm: metrics.cpm,
      avgDailyBidResponses: metrics.avgDailyBidResponses,
      revenueChangePct: metrics.comparison.revenueChangePct,
      impressionChangePct: metrics.comparison.impressionChangePct,
      cpmChangePct: metrics.comparison.cpmChangePct,
    },
    publisherSummaries: publishers.slice(0, 15).map((p) => ({
      name: p.name,
      bidRequests: p.totalBidRequests,
      impressions: p.totalImpressions,
      revenue: Number(p.totalRevenue.toFixed(2)),
      cpm: p.cpm !== null ? Number(p.cpm.toFixed(2)) : null,
      bidResponseRatePct: p.bidResponseRate !== null ? Number(p.bidResponseRate.toFixed(2)) : null,
      winRatePct: p.winRate !== null ? Number(p.winRate.toFixed(2)) : null,
      revenueTrendPct: p.revenueTrendPct !== null ? Number(p.revenueTrendPct.toFixed(1)) : null,
    })),
    sspSummaries: ssps.slice(0, 15).map((s) => ({
      name: s.name,
      bidRequests: s.totalBidRequests,
      impressions: s.totalImpressions,
      revenue: Number(s.totalRevenue.toFixed(2)),
      cpm: s.cpm !== null ? Number(s.cpm.toFixed(2)) : null,
      bidResponseRatePct: s.bidResponseRate !== null ? Number(s.bidResponseRate.toFixed(2)) : null,
      winRatePct: s.winRate !== null ? Number(s.winRate.toFixed(2)) : null,
      renderRatePct: s.renderRate !== null ? Number(s.renderRate.toFixed(2)) : null,
    })),
    detectedAnomalies: anomalies.slice(0, 20).map((a) => ({
      type: a.type,
      affectedDate: a.affectedDate,
      entity: `${a.entityName} (${a.entityType})`,
      previousValue: a.previousValue,
      currentValue: a.currentValue,
      percentageChange: a.percentageChange,
      severity: a.severity,
      summary: a.summary,
    })),
    dataQualityWarnings: [
      ...metadata.uncalculableMetrics.map((u) => `${u.metric}: ${u.reason}`),
      ...(metrics.comparison.reasonIfUnavailable ? [metrics.comparison.reasonIfUnavailable] : []),
      ...(metadata.importSummary.invalidRows > 0
        ? [`${metadata.importSummary.invalidRows} invalid rows were excluded during import validation.`]
        : []),
    ],
  });

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = buildAggregatedPayload();
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || `Server responded with status ${resp.status}`);
      }
      onAnalysisComplete(json.analysis, {
        generatedAt: json.generatedAt,
        modelUsed: json.modelUsed,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to complete AI analysis. Deterministic metrics remain unaffected.',
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredRecommendations =
    analysis?.optimizationRecommendations.filter(
      (r) => priorityFilter === 'ALL' || r.priority === priorityFilter,
    ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            AI Campaign Insights
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gemini-powered RTB analyst interpretation grounded strictly in your calculated metrics
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Generating AI Campaign Analysis...</span>
            </>
          ) : (
            <>
              <Cpu className="h-4 w-4" />
              <span>Generate AI Campaign Analysis</span>
            </>
          )}
        </button>
      </div>

      {/* Data Privacy & Transmission Transparency */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
            <Lock className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">
                Data Minimization & Server-Side AI Boundary:
              </span>{' '}
              Only aggregated campaign KPIs, top {Math.min(15, publishers.length)} publisher summaries,{' '}
              {Math.min(15, ssps.length)} SSP summaries, {Math.min(20, anomalies.length)} rule-based anomalies,
              and metric definitions are transmitted to Gemini via the backend API. Raw CSV/Excel rows and user-level identifiers are never sent or stored.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPayloadPreview((v) => !v)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >
            {showPayloadPreview ? 'Hide Aggregated Payload' : 'Inspect Payload Sent to AI'}
          </button>
        </div>

        {showPayloadPreview && (
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 text-slate-200 p-3 text-[11px] font-mono">
            {JSON.stringify(buildAggregatedPayload(), null, 2)}
          </pre>
        )}
      </div>

      {/* Error State (keeps deterministic dashboard intact) */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">AI Analysis Unavailable</div>
            <div className="mt-0.5">{error}</div>
            <div className="mt-1 text-[11px] opacity-80">
              All deterministic RTB calculations, publisher/SSP comparisons, and rule-based anomaly tables remain active.
            </div>
          </div>
        </div>
      )}

      {/* Empty State before generation */}
      {!analysis && !loading && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
          <Cpu className="h-9 w-9 mx-auto text-blue-600 dark:text-blue-400" />
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Ready to Analyze {startDate} to {endDate}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            Click &ldquo;Generate AI Campaign Analysis&rdquo; to evaluate your aggregated metrics (
            {formatCurrency(metrics.totalRevenue, settings.currency, settings.numberFormat)} revenue,{' '}
            {formatCount(metrics.totalImpressions, settings.numberFormat)} impressions,{' '}
            {formatPercent(metrics.winRate)} win rate) and receive structured AdOps explanations and prioritized recommendations.
          </p>
        </div>
      )}

      {/* Rendered Structured AI Analysis */}
      {analysis && (
        <div className="space-y-6">
          {analysisMeta && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>Generated {new Date(analysisMeta.generatedAt).toLocaleString()}</span>
              <span aria-hidden="true">·</span>
              <span>Grounded in deterministic metrics ({startDate} to {endDate})</span>
            </div>
          )}

          {/* A. Executive Summary */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white mb-2">
              A. Executive Summary
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {analysis.executiveSummary}
            </p>
          </section>

          {/* B. Performance Analysis */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              B. Performance Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Bid Response Performance', text: analysis.performanceAnalysis.bidResponse },
                { label: 'Win-Rate Performance', text: analysis.performanceAnalysis.winRate },
                { label: 'Impression Delivery', text: analysis.performanceAnalysis.impressionDelivery },
                { label: 'Revenue Trends', text: analysis.performanceAnalysis.revenueTrends },
                { label: 'CPM / eCPM Changes', text: analysis.performanceAnalysis.cpmChanges },
                { label: 'Publisher Performance', text: analysis.performanceAnalysis.publisherPerformance },
                { label: 'SSP Performance', text: analysis.performanceAnalysis.sspPerformance },
              ].map((block) => (
                <div
                  key={block.label}
                  className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
                    {block.label}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {block.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* C. Anomaly Explanation */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                C. Anomaly Explanations (AI Hypothesis Layer)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hypotheses and verification steps mapped to rule-based triggers
              </p>
            </div>

            {analysis.anomalyExplanations.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No anomaly explanations returned for this reporting window.
              </p>
            ) : (
              <div className="space-y-3">
                {analysis.anomalyExplanations.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5 text-xs"
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">{item.anomalyRef}</div>
                    <div className="text-slate-700 dark:text-slate-300">
                      <span className="font-medium">What Changed:</span> {item.whatChanged}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                          Possible Causes (Hypotheses)
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                          {item.possibleCauses.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                          AdOps Investigation Steps
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                          {item.investigationSteps.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                          Data Needed to Confirm
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                          {item.additionalDataNeeded.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* D & E. Prioritized Optimization Recommendations */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                  D. Optimization Recommendations & Priority Classification
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Includes supporting metrics, explicit assumptions, and missing verification data
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                {(['ALL', 'High', 'Medium', 'Low'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriorityFilter(level)}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      priorityFilter === level
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {level === 'ALL' ? 'All' : `${level} Priority`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredRecommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                      {rec.title}
                    </div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span>{rec.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span
                        className={
                          rec.priority === 'High'
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : rec.priority === 'Medium'
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : 'text-teal-600 dark:text-teal-400 font-semibold'
                        }
                      >
                        {rec.priority} Priority
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {rec.recommendation}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        Supporting Metrics
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                        {rec.supportingMetrics.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        Assumptions
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                        {rec.assumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        Missing Information
                      </div>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                        {rec.missingInformation.map((mi, i) => (
                          <li key={i}>{mi}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span className="font-semibold">Facts vs Hypotheses:</span> {rec.factsVsHypotheses}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* F. Confidence and Limitations */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-display font-semibold text-sm text-slate-900 dark:text-white">
              <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span>F. Confidence & Analytical Limitations</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {analysis.confidenceAndLimitations.overallConfidenceNote}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Data Gaps</div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                  {analysis.confidenceAndLimitations.dataGaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Methodological Notes
                </div>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                  {analysis.confidenceAndLimitations.methodologicalNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
