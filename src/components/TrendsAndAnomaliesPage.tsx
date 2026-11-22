import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import type {
  AnomalySeverity,
  AppSettings,
  DailyMetricPoint,
  DetectedAnomaly,
  NavSection,
} from '../types/rtb';
import { formatCount, formatCurrency, formatPercent } from '../utils/rtbEngine';
import {
  BidRequestsVsResponsesChart,
  DailyCpmChart,
  DailyImpressionsChart,
  DailyRevenueChart,
  SubmittedBidsVsWinsChart,
} from './ChartsPanel';

interface TrendsAndAnomaliesPageProps {
  daily: DailyMetricPoint[];
  anomalies: DetectedAnomaly[];
  settings: AppSettings;
  onNavigate: (section: NavSection) => void;
}

export const TrendsAndAnomaliesPage: React.FC<TrendsAndAnomaliesPageProps> = ({
  daily,
  anomalies,
  settings,
  onNavigate,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AnomalySeverity>('ALL');
  const [entityFilter, setEntityFilter] = useState<'ALL' | 'Overall' | 'Publisher' | 'SSP'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a) => {
      if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
      if (entityFilter !== 'ALL' && a.entityType !== entityFilter) return false;
      return true;
    });
  }, [anomalies, severityFilter, entityFilter]);

  const formatAnomalyVal = (val: number | null, unit: DetectedAnomaly['unit']) => {
    if (val === null) return 'N/A';
    if (unit === 'currency') return formatCurrency(val, settings.currency, 'standard', 2);
    if (unit === 'cpm') return formatCurrency(val, settings.currency, 'standard', 2);
    if (unit === 'percent') return formatPercent(val, 2);
    if (unit === 'days') return `${val} rows`;
    return formatCount(val, 'standard');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            Performance Trends & Rule-Based Anomaly Detection
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daily time-series trajectory paired with deterministic threshold triggers
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Adjust Thresholds</span>
        </button>
      </div>

      {/* Time-series charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DailyRevenueChart daily={daily} settings={settings} />
        <DailyImpressionsChart daily={daily} settings={settings} />
        <DailyCpmChart daily={daily} settings={settings} />
        <BidRequestsVsResponsesChart daily={daily} settings={settings} />
      </div>
      <SubmittedBidsVsWinsChart daily={daily} settings={settings} />

      {/* Rule-Based Anomaly Inspector */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Detected Rule-Based Anomalies ({filteredAnomalies.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Active thresholds: Revenue &ge;{settings.anomalyThresholds.revenueChangePct}% drop ·
              Impressions &ge;{settings.anomalyThresholds.impressionChangePct}% drop ·
              CPM &ge;{settings.anomalyThresholds.cpmChangePct}% shift ·
              Bid Response &ge;{settings.anomalyThresholds.bidResponseRateChangePts} pts drop ·
              Traffic Surge &ge;+{settings.anomalyThresholds.trafficSurgePct}%. Triggers indicate items to investigate, not confirmed fraud or outages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter anomalies by severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as 'ALL' | AnomalySeverity)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">All Severities</option>
              <option value="High">High Severity</option>
              <option value="Medium">Medium Severity</option>
              <option value="Low">Low Severity</option>
            </select>

            <select
              aria-label="Filter anomalies by entity scope"
              value={entityFilter}
              onChange={(e) =>
                setEntityFilter(e.target.value as 'ALL' | 'Overall' | 'Publisher' | 'SSP')
              }
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">All Scopes</option>
              <option value="Overall">Overall</option>
              <option value="Publisher">Publisher</option>
              <option value="SSP">SSP</option>
            </select>
          </div>
        </div>

        {filteredAnomalies.length === 0 ? (
          <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
            No rule-based anomalies match the selected severity and scope filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Anomaly Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Scope / Partner</th>
                  <th className="px-4 py-3 text-right font-semibold">Previous</th>
                  <th className="px-4 py-3 text-right font-semibold">Current</th>
                  <th className="px-4 py-3 text-right font-semibold">Change</th>
                  <th className="px-4 py-3 text-left font-semibold">Severity</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredAnomalies.map((a) => {
                  const expanded = expandedId === a.id;
                  return (
                    <React.Fragment key={a.id}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {a.type}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {a.affectedDate}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {a.entityName} <span className="text-slate-400">({a.entityType})</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {formatAnomalyVal(a.previousValue, a.unit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 dark:text-white font-medium">
                          {formatAnomalyVal(a.currentValue, a.unit)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {a.percentageChange === null ? (
                            <span className="text-slate-400">N/A</span>
                          ) : (
                            <span
                              className={
                                a.percentageChange < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              {a.percentageChange > 0 ? '+' : ''}
                              {a.percentageChange.toFixed(1)}
                              {a.unit === 'percent' ? ' pts' : '%'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              a.severity === 'High'
                                ? 'text-red-600 dark:text-red-400'
                                : a.severity === 'Medium'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {a.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : a.id)}
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium hover:underline"
                          >
                            <span>{expanded ? 'Hide Steps' : 'Investigation Steps'}</span>
                            {expanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                          <td colSpan={8} className="px-5 py-4 text-xs space-y-2">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              Trigger Observation: {a.summary}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Suggested AdOps Investigation Steps:
                              </span>
                              <ul className="mt-1 list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                                {a.suggestedInvestigationSteps.map((step, idx) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
