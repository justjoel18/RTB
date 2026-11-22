import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import type { DashboardFilters } from '../types/rtb';

interface FilterOptions {
  publishers: string[];
  ssps: string[];
  campaigns: string[];
  countries: string[];
  devices: string[];
}

interface FilterBarProps {
  filters: DashboardFilters;
  options: FilterOptions;
  defaultStart: string;
  defaultEnd: string;
  onChange: (next: DashboardFilters) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  options,
  defaultStart,
  defaultEnd,
  onChange,
}) => {
  const hasActiveFilter =
    filters.publisher !== 'ALL' ||
    filters.ssp !== 'ALL' ||
    filters.campaign !== 'ALL' ||
    filters.country !== 'ALL' ||
    filters.device !== 'ALL' ||
    filters.startDate !== defaultStart ||
    filters.endDate !== defaultEnd;

  const selectClass =
    'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] truncate';

  return (
    <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 pr-1">
          <Filter className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Filters</span>
        </div>

        <select
          aria-label="Filter by Publisher"
          value={filters.publisher}
          onChange={(e) => onChange({ ...filters, publisher: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">All Publishers ({options.publishers.length})</option>
          {options.publishers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by SSP"
          value={filters.ssp}
          onChange={(e) => onChange({ ...filters, ssp: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">All SSPs ({options.ssps.length})</option>
          {options.ssps.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by Campaign"
          value={filters.campaign}
          onChange={(e) => onChange({ ...filters, campaign: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">All Campaigns ({options.campaigns.length})</option>
          {options.campaigns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by Country"
          value={filters.country}
          onChange={(e) => onChange({ ...filters, country: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">All Countries ({options.countries.length})</option>
          {options.countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by Device"
          value={filters.device}
          onChange={(e) => onChange({ ...filters, device: e.target.value })}
          className={selectClass}
        >
          <option value="ALL">All Devices ({options.devices.length})</option>
          {options.devices.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilter && (
        <button
          type="button"
          onClick={() =>
            onChange({
              startDate: defaultStart,
              endDate: defaultEnd,
              publisher: 'ALL',
              ssp: 'ALL',
              campaign: 'ALL',
              country: 'ALL',
              device: 'ALL',
            })
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Filters</span>
        </button>
      )}
    </div>
  );
};
