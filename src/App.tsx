import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { Database, ShieldAlert, Upload } from 'lucide-react';
import { AiInsightsPage } from './components/AiInsightsPage';
import {
  CampaignAnalysisView,
  PublisherAnalysisView,
  SspAnalysisView,
} from './components/EntityAnalysisPages';
import { FilterBar } from './components/FilterBar';
import { OverviewPage } from './components/OverviewPage';
import { ReportsPage } from './components/ReportsPage';
import { DEFAULT_SETTINGS, SettingsPage } from './components/SettingsPage';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TrendsAndAnomaliesPage } from './components/TrendsAndAnomaliesPage';
import { UploadModal } from './components/UploadModal';
import { generateSyntheticDemoDataset } from './data/demoData';
import type {
  AiCampaignAnalysis,
  AppSettings,
  DashboardFilters,
  DatasetMetadata,
  NavSection,
  RtbRecord,
} from './types/rtb';
import { detectAnomalies } from './utils/anomalyDetector';
import {
  aggregateByDimension,
  aggregateDailyMetrics,
  calculateAggregatedMetrics,
  filterRecords,
} from './utils/rtbEngine';

function computeInitialDateWindow(
  records: RtbRecord[],
  preset: AppSettings['defaultDatePreset'],
): { minDate: string; maxDate: string; startDate: string; endDate: string } {
  if (records.length === 0) {
    return { minDate: '', maxDate: '', startDate: '', endDate: '' };
  }
  const dates = Array.from(new Set(records.map((r) => r.date))).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  if (preset === 'all') {
    return { minDate, maxDate, startDate: minDate, endDate: maxDate };
  }

  const daysBack = preset === '7d' ? 6 : preset === '14d' ? 13 : 29;
  const candidateStart = format(subDays(parseISO(maxDate), daysBack), 'yyyy-MM-dd');
  const startDate = candidateStart > minDate ? candidateStart : minDate;
  return { minDate, maxDate, startDate, endDate: maxDate };
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [records, setRecords] = useState<RtbRecord[]>([]);
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);

  const [filters, setFilters] = useState<DashboardFilters>({
    startDate: '',
    endDate: '',
    publisher: 'ALL',
    ssp: 'ALL',
    campaign: 'ALL',
    country: 'ALL',
    device: 'ALL',
  });

  const [aiAnalysis, setAiAnalysis] = useState<AiCampaignAnalysis | null>(null);
  const [aiMeta, setAiMeta] = useState<{ generatedAt: string; modelUsed: string } | null>(null);

  // Sync Tailwind dark mode class with user theme preference
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);

  const dateBounds = useMemo(() => {
    if (records.length === 0) return { minDate: '', maxDate: '' };
    const dates = Array.from(new Set(records.map((r) => r.date))).sort();
    return { minDate: dates[0], maxDate: dates[dates.length - 1] };
  }, [records]);

  const filterOptions = useMemo(() => {
    const pubs = new Set<string>();
    const ssps = new Set<string>();
    const camps = new Set<string>();
    const countries = new Set<string>();
    const devices = new Set<string>();

    for (const r of records) {
      pubs.add(r.publisher);
      ssps.add(r.ssp);
      camps.add(r.campaign);
      countries.add(r.country);
      devices.add(r.device);
    }

    return {
      publishers: Array.from(pubs).sort(),
      ssps: Array.from(ssps).sort(),
      campaigns: Array.from(camps).sort(),
      countries: Array.from(countries).sort(),
      devices: Array.from(devices).sort(),
    };
  }, [records]);

  const loadDataset = (nextRecords: RtbRecord[], nextMetadata: DatasetMetadata) => {
    const window = computeInitialDateWindow(nextRecords, settings.defaultDatePreset);
    setRecords(nextRecords);
    setMetadata(nextMetadata);
    setFilters({
      startDate: window.startDate,
      endDate: window.endDate,
      publisher: 'ALL',
      ssp: 'ALL',
      campaign: 'ALL',
      country: 'ALL',
      device: 'ALL',
    });
    setAiAnalysis(null);
    setAiMeta(null);
    if (activeSection === 'settings') {
      setActiveSection('overview');
    }
  };

  const handleLoadDemoData = () => {
    const demo = generateSyntheticDemoDataset();
    loadDataset(demo.records, demo.metadata);
  };

  const handleClearData = () => {
    setRecords([]);
    setMetadata(null);
    setAiAnalysis(null);
    setAiMeta(null);
    setFilters({
      startDate: '',
      endDate: '',
      publisher: 'ALL',
      ssp: 'ALL',
      campaign: 'ALL',
      country: 'ALL',
      device: 'ALL',
    });
    setActiveSection('overview');
  };

  // Filtered records and deterministic calculations
  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);

  const aggregatedMetrics = useMemo(() => {
    if (!metadata) return null;
    return calculateAggregatedMetrics(
      records,
      filteredRecords,
      filters,
      metadata.mappedFields,
      settings.winRateDefinition,
    );
  }, [records, filteredRecords, filters, metadata, settings.winRateDefinition]);

  const dailySeries = useMemo(
    () => aggregateDailyMetrics(filteredRecords, settings.winRateDefinition),
    [filteredRecords, settings.winRateDefinition],
  );

  const publisherSummaries = useMemo(
    () =>
      aggregateByDimension(
        filteredRecords,
        'publisher',
        settings.winRateDefinition,
        Boolean(metadata?.mappedFields.eligibleAdRequests),
      ),
    [filteredRecords, settings.winRateDefinition, metadata],
  );

  const sspSummaries = useMemo(
    () =>
      aggregateByDimension(
        filteredRecords,
        'ssp',
        settings.winRateDefinition,
        Boolean(metadata?.mappedFields.eligibleAdRequests),
      ),
    [filteredRecords, settings.winRateDefinition, metadata],
  );

  const campaignSummaries = useMemo(
    () =>
      aggregateByDimension(
        filteredRecords,
        'campaign',
        settings.winRateDefinition,
        Boolean(metadata?.mappedFields.eligibleAdRequests),
      ),
    [filteredRecords, settings.winRateDefinition, metadata],
  );

  const anomalies = useMemo(
    () => detectAnomalies(filteredRecords, settings.anomalyThresholds, settings.winRateDefinition),
    [filteredRecords, settings.anomalyThresholds, settings.winRateDefinition],
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        metadata={metadata}
        onClearData={handleClearData}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          metadata={metadata}
          startDate={filters.startDate}
          endDate={filters.endDate}
          minDate={dateBounds.minDate}
          maxDate={dateBounds.maxDate}
          onDateChange={(startDate, endDate) =>
            setFilters((prev) => ({ ...prev, startDate, endDate }))
          }
          onOpenUpload={() => setUploadOpen(true)}
          onLoadDemo={handleLoadDemoData}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-[1440px] w-full mx-auto">
          {/* Privacy Reminder */}
          {activeSection !== 'settings' && (
            <div className="no-print flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <ShieldAlert className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>
                Reports are processed in-browser and never saved to a database. Do not upload confidential client data without authorization.
              </span>
            </div>
          )}

          {/* Settings can be accessed even when no dataset is loaded */}
          {activeSection === 'settings' ? (
            <SettingsPage settings={settings} onUpdateSettings={setSettings} />
          ) : !metadata || !aggregatedMetrics ? (
            /* Empty State Onboarding */
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-6">
              <div className="max-w-xl mx-auto space-y-3">
                <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white text-balance">
                  Analyze RTB Campaign Performance with Deterministic Precision
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Upload a CSV or Excel export from your DSP, SSP, or ad server to calculate programmatic KPIs, inspect publisher and exchange efficiency, detect rule-based anomalies, and generate Gemini AdOps insights.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setUploadOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload CSV / Excel Report</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadDemoData}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <Database className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span>Load Demo Data</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800 text-left text-xs">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="font-semibold text-slate-900 dark:text-white mb-1">
                    1. Flexible Column Mapping
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Auto-maps common DSP/SSP headers and lets you verify worksheets, rejected rows, and missing metrics before import.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="font-semibold text-slate-900 dark:text-white mb-1">
                    2. Deterministic RTB Engine
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Calculates Bid Response, Win Rate, Render Rate, Fill Rate, and CPM strictly from summed numerators and denominators.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="font-semibold text-slate-900 dark:text-white mb-1">
                    3. Gemini AdOps Analysis
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Sends only aggregated summaries and rule-based anomalies to Gemini to generate structured hypotheses and next steps.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <>
              {activeSection !== 'reports' && (
                <FilterBar
                  filters={filters}
                  options={filterOptions}
                  defaultStart={dateBounds.minDate}
                  defaultEnd={dateBounds.maxDate}
                  onChange={setFilters}
                />
              )}

              {filteredRecords.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  No reporting rows match the active date and dimension filters. Reset filters to view your data.
                </div>
              ) : (
                <>
                  {activeSection === 'overview' && (
                    <OverviewPage
                      metrics={aggregatedMetrics}
                      daily={dailySeries}
                      publishers={publisherSummaries}
                      ssps={sspSummaries}
                      anomalies={anomalies}
                      metadata={metadata}
                      settings={settings}
                      onNavigate={setActiveSection}
                    />
                  )}
                  {activeSection === 'campaigns' && (
                    <CampaignAnalysisView
                      campaigns={campaignSummaries}
                      daily={dailySeries}
                      metrics={aggregatedMetrics}
                      settings={settings}
                    />
                  )}
                  {activeSection === 'publishers' && (
                    <PublisherAnalysisView publishers={publisherSummaries} settings={settings} />
                  )}
                  {activeSection === 'ssps' && (
                    <SspAnalysisView ssps={sspSummaries} settings={settings} />
                  )}
                  {activeSection === 'trends' && (
                    <TrendsAndAnomaliesPage
                      daily={dailySeries}
                      anomalies={anomalies}
                      settings={settings}
                      onNavigate={setActiveSection}
                    />
                  )}
                  {activeSection === 'ai-insights' && (
                    <AiInsightsPage
                      metadata={metadata}
                      metrics={aggregatedMetrics}
                      publishers={publisherSummaries}
                      ssps={sspSummaries}
                      anomalies={anomalies}
                      startDate={filters.startDate || dateBounds.minDate}
                      endDate={filters.endDate || dateBounds.maxDate}
                      settings={settings}
                      analysis={aiAnalysis}
                      analysisMeta={aiMeta}
                      onAnalysisComplete={(analysis, meta) => {
                        setAiAnalysis(analysis);
                        setAiMeta(meta);
                      }}
                    />
                  )}
                  {activeSection === 'reports' && (
                    <ReportsPage
                      metadata={metadata}
                      filteredRecords={filteredRecords}
                      metrics={aggregatedMetrics}
                      daily={dailySeries}
                      publishers={publisherSummaries}
                      ssps={sspSummaries}
                      anomalies={anomalies}
                      startDate={filters.startDate || dateBounds.minDate}
                      endDate={filters.endDate || dateBounds.maxDate}
                      settings={settings}
                      aiAnalysis={aiAnalysis}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onConfirmImport={loadDataset}
      />
    </div>
  );
}
