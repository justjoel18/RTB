import type { DashboardFilters, RtbRecord, StandardFieldKey } from '../types/rtb';
import { calculateAggregatedMetrics, computeRatesFromTotals } from './rtbEngine';

export interface VerificationResult {
  passed: boolean;
  checks: { name: string; passed: boolean; expected: string; actual: string }[];
}

/**
 * Small internal verification test dataset with manually verified expected results.
 * Tests:
 * 1. Exact RTB formulas (Bid Response Rate, Bid Participation Rate, Win Rate both definitions, Render Rate, Fill Rate, CPM)
 * 2. Aggregation from numerators/denominators rather than summing averages
 * 3. Division-by-zero returning null (never NaN/Infinity)
 * 4. Missing Eligible Ad Requests returning null Fill Rate (never substituting Bid Requests)
 * 5. Period-over-period revenue/impression/CPM change accuracy
 */
export function runRtbEngineVerification(): VerificationResult {
  const checks: VerificationResult['checks'] = [];

  const testRecords: RtbRecord[] = [
    // Prior period day
    {
      date: '2026-10-01',
      bidRequests: 1000,
      bidResponses: 500,
      submittedBids: 400,
      auctionWins: 100,
      impressions: 90,
      revenue: 0.45,
      eligibleAdRequests: 300,
      publisher: 'TestPub A',
      ssp: 'TestSSP 1',
      campaign: 'TestCamp',
      adUnit: 'Banner',
      country: 'US',
      device: 'Desktop',
    },
    // Current period day
    {
      date: '2026-10-02',
      bidRequests: 2000,
      bidResponses: 1200,
      submittedBids: 1000,
      auctionWins: 250,
      impressions: 200,
      revenue: 1.2,
      eligibleAdRequests: 500,
      publisher: 'TestPub A',
      ssp: 'TestSSP 1',
      campaign: 'TestCamp',
      adUnit: 'Banner',
      country: 'US',
      device: 'Desktop',
    },
  ];

  const allMapped: Record<StandardFieldKey, boolean> = {
    date: true,
    bidRequests: true,
    bidResponses: true,
    submittedBids: true,
    auctionWins: true,
    impressions: true,
    revenue: true,
    eligibleAdRequests: true,
    publisher: true,
    ssp: true,
    campaign: true,
    adUnit: true,
    country: true,
    device: true,
  };

  const filtersDay2: DashboardFilters = {
    startDate: '2026-10-02',
    endDate: '2026-10-02',
    publisher: 'ALL',
    ssp: 'ALL',
    campaign: 'ALL',
    country: 'ALL',
    device: 'ALL',
  };

  const day2Only = testRecords.filter((r) => r.date === '2026-10-02');
  const agg = calculateAggregatedMetrics(testRecords, day2Only, filtersDay2, allMapped, 'wins_over_submitted');

  const approx = (actual: number | null, expected: number, tol = 0.001) =>
    actual !== null && Math.abs(actual - expected) <= tol;

  checks.push({
    name: 'Bid Response Rate (1200/2000 * 100)',
    passed: approx(agg.bidResponseRate, 60),
    expected: '60.00%',
    actual: agg.bidResponseRate === null ? 'N/A' : `${agg.bidResponseRate.toFixed(2)}%`,
  });

  checks.push({
    name: 'Bid Participation Rate (1000/2000 * 100)',
    passed: approx(agg.bidParticipationRate, 50),
    expected: '50.00%',
    actual: agg.bidParticipationRate === null ? 'N/A' : `${agg.bidParticipationRate.toFixed(2)}%`,
  });

  checks.push({
    name: 'Win Rate Default: Wins/Submitted (250/1000 * 100)',
    passed: approx(agg.winRate, 25),
    expected: '25.00%',
    actual: agg.winRate === null ? 'N/A' : `${agg.winRate.toFixed(2)}%`,
  });

  const aggAlt = calculateAggregatedMetrics(testRecords, day2Only, filtersDay2, allMapped, 'wins_over_responses');
  checks.push({
    name: 'Win Rate Alternative: Wins/Responses (250/1200 * 100)',
    passed: approx(aggAlt.winRate, 20.8333, 0.01),
    expected: '20.83%',
    actual: aggAlt.winRate === null ? 'N/A' : `${aggAlt.winRate.toFixed(2)}%`,
  });

  checks.push({
    name: 'Render Rate (200/250 * 100)',
    passed: approx(agg.renderRate, 80),
    expected: '80.00%',
    actual: agg.renderRate === null ? 'N/A' : `${agg.renderRate.toFixed(2)}%`,
  });

  checks.push({
    name: 'Fill Rate (200/500 * 100)',
    passed: approx(agg.fillRate, 40),
    expected: '40.00%',
    actual: agg.fillRate === null ? 'N/A' : `${agg.fillRate.toFixed(2)}%`,
  });

  checks.push({
    name: 'CPM / eCPM ((1.20/200) * 1000)',
    passed: approx(agg.cpm, 6),
    expected: '$6.00',
    actual: agg.cpm === null ? 'N/A' : `$${agg.cpm.toFixed(2)}`,
  });

  checks.push({
    name: 'Prior-Period Revenue Change ((1.20 - 0.45)/0.45 * 100)',
    passed: approx(agg.comparison.revenueChangePct, 166.6667, 0.1),
    expected: '+166.7%',
    actual:
      agg.comparison.revenueChangePct === null ? 'N/A' : `+${agg.comparison.revenueChangePct.toFixed(1)}%`,
  });

  // Division by zero & unmapped Fill Rate guard
  const zeroCheck = computeRatesFromTotals(
    {
      bidRequests: 0,
      bidResponses: 0,
      submittedBids: 0,
      auctionWins: 0,
      impressions: 0,
      revenue: 0,
      eligibleAdRequests: 100,
    },
    'wins_over_submitted',
    false,
  );

  checks.push({
    name: 'Division by zero & unmapped Eligible Ad Requests return null',
    passed:
      zeroCheck.bidResponseRate === null &&
      zeroCheck.winRate === null &&
      zeroCheck.cpm === null &&
      zeroCheck.fillRate === null,
    expected: 'All null (N/A)',
    actual: `BRR=${zeroCheck.bidResponseRate}, WR=${zeroCheck.winRate}, CPM=${zeroCheck.cpm}, FR=${zeroCheck.fillRate}`,
  });

  // Aggregation-from-numerators test (never average two CPMs of unequal weight)
  // Day 1 CPM = $5.00 (90 imps, $0.45), Day 2 CPM = $6.00 (200 imps, $1.20)
  // Weighted combined CPM = (1.65 / 290) * 1000 = 5.6897 (NOT 5.50)
  const combinedFilters: DashboardFilters = { ...filtersDay2, startDate: '2026-10-01' };
  const combinedAgg = calculateAggregatedMetrics(
    testRecords,
    testRecords,
    combinedFilters,
    allMapped,
    'wins_over_submitted',
  );
  checks.push({
    name: 'Aggregated CPM uses summed Revenue/Impressions (5.69 vs naive avg 5.50)',
    passed: approx(combinedAgg.cpm, 5.6897, 0.01),
    expected: '$5.69',
    actual: combinedAgg.cpm === null ? 'N/A' : `$${combinedAgg.cpm.toFixed(2)}`,
  });

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}
