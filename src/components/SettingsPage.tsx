import React, { useState } from 'react';
import { CheckCircle2, RotateCcw, ShieldCheck } from 'lucide-react';
import type {
  AppSettings,
  CurrencyCode,
  DefaultDatePreset,
  NumberFormatMode,
  ThemePreference,
  WinRateDefinition,
} from '../types/rtb';
import { runRtbEngineVerification, type VerificationResult } from '../utils/rtbVerification';

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'USD',
  defaultDatePreset: 'all',
  winRateDefinition: 'wins_over_submitted',
  anomalyThresholds: {
    revenueChangePct: 20,
    impressionChangePct: 20,
    cpmChangePct: 25,
    bidResponseRateChangePts: 15,
    winRateChangePts: 15,
    trafficSurgePct: 35,
  },
  numberFormat: 'compact',
  theme: 'light',
};

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onUpdateSettings }) => {
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  const updateThreshold = (key: keyof AppSettings['anomalyThresholds'], value: number) => {
    const safe = Number.isFinite(value) && value > 0 ? value : 1;
    onUpdateSettings({
      ...settings,
      anomalyThresholds: {
        ...settings.anomalyThresholds,
        [key]: safe,
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">
            Settings & Calculation Preferences
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure metric definitions, currency, anomaly thresholds, and display preferences
          </p>
        </div>

        <button
          type="button"
          onClick={() => onUpdateSettings(DEFAULT_SETTINGS)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      {/* General Display & Formatting */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
          Display, Currency & Date Defaults
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="setting-currency" className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Reporting Currency
            </label>
            <select
              id="setting-currency"
              value={settings.currency}
              onChange={(e) => onUpdateSettings({ ...settings, currency: e.target.value as CurrencyCode })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="USD">USD ($) — US Dollar</option>
              <option value="EUR">EUR (€) — Euro</option>
              <option value="GBP">GBP (£) — British Pound</option>
              <option value="JPY">JPY (¥) — Japanese Yen</option>
            </select>
          </div>

          <div>
            <label htmlFor="setting-date-preset" className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Default Date Range on Load
            </label>
            <select
              id="setting-date-preset"
              value={settings.defaultDatePreset}
              onChange={(e) =>
                onUpdateSettings({ ...settings, defaultDatePreset: e.target.value as DefaultDatePreset })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="all">Full Available Range</option>
              <option value="30d">Last 30 Days</option>
              <option value="14d">Last 14 Days</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>

          <div>
            <label htmlFor="setting-number-format" className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Number Formatting
            </label>
            <select
              id="setting-number-format"
              value={settings.numberFormat}
              onChange={(e) =>
                onUpdateSettings({ ...settings, numberFormat: e.target.value as NumberFormatMode })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="compact">Compact (e.g. 1.42M, 420.5K)</option>
              <option value="standard">Full Precision (e.g. 1,420,500)</option>
            </select>
          </div>

          <div>
            <label htmlFor="setting-theme" className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Theme Preference
            </label>
            <select
              id="setting-theme"
              value={settings.theme}
              onChange={(e) =>
                onUpdateSettings({ ...settings, theme: e.target.value as ThemePreference })
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="light">Light Workspace (Navy Sidebar + White Canvas)</option>
              <option value="dark">Dark Workspace (Deep Navy)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Win Rate Definition */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
          Win-Rate Calculation Definition
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {(
            [
              {
                id: 'wins_over_submitted',
                title: 'Default: Auction Wins / Submitted Bids',
                desc: 'Measures auction clearance against bids actually submitted into the exchange auction.',
              },
              {
                id: 'wins_over_responses',
                title: 'Alternative: Auction Wins / Bid Responses',
                desc: 'Measures auction clearance against total bid responses returned prior to filtering or timeouts.',
              },
            ] as const
          ).map((opt) => {
            const active = settings.winRateDefinition === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, winRateDefinition: opt.id as WinRateDefinition })
                }
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-white">{opt.title}</div>
                <div className="text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Anomaly Detection Thresholds */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
          Rule-Based Anomaly Detection Thresholds
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {[
            { key: 'revenueChangePct', label: 'Revenue Drop Threshold (%)', val: settings.anomalyThresholds.revenueChangePct },
            { key: 'impressionChangePct', label: 'Impression Drop Threshold (%)', val: settings.anomalyThresholds.impressionChangePct },
            { key: 'cpmChangePct', label: 'CPM Shift Threshold (%)', val: settings.anomalyThresholds.cpmChangePct },
            { key: 'bidResponseRateChangePts', label: 'Bid Response Drop (pts)', val: settings.anomalyThresholds.bidResponseRateChangePts },
            { key: 'winRateChangePts', label: 'Win Rate Drop (pts)', val: settings.anomalyThresholds.winRateChangePts },
            { key: 'trafficSurgePct', label: 'Bid Request Surge Threshold (%)', val: settings.anomalyThresholds.trafficSurgePct },
          ].map((item) => (
            <div key={item.key}>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {item.label}
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={item.val}
                onChange={(e) =>
                  updateThreshold(
                    item.key as keyof AppSettings['anomalyThresholds'],
                    Number(e.target.value),
                  )
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Deterministic Engine Self-Verification */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
              Deterministic Calculation Verification
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Run internal unit checks against known RTB formulas, weighted CPM aggregation, and zero-division guards
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVerification(runRtbEngineVerification())}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Run Math Self-Check</span>
          </button>
        </div>

        {verification && (
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {verification.passed
                  ? `All ${verification.checks.length} RTB formula checks passed`
                  : 'One or more checks failed'}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {verification.checks.map((c) => (
                <div key={c.name} className="py-1.5 flex items-center justify-between gap-3">
                  <span className="text-slate-700 dark:text-slate-300">{c.name}</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                    {c.actual} ({c.passed ? 'PASS' : `FAIL expected ${c.expected}`})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
