import React from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  Cpu,
  FileSpreadsheet,
  Globe2,
  LayoutDashboard,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import type { DatasetMetadata, NavSection } from '../types/rtb';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  metadata: DatasetMetadata | null;
  onClearData: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campaign Analysis', icon: BarChart3 },
  { id: 'publishers', label: 'Publisher Analysis', icon: Building2 },
  { id: 'ssps', label: 'SSP Analysis', icon: Globe2 },
  { id: 'trends', label: 'Performance Trends', icon: Activity },
  { id: 'ai-insights', label: 'AI Insights', icon: Cpu },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  metadata,
  onClearData,
  mobileOpen,
  onCloseMobile,
}) => {
  const content = (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100 border-r border-slate-800">
      {/* Brand header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 text-white font-display font-bold text-sm">
            RI
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold text-base tracking-tight text-white truncate">
              RTB Intelligence
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Smarter Insights for Programmatic Advertising
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
              <span className="truncate whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Dataset summary & Clear Data */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        {metadata ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-400">Active Dataset</div>
            <div className="text-xs font-medium text-slate-100 truncate" title={metadata.sourceName}>
              {metadata.sourceName}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              {metadata.importSummary.importedRows.toLocaleString()} rows
              <span aria-hidden="true"> · </span>
              {metadata.isDemoData ? 'Synthetic Demo' : 'Local Session'}
            </div>
            <button
              type="button"
              onClick={onClearData}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-red-950/70 hover:text-red-200 border border-slate-700 hover:border-red-800/60 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear Data</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-slate-400 leading-relaxed">
            No dataset loaded. Upload a CSV/Excel report or load synthetic demo data to begin.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="no-print hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{content}</aside>
        </div>
      )}
    </>
  );
};
