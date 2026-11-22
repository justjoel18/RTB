import React, { useState } from 'react';
import { Calendar, Database, Menu, Upload } from 'lucide-react';
import type { DatasetMetadata } from '../types/rtb';

interface TopBarProps {
  metadata: DatasetMetadata | null;
  startDate: string;
  endDate: string;
  minDate: string;
  maxDate: string;
  onDateChange: (start: string, end: string) => void;
  onOpenUpload: () => void;
  onLoadDemo: () => void;
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  metadata,
  startDate,
  endDate,
  minDate,
  maxDate,
  onDateChange,
  onOpenUpload,
  onLoadDemo,
  onOpenMobileMenu,
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <header className="no-print sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-3">
        {/* Zone 1: Mobile trigger + Analysis context */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="lg:hidden font-display font-bold text-sm text-slate-900 dark:text-white whitespace-nowrap">
                RTB Intelligence
              </span>
              <span className="hidden lg:inline text-xs font-medium text-slate-500 dark:text-slate-400">
                Active Analysis:
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[220px] sm:max-w-[320px]">
                {metadata ? metadata.sourceName : 'No Report Loaded'}
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Date Range Selector */}
        {metadata && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />
            <label className="sr-only" htmlFor="topbar-start-date">
              Start Date
            </label>
            <input
              id="topbar-start-date"
              type="date"
              value={startDate}
              min={minDate}
              max={endDate || maxDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400">to</span>
            <label className="sr-only" htmlFor="topbar-end-date">
              End Date
            </label>
            <input
              id="topbar-end-date"
              type="date"
              value={endDate}
              min={startDate || minDate}
              max={maxDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Zone 3: Primary actions + User profile placeholder */}
        <div className="flex items-center gap-3 shrink-0">
          {!metadata && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Database className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>Load Demo Data</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{metadata ? 'Replace Report' : 'Upload Report'}</span>
          </button>

          {/* User profile placeholder */}
          <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
            {!imgError ? (
              <img
                src="/src/assets/images/avatar_adops_analyst_1795377580901.jpg"
                alt="AdOps Analyst Profile"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-8 w-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-800 text-white text-xs font-semibold flex items-center justify-center">
                AO
              </div>
            )}
            <div className="hidden xl:block leading-tight">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                AdOps Workspace
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Programmatic Analyst
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
