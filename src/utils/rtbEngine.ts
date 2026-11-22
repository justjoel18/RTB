import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import type {
  AggregatedMetrics,
  CurrencyCode,
  DailyMetricPoint,
  DashboardFilters,
  EntitySummary,
  NumberFormatMode,
  PeriodComparison,
  RtbRecord,
  StandardFieldKey,
  WinRateDefinition,
} from '../types/rtb';

/**
 * Safe division helper.
 * Prevents division by zero, NaN, or Infinity. Returns null when denominator is <= 0 or unavailable.
 */
export function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null;
  return numerator / denominator;
}

/**
 * Filter RTB records by date range and dimension filters.
 */
export function filterRecords(records: RtbRecord[], filters: DashboardFilters): RtbRecord[] {
  return records.filter((row) => {
    if (filters.startDate && row.date < filters.startDate) return false;
    if (filters.endDate && row.date > filters.endDate) return false;
    if (filters.publisher !== 'ALL' && row.publisher !== filters.publisher) return false;
    if (filters.ssp !== 'ALL' && row.ssp !== filters.ssp) return false;
    if (filters.campaign !== 'ALL' && row.campaign !== filters.campaign) return false;
    if (filters.country !== 'ALL' && row.country !== filters.country) return false;
    if (filters.device !== 'ALL' && row.device !== filters.device) return false;
    return true;
  });
}

/**
 * Filter records by dimension filters only (ignoring date range) so prior period comparisons
 * can evaluate the immediately preceding window for the same publisher/SSP/campaign slice.
 */
export function filterRecordsByDimensions(records: RtbRecord[], filters: DashboardFilters): RtbRecord[] {
  return records.filter((row) => {
    if (filters.publisher !== 'ALL' && row.publisher !== filters.publisher) return false;
    if (filters.ssp !== 'ALL' && row.ssp !== filters.ssp) return false;
    if (filters.campaign !== 'ALL' && row.campaign !== filters.campaign) return false;
    if (filters.country !== 'ALL' && row.country !== filters.country) return false;
    if (filters.device !== 'ALL' && row.device !== filters.device) return false;
    return true;
  });
}

/**
 * Deterministic RTB metric calculation from aggregated numerators and denominators.
 * Never sums average metrics or ratios.
 */
export function computeRatesFromTotals(
  totals: {
    bidRequests: number | null;
    bidResponses: number | null;
    submittedBids: number | null;
    auctionWins: number | null;
    impressions: number | null;
    revenue: number | null;
    eligibleAdRequests: number | null;
  },
  winRateDefinition: WinRateDefinition,
  hasEligibleAdRequestsField: boolean,
) {
  // A. Bid Response Rate = (Bid Responses / Bid Requests) * 100
  const bidResponseRateRatio = safeDivide(totals.bidResponses, totals.bidRequests);
  const bidResponseRate = bidResponseRateRatio !== null ? bidResponseRateRatio * 100 : null;

  // B. Bid Participation Rate = (Submitted Bids / Bid Requests) * 100
  const bidParticipationRatio = safeDivide(totals.submittedBids, totals.bidRequests);
  const bidParticipationRate = bidParticipationRatio !== null ? bidParticipationRatio * 100 : null;

  // C. Win Rate:
  //    Default: (Auction Wins / Submitted Bids) * 100
  //    Alternative: (Auction Wins / Bid Responses) * 100
  const winDenominator =
    winRateDefinition === 'wins_over_submitted' ? totals.submittedBids : totals.bidResponses;
  const winRateRatio = safeDivide(totals.auctionWins, winDenominator);
  const winRate = winRateRatio !== null ? winRateRatio * 100 : null;

  // D. Render Rate = (Impressions / Auction Wins) * 100
  const renderRateRatio = safeDivide(totals.impressions, totals.auctionWins);
  const renderRate = renderRateRatio !== null ? renderRateRatio * 100 : null;

  // E. Fill Rate = (Impressions / Eligible Ad Requests) * 100
  //    Strictly calculated ONLY if a valid Eligible Ad Requests field is mapped and > 0.
  //    Never substitutes Bid Requests as Eligible Ad Requests.
  const fillRateRatio = hasEligibleAdRequestsField
    ? safeDivide(totals.impressions, totals.eligibleAdRequests)
    : null;
  const fillRate = fillRateRatio !== null ? fillRateRatio * 100 : null;

  // F. CPM / eCPM = (Revenue / Impressions) * 1,000
  const revenuePerImp = safeDivide(totals.revenue, totals.impressions);
  const cpm = revenuePerImp !== null ? revenuePerImp * 1000 : null;

  return {
    bidResponseRate,
    bidParticipationRate,
    winRate,
    renderRate,
    fillRate,
    cpm,
  };
}

/**
 * Compute full aggregated KPIs and previous-period comparisons.
 */
export function calculateAggregatedMetrics(
  allRecords: RtbRecord[],
  filteredRecords: RtbRecord[],
  filters: DashboardFilters,
  mappedFields: Record<StandardFieldKey, boolean>,
  winRateDefinition: WinRateDefinition,
): AggregatedMetrics {
  const unavailableMetrics: { metric: string; reason: string }[] = [];

  if (!mappedFields.eligibleAdRequests) {
    unavailableMetrics.push({
      metric: 'Fill Rate',
      reason:
        'Eligible Ad Requests column is not mapped. Bid Requests are intentionally not substituted for Eligible Ad Requests.',
    });
  }

  let totalBidRequests: number | null = mappedFields.bidRequests ? 0 : null;
  let totalBidResponses: number | null = mappedFields.bidResponses ? 0 : null;
  let totalSubmittedBids: number | null = mappedFields.submittedBids ? 0 : null;
  let totalAuctionWins: number | null = mappedFields.auctionWins ? 0 : null;
  let totalImpressions: number | null = mappedFields.impressions ? 0 : null;
  let totalRevenue: number | null = mappedFields.revenue ? 0 : null;
  let totalEligibleAdRequests: number | null = mappedFields.eligibleAdRequests ? 0 : null;

  const dateSet = new Set<string>();
  let hasAnyEligibleValue = false;

  for (const r of filteredRecords) {
    dateSet.add(r.date);
    if (totalBidRequests !== null && r.bidRequests !== null) totalBidRequests += r.bidRequests;
    if (totalBidResponses !== null && r.bidResponses !== null) totalBidResponses += r.bidResponses;
    if (totalSubmittedBids !== null && r.submittedBids !== null) totalSubmittedBids += r.submittedBids;
    if (totalAuctionWins !== null && r.auctionWins !== null) totalAuctionWins += r.auctionWins;
    if (totalImpressions !== null && r.impressions !== null) totalImpressions += r.impressions;
    if (totalRevenue !== null && r.revenue !== null) totalRevenue += r.revenue;
    if (totalEligibleAdRequests !== null && r.eligibleAdRequests !== null) {
      totalEligibleAdRequests += r.eligibleAdRequests;
      if (r.eligibleAdRequests > 0) hasAnyEligibleValue = true;
    }
  }

  if (mappedFields.eligibleAdRequests && !hasAnyEligibleValue) {
    totalEligibleAdRequests = null;
    unavailableMetrics.push({
      metric: 'Fill Rate',
      reason: 'Eligible Ad Requests total is zero or empty in the filtered slice.',
    });
  }

  const rates = computeRatesFromTotals(
    {
      bidRequests: totalBidRequests,
      bidResponses: totalBidResponses,
      submittedBids: totalSubmittedBids,
      auctionWins: totalAuctionWins,
      impressions: totalImpressions,
      revenue: totalRevenue,
      eligibleAdRequests: totalEligibleAdRequests,
    },
    winRateDefinition,
    mappedFields.eligibleAdRequests && hasAnyEligibleValue,
  );

  // H. Average Bid Response Volume = Total Bid Responses / distinct reporting days
  const distinctDays = dateSet.size;
  const avgDailyBidResponses = safeDivide(totalBidResponses, distinctDays > 0 ? distinctDays : null);

  // Previous-period comparison (I. Revenue Change, J. Impression Change, K. CPM Change)
  const comparison = computePriorPeriodComparison(
    allRecords,
    filters,
    totalRevenue,
    totalImpressions,
    rates.cpm,
  );

  return {
    totalBidRequests,
    totalBidResponses,
    totalSubmittedBids,
    totalAuctionWins,
    totalImpressions,
    totalRevenue,
    totalEligibleAdRequests,
    bidResponseRate: rates.bidResponseRate,
    bidParticipationRate: rates.bidParticipationRate,
    winRate: rates.winRate,
    renderRate: rates.renderRate,
    fillRate: rates.fillRate,
    cpm: rates.cpm,
    avgDailyBidResponses,
    distinctDays,
    recordCount: filteredRecords.length,
    comparison,
    unavailableMetrics,
  };
}

function computePriorPeriodComparison(
  allRecords: RtbRecord[],
  filters: DashboardFilters,
  currentRevenue: number | null,
  currentImpressions: number | null,
  currentCpm: number | null,
): PeriodComparison {
  const dimensionFiltered = filterRecordsByDimensions(allRecords, filters);
  if (dimensionFiltered.length === 0) {
    return {
      revenueChangePct: null,
      impressionChangePct: null,
      cpmChangePct: null,
      hasComparablePriorPeriod: false,
      priorStartDate: null,
      priorEndDate: null,
      reasonIfUnavailable: 'No records available for comparison.',
    };
  }

  const sortedDates = Array.from(new Set(dimensionFiltered.map((r) => r.date))).sort();
  const effectiveStart = filters.startDate || sortedDates[0];
  const effectiveEnd = filters.endDate || sortedDates[sortedDates.length - 1];

  if (!effectiveStart || !effectiveEnd) {
    return {
      revenueChangePct: null,
      impressionChangePct: null,
      cpmChangePct: null,
      hasComparablePriorPeriod: false,
      priorStartDate: null,
      priorEndDate: null,
      reasonIfUnavailable: 'Unable to determine date window for prior-period comparison.',
    };
  }

  const startDt = parseISO(effectiveStart);
  const endDt = parseISO(effectiveEnd);
  const spanDays = Math.max(1, differenceInCalendarDays(endDt, startDt) + 1);

  const priorEndDt = subDays(startDt, 1);
  const priorStartDt = subDays(priorEndDt, spanDays - 1);
  const priorStartDate = format(priorStartDt, 'yyyy-MM-dd');
  const priorEndDate = format(priorEndDt, 'yyyy-MM-dd');

  const priorRows = dimensionFiltered.filter(
    (r) => r.date >= priorStartDate && r.date <= priorEndDate,
  );

  // If the user selected the entire available dataset, there is no prior window before startDate.
  // In that case, do not fabricate a comparison—return null with an explicit explanation.
  if (priorRows.length === 0) {
    return {
      revenueChangePct: null,
      impressionChangePct: null,
      cpmChangePct: null,
      hasComparablePriorPeriod: false,
      priorStartDate,
      priorEndDate,
      reasonIfUnavailable: `No reporting data found for the preceding ${spanDays}-day window (${priorStartDate} to ${priorEndDate}). Select a narrower date range (e.g. Last 14 Days) to compare against the prior period.`,
    };
  }

  let prevRevenue = 0;
  let prevImpressions = 0;
  for (const r of priorRows) {
    if (r.revenue !== null) prevRevenue += r.revenue;
    if (r.impressions !== null) prevImpressions += r.impressions;
  }
  const prevCpmRatio = safeDivide(prevRevenue, prevImpressions);
  const prevCpm = prevCpmRatio !== null ? prevCpmRatio * 1000 : null;

  const revenueChangePct =
    currentRevenue !== null && prevRevenue > 0
      ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
      : null;

  const impressionChangePct =
    currentImpressions !== null && prevImpressions > 0
      ? ((currentImpressions - prevImpressions) / prevImpressions) * 100
      : null;

  const cpmChangePct =
    currentCpm !== null && prevCpm !== null && prevCpm > 0
      ? ((currentCpm - prevCpm) / prevCpm) * 100
      : null;

  return {
    revenueChangePct,
    impressionChangePct,
    cpmChangePct,
    hasComparablePriorPeriod: true,
    priorStartDate,
    priorEndDate,
  };
}

/**
 * Aggregate daily trend series strictly from daily sums.
 */
export function aggregateDailyMetrics(
  records: RtbRecord[],
  winRateDefinition: WinRateDefinition,
): DailyMetricPoint[] {
  const byDate = new Map<
    string,
    {
      bidRequests: number;
      bidResponses: number;
      submittedBids: number;
      auctionWins: number;
      impressions: number;
      revenue: number;
      eligibleAdRequests: number;
    }
  >();

  for (const r of records) {
    const existing = byDate.get(r.date) ?? {
      bidRequests: 0,
      bidResponses: 0,
      submittedBids: 0,
      auctionWins: 0,
      impressions: 0,
      revenue: 0,
      eligibleAdRequests: 0,
    };
    existing.bidRequests += r.bidRequests ?? 0;
    existing.bidResponses += r.bidResponses ?? 0;
    existing.submittedBids += r.submittedBids ?? 0;
    existing.auctionWins += r.auctionWins ?? 0;
    existing.impressions += r.impressions ?? 0;
    existing.revenue += r.revenue ?? 0;
    existing.eligibleAdRequests += r.eligibleAdRequests ?? 0;
    byDate.set(r.date, existing);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totals]) => {
      const rates = computeRatesFromTotals(totals, winRateDefinition, totals.eligibleAdRequests > 0);
      return {
        date,
        ...totals,
        cpm: rates.cpm,
        bidResponseRate: rates.bidResponseRate,
        winRate: rates.winRate,
        renderRate: rates.renderRate,
      };
    });
}

/**
 * Aggregate metrics by a categorical dimension (publisher, ssp, campaign, etc.).
 * Computes first-half vs second-half revenue trend and daily coefficient of variation for fluctuations.
 */
export function aggregateByDimension(
  records: RtbRecord[],
  dimension: 'publisher' | 'ssp' | 'campaign' | 'country' | 'device',
  winRateDefinition: WinRateDefinition,
  hasEligibleAdRequestsField: boolean,
): EntitySummary[] {
  const grouped = new Map<string, RtbRecord[]>();
  for (const r of records) {
    const key = r[dimension] || 'Unspecified';
    const arr = grouped.get(key);
    if (arr) arr.push(r);
    else grouped.set(key, [r]);
  }

  let grandTotalRevenue = 0;
  for (const r of records) {
    grandTotalRevenue += r.revenue ?? 0;
  }

  const summaries: EntitySummary[] = [];

  for (const [name, rows] of grouped.entries()) {
    let totalBidRequests = 0;
    let totalBidResponses = 0;
    let totalSubmittedBids = 0;
    let totalAuctionWins = 0;
    let totalImpressions = 0;
    let totalRevenue = 0;
    let totalEligibleAdRequests = 0;

    const dailyRevenue = new Map<string, number>();

    for (const r of rows) {
      totalBidRequests += r.bidRequests ?? 0;
      totalBidResponses += r.bidResponses ?? 0;
      totalSubmittedBids += r.submittedBids ?? 0;
      totalAuctionWins += r.auctionWins ?? 0;
      totalImpressions += r.impressions ?? 0;
      totalRevenue += r.revenue ?? 0;
      totalEligibleAdRequests += r.eligibleAdRequests ?? 0;
      dailyRevenue.set(r.date, (dailyRevenue.get(r.date) ?? 0) + (r.revenue ?? 0));
    }

    const rates = computeRatesFromTotals(
      {
        bidRequests: totalBidRequests,
        bidResponses: totalBidResponses,
        submittedBids: totalSubmittedBids,
        auctionWins: totalAuctionWins,
        impressions: totalImpressions,
        revenue: totalRevenue,
        eligibleAdRequests: totalEligibleAdRequests,
      },
      winRateDefinition,
      hasEligibleAdRequestsField && totalEligibleAdRequests > 0,
    );

    // Split entity's sorted reporting days into first half vs second half to detect declining revenue
    const sortedDailyEntries = Array.from(dailyRevenue.entries()).sort(([a], [b]) => a.localeCompare(b));
    let revenueTrendPct: number | null = null;
    if (sortedDailyEntries.length >= 4) {
      const mid = Math.floor(sortedDailyEntries.length / 2);
      const firstHalfSum = sortedDailyEntries.slice(0, mid).reduce((acc, [, v]) => acc + v, 0);
      const secondHalfSum = sortedDailyEntries.slice(mid).reduce((acc, [, v]) => acc + v, 0);
      if (firstHalfSum > 0) {
        // Normalize by day count in each half so odd day counts stay fair
        const firstAvg = firstHalfSum / mid;
        const secondAvg = secondHalfSum / (sortedDailyEntries.length - mid);
        revenueTrendPct = ((secondAvg - firstAvg) / firstAvg) * 100;
      }
    }

    // Coefficient of variation (CV = stdDev / mean) across daily revenue to flag unusual fluctuations
    let volatilityScore: number | null = null;
    if (sortedDailyEntries.length >= 3) {
      const vals = sortedDailyEntries.map(([, v]) => v);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (mean > 0) {
        const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / vals.length;
        volatilityScore = (Math.sqrt(variance) / mean) * 100;
      }
    }

    summaries.push({
      name,
      totalBidRequests,
      totalBidResponses,
      totalSubmittedBids,
      totalAuctionWins,
      totalImpressions,
      totalRevenue,
      totalEligibleAdRequests,
      cpm: rates.cpm,
      bidResponseRate: rates.bidResponseRate,
      bidParticipationRate: rates.bidParticipationRate,
      winRate: rates.winRate,
      renderRate: rates.renderRate,
      fillRate: rates.fillRate,
      revenueSharePct: grandTotalRevenue > 0 ? (totalRevenue / grandTotalRevenue) * 100 : null,
      revenueTrendPct,
      volatilityScore,
    });
  }

  return summaries.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Formatting helpers respecting user Settings.
 */
export function formatCount(value: number | null, mode: NumberFormatMode = 'compact'): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  if (mode === 'compact') {
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatCurrency(
  value: number | null,
  currency: CurrencyCode = 'USD',
  mode: NumberFormatMode = 'standard',
  decimals = 2,
): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  const effectiveDecimals = currency === 'JPY' ? 0 : decimals;
  if (mode === 'compact' && Math.abs(value) >= 100_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: effectiveDecimals,
    maximumFractionDigits: effectiveDecimals,
  }).format(value);
}

export function formatPercent(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(decimals)}%`;
}

export function formatDelta(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}
