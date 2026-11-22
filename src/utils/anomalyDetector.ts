import { addDays, format, parseISO } from 'date-fns';
import type {
  AnomalyThresholds,
  DetectedAnomaly,
  RtbRecord,
  WinRateDefinition,
} from '../types/rtb';
import { aggregateDailyMetrics, computeRatesFromTotals } from './rtbEngine';

/**
 * Rule-based anomaly detection system.
 * Identifies performance shifts exceeding configured thresholds.
 * All outputs are framed strictly as investigation triggers, never as confirmed ad fraud or proven outages.
 */
export function detectAnomalies(
  records: RtbRecord[],
  thresholds: AnomalyThresholds,
  winRateDefinition: WinRateDefinition,
): DetectedAnomaly[] {
  if (records.length === 0) return [];

  const anomalies: DetectedAnomaly[] = [];
  const dailyOverall = aggregateDailyMetrics(records, winRateDefinition);

  // 1. Detect Missing Reporting Dates in the overall date range
  if (dailyOverall.length >= 2) {
    const reportedDates = new Set(dailyOverall.map((d) => d.date));
    let cursor = parseISO(dailyOverall[0].date);
    const endDt = parseISO(dailyOverall[dailyOverall.length - 1].date);

    while (cursor <= endDt) {
      const iso = format(cursor, 'yyyy-MM-dd');
      if (!reportedDates.has(iso)) {
        anomalies.push({
          id: `missing-date-${iso}`,
          type: 'Missing Reporting Date',
          affectedDate: iso,
          entityType: 'Overall',
          entityName: 'All Traffic',
          previousValue: null,
          currentValue: 0,
          percentageChange: null,
          unit: 'days',
          severity: 'High',
          summary: `No reporting rows present for ${iso} inside the active date span.`,
          suggestedInvestigationSteps: [
            'Check DSP/SSP scheduled report delivery logs for failed or delayed exports on this date.',
            'Verify timezone alignment (UTC vs account local time) between upstream ad servers.',
            'Confirm whether campaigns were intentionally paused across all publishers on this date.',
          ],
        });
      }
      cursor = addDays(cursor, 1);
    }
  }

  // Helper to evaluate sequential daily points for an entity slice
  const evaluateSeries = (
    entityType: 'Overall' | 'Publisher' | 'SSP',
    entityName: string,
    series: ReturnType<typeof aggregateDailyMetrics>,
  ) => {
    for (let i = 0; i < series.length; i++) {
      const curr = series[i];

      // Zero-impression period detection (when upstream demand or wins occurred but impressions = 0)
      if (curr.impressions === 0 && (curr.auctionWins > 0 || curr.bidRequests > 0)) {
        anomalies.push({
          id: `zero-imp-${entityType}-${entityName}-${curr.date}`,
          type: 'Zero-Impression Period',
          affectedDate: curr.date,
          entityType,
          entityName,
          previousValue: i > 0 ? series[i - 1].impressions : null,
          currentValue: 0,
          percentageChange: i > 0 && series[i - 1].impressions > 0 ? -100 : null,
          unit: 'count',
          severity: 'High',
          summary: `Zero impressions recorded for ${entityName} on ${curr.date} despite ${curr.auctionWins.toLocaleString()} auction wins and ${curr.bidRequests.toLocaleString()} bid requests.`,
          suggestedInvestigationSteps: [
            'Inspect VAST/creative markup or rendering beacon firing failures on the publisher page or SDK.',
            'Check if ad-blocking scripts or invalid SSL/secure-creative mismatches prevented creative render after win.',
            'Verify whether billing/reporting reconciliation dropped impression pixel events.',
          ],
        });
      }

      if (i === 0) continue;
      const prev = series[i - 1];

      // Sudden drop in impressions
      if (prev.impressions > 0) {
        const impChange = ((curr.impressions - prev.impressions) / prev.impressions) * 100;
        if (impChange <= -thresholds.impressionChangePct) {
          anomalies.push({
            id: `imp-drop-${entityType}-${entityName}-${curr.date}`,
            type: 'Impression Drop',
            affectedDate: curr.date,
            entityType,
            entityName,
            previousValue: prev.impressions,
            currentValue: curr.impressions,
            percentageChange: impChange,
            unit: 'count',
            severity: Math.abs(impChange) >= thresholds.impressionChangePct * 1.75 ? 'High' : 'Medium',
            summary: `Impressions declined ${Math.abs(impChange).toFixed(1)}% day-over-day (${prev.impressions.toLocaleString()} to ${curr.impressions.toLocaleString()}).`,
            suggestedInvestigationSteps: [
              'Check campaign pacing caps, daily budget exhaustion, or line-item end dates.',
              'Review upstream bid request volume and render rate changes on the same date.',
              'Confirm no creative disapproval or ads.txt / sellers.json compliance block occurred.',
            ],
          });
        }
      }

      // Sudden drop in revenue
      if (prev.revenue > 0) {
        const revChange = ((curr.revenue - prev.revenue) / prev.revenue) * 100;
        if (revChange <= -thresholds.revenueChangePct) {
          anomalies.push({
            id: `rev-drop-${entityType}-${entityName}-${curr.date}`,
            type: 'Revenue Drop',
            affectedDate: curr.date,
            entityType,
            entityName,
            previousValue: prev.revenue,
            currentValue: curr.revenue,
            percentageChange: revChange,
            unit: 'currency',
            severity: Math.abs(revChange) >= thresholds.revenueChangePct * 1.75 ? 'High' : 'Medium',
            summary: `Revenue dropped ${Math.abs(revChange).toFixed(1)}% compared to the prior reporting day.`,
            suggestedInvestigationSteps: [
              'Isolate whether revenue loss was driven by lower impression volume or lower clearing CPM.',
              'Inspect buyer spend pacing and PMP deal eligibility changes.',
              'Review floor price updates or auction mechanics adjustments made around this date.',
            ],
          });
        }
      }

      // Unusual CPM change (either sharp drop or spike)
      if (prev.cpm !== null && prev.cpm > 0 && curr.cpm !== null) {
        const cpmChange = ((curr.cpm - prev.cpm) / prev.cpm) * 100;
        if (Math.abs(cpmChange) >= thresholds.cpmChangePct) {
          anomalies.push({
            id: `cpm-shift-${entityType}-${entityName}-${curr.date}`,
            type: 'CPM Shift',
            affectedDate: curr.date,
            entityType,
            entityName,
            previousValue: prev.cpm,
            currentValue: curr.cpm,
            percentageChange: cpmChange,
            unit: 'cpm',
            severity: Math.abs(cpmChange) >= thresholds.cpmChangePct * 1.6 ? 'High' : 'Medium',
            summary: `CPM shifted ${cpmChange > 0 ? '+' : ''}${cpmChange.toFixed(1)}% (${prev.cpm.toFixed(2)} to ${curr.cpm.toFixed(2)}).`,
            suggestedInvestigationSteps: [
              'Check changes in geo, device, or ad-format mix (e.g., CTV vs Mobile Web share shift).',
              'Verify whether PMP / preferred deals started or paused on this date.',
              'Review floor pricing rules and bid shading behavior in DSP/SSP logs.',
            ],
          });
        }
      }

      // Bid response rate deterioration (percentage-point drop)
      if (prev.bidResponseRate !== null && curr.bidResponseRate !== null) {
        const brrDiffPts = curr.bidResponseRate - prev.bidResponseRate;
        if (brrDiffPts <= -thresholds.bidResponseRateChangePts) {
          anomalies.push({
            id: `brr-drop-${entityType}-${entityName}-${curr.date}`,
            type: 'Bid Response Deterioration',
            affectedDate: curr.date,
            entityType,
            entityName,
            previousValue: prev.bidResponseRate,
            currentValue: curr.bidResponseRate,
            percentageChange: brrDiffPts,
            unit: 'percent',
            severity: Math.abs(brrDiffPts) >= thresholds.bidResponseRateChangePts * 1.5 ? 'High' : 'Medium',
            summary: `Bid Response Rate fell by ${Math.abs(brrDiffPts).toFixed(1)} percentage points (${prev.bidResponseRate.toFixed(1)}% to ${curr.bidResponseRate.toFixed(1)}%).`,
            suggestedInvestigationSteps: [
              'Check DSP/SSP endpoint timeout rates (TMAX latency breaches) and QPS throttling.',
              'Verify bid request formatting (missing user IDs, GDPR/CCPA consent strings, or schain fields).',
              'Review targeting exclusions or brand-safety pre-bid filter updates.',
            ],
          });
        }
      }

      // Win rate deterioration (percentage-point drop)
      if (prev.winRate !== null && curr.winRate !== null) {
        const wrDiffPts = curr.winRate - prev.winRate;
        if (wrDiffPts <= -thresholds.winRateChangePts) {
          anomalies.push({
            id: `wr-drop-${entityType}-${entityName}-${curr.date}`,
            type: 'Win Rate Deterioration',
            affectedDate: curr.date,
            entityType,
            entityName,
            previousValue: prev.winRate,
            currentValue: curr.winRate,
            percentageChange: wrDiffPts,
            unit: 'percent',
            severity: Math.abs(wrDiffPts) >= thresholds.winRateChangePts * 1.5 ? 'Medium' : 'Low',
            summary: `Win Rate declined by ${Math.abs(wrDiffPts).toFixed(1)} percentage points (${prev.winRate.toFixed(1)}% to ${curr.winRate.toFixed(1)}%).`,
            suggestedInvestigationSteps: [
              'Check whether exchange floor prices increased or competing DSP demand intensified.',
              'Evaluate bid shading aggressiveness and max bid CPM ceilings.',
              'Inspect auction loss reason codes (floor price vs outbid vs creative policy) in bidder logs.',
            ],
          });
        }
      }

      // Unusual traffic increase (bid requests surge)
      if (prev.bidRequests > 0) {
        const reqChange = ((curr.bidRequests - prev.bidRequests) / prev.bidRequests) * 100;
        if (reqChange >= thresholds.trafficSurgePct) {
          anomalies.push({
            id: `traffic-surge-${entityType}-${entityName}-${curr.date}`,
            type: 'Traffic Surge',
            affectedDate: curr.date,
            entityType,
            entityName,
            previousValue: prev.bidRequests,
            currentValue: curr.bidRequests,
            percentageChange: reqChange,
            unit: 'count',
            severity: reqChange >= thresholds.trafficSurgePct * 2 ? 'High' : 'Low',
            summary: `Bid request volume surged +${reqChange.toFixed(1)}% (${prev.bidRequests.toLocaleString()} to ${curr.bidRequests.toLocaleString()}). Investigation trigger—requires traffic-quality and placement review.`,
            suggestedInvestigationSteps: [
              'Confirm whether the publisher launched new ad placements, pages, or seasonal events.',
              'Check if an SSP QPS allocation or pre-targeting rule was broadened.',
              'Review post-bid traffic quality reports and viewability metrics to validate inventory quality (do not assume fraud without verification).',
            ],
          });
        }
      }
    }
  };

  evaluateSeries('Overall', 'All Traffic', dailyOverall);

  // Evaluate per Publisher
  const pubGroups = new Map<string, RtbRecord[]>();
  const sspGroups = new Map<string, RtbRecord[]>();
  for (const r of records) {
    if (r.publisher && r.publisher !== 'Unspecified') {
      const arr = pubGroups.get(r.publisher) ?? [];
      arr.push(r);
      pubGroups.set(r.publisher, arr);
    }
    if (r.ssp && r.ssp !== 'Unspecified') {
      const arr = sspGroups.get(r.ssp) ?? [];
      arr.push(r);
      sspGroups.set(r.ssp, arr);
    }
  }

  for (const [pubName, pubRows] of pubGroups.entries()) {
    evaluateSeries('Publisher', pubName, aggregateDailyMetrics(pubRows, winRateDefinition));
  }

  for (const [sspName, sspRows] of sspGroups.entries()) {
    evaluateSeries('SSP', sspName, aggregateDailyMetrics(sspRows, winRateDefinition));
  }

  // Sort by severity (High -> Medium -> Low), then date descending
  const severityRank = { High: 0, Medium: 1, Low: 2 };
  return anomalies.sort((a, b) => {
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return b.affectedDate.localeCompare(a.affectedDate);
  });
}

/**
 * Helper to compute single-row rates when needed (used internally only for verification).
 */
export function computeSingleRowRates(row: RtbRecord, winRateDefinition: WinRateDefinition) {
  return computeRatesFromTotals(
    {
      bidRequests: row.bidRequests,
      bidResponses: row.bidResponses,
      submittedBids: row.submittedBids,
      auctionWins: row.auctionWins,
      impressions: row.impressions,
      revenue: row.revenue,
      eligibleAdRequests: row.eligibleAdRequests,
    },
    winRateDefinition,
    row.eligibleAdRequests !== null,
  );
}
