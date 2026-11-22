import { addDays, format, subDays } from 'date-fns';
import type { DatasetMetadata, RtbRecord } from '../types/rtb';

/**
 * Generates a realistic 30-day synthetic RTB campaign dataset with intentional fluctuations
 * (declining publisher revenue, zero-impression incident, SSP bid response drop, traffic surge,
 * and 1 missing reporting day) so users can explore metrics and rule-based anomaly detection.
 *
 * Strictly labeled as Synthetic Demo Data across the UI.
 */
export function generateSyntheticDemoDataset(): {
  records: RtbRecord[];
  metadata: DatasetMetadata;
} {
  const endDate = new Date('2026-11-20T12:00:00Z');
  const startDate = subDays(endDate, 29);

  const publishers = [
    { name: 'Apex News Network', baseReq: 420000, baseRespRate: 0.72, baseWinRate: 0.31, baseRender: 0.94, baseCpm: 3.45, adUnit: 'Leaderboard_728x90' },
    { name: 'Veloce Sports Daily', baseReq: 360000, baseRespRate: 0.68, baseWinRate: 0.28, baseRender: 0.92, baseCpm: 4.10, adUnit: 'Video_Outstream' },
    { name: 'Meridian Tech Hub', baseReq: 290000, baseRespRate: 0.74, baseWinRate: 0.34, baseRender: 0.95, baseCpm: 4.85, adUnit: 'Sidebar_300x600' },
    { name: 'Harbor Lifestyle Media', baseReq: 250000, baseRespRate: 0.65, baseWinRate: 0.26, baseRender: 0.91, baseCpm: 2.75, adUnit: 'Mobile_320x50' },
  ];

  const ssps = [
    { name: 'Magnite Exchange', share: 0.32, respMult: 1.04, winMult: 1.06, cpmMult: 1.08, renderMult: 1.01 },
    { name: 'PubMatic Open', share: 0.28, respMult: 1.00, winMult: 1.02, cpmMult: 1.02, renderMult: 1.00 },
    { name: 'Index Exchange', share: 0.23, respMult: 0.96, winMult: 0.98, cpmMult: 1.04, renderMult: 0.99 },
    { name: 'OpenX BidStream', share: 0.17, respMult: 0.90, winMult: 0.89, cpmMult: 0.88, renderMult: 0.97 },
  ];

  const campaigns = ['Q4 Brand Reach', 'Holiday Retail Retargeting', 'CTV Awareness Tier-1'];
  const countries = ['US', 'GB', 'DE', 'CA', 'JP'];
  const devices = ['Desktop', 'Mobile Web', 'CTV', 'In-App'];

  const records: RtbRecord[] = [];

  for (let dayIdx = 0; dayIdx < 30; dayIdx++) {
    const dt = addDays(startDate, dayIdx);
    const dateStr = format(dt, 'yyyy-MM-dd');

    // Day 11 (index 10) is intentionally omitted to exercise Missing Reporting Date anomaly check
    if (dayIdx === 10) continue;

    // Gentle weekday/weekend seasonality factor
    const dayOfWeek = dt.getUTCDay();
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.88 : 1.04;

    publishers.forEach((pub, pIdx) => {
      ssps.forEach((ssp, sIdx) => {
        // Deterministic pseudo-random jitter so demo data is reproducible across reloads
        const seed = Math.sin((dayIdx + 1) * 17 + (pIdx + 1) * 31 + (sIdx + 1) * 47);
        const jitter = 1 + seed * 0.06;

        let reqMult = weekendFactor * jitter;
        let respRate = pub.baseRespRate * ssp.respMult;
        let winRate = pub.baseWinRate * ssp.winMult;
        let renderRate = Math.min(0.98, pub.baseRender * ssp.renderMult);
        let cpm = pub.baseCpm * ssp.cpmMult * (1 + seed * 0.04);

        // Intentional anomaly 1: Meridian Tech Hub experiences a sustained revenue decline in days 17-29
        if (pub.name === 'Meridian Tech Hub' && dayIdx >= 17) {
          reqMult *= 0.68;
          cpm *= 0.82;
        }

        // Intentional anomaly 2: Apex News Network has a zero-impression reporting incident on day 18
        const forceZeroImpressions = pub.name === 'Apex News Network' && dayIdx === 18;

        // Intentional anomaly 3: OpenX BidStream suffers bid response rate deterioration on days 20-21
        if (ssp.name === 'OpenX BidStream' && (dayIdx === 20 || dayIdx === 21)) {
          respRate *= 0.56;
        }

        // Intentional anomaly 4: Harbor Lifestyle Media experiences an unusual traffic surge & CPM drop on days 23-24
        if (pub.name === 'Harbor Lifestyle Media' && (dayIdx === 23 || dayIdx === 24)) {
          reqMult *= 1.85;
          cpm *= 0.64;
        }

        // Intentional anomaly 5: Global impression & revenue drop on day 26 (e.g., campaign pacing pause)
        if (dayIdx === 26) {
          reqMult *= 0.62;
          winRate *= 0.78;
        }

        const eligibleAdRequests = Math.round(pub.baseReq * ssp.share * reqMult * 0.86);
        const bidRequests = Math.round(pub.baseReq * ssp.share * reqMult);
        const bidResponses = Math.round(bidRequests * Math.min(0.95, respRate));
        const submittedBids = Math.round(bidResponses * 0.91);
        const auctionWins = Math.round(submittedBids * Math.min(0.85, winRate));
        const impressions = forceZeroImpressions ? 0 : Math.round(auctionWins * renderRate);
        const revenue = forceZeroImpressions ? 0 : Number(((impressions / 1000) * cpm).toFixed(2));

        const campaign = campaigns[(dayIdx + pIdx + sIdx) % campaigns.length];
        const country = countries[(pIdx + sIdx + dayIdx) % countries.length];
        const device = devices[(pIdx * 2 + sIdx) % devices.length];

        records.push({
          date: dateStr,
          bidRequests,
          bidResponses,
          submittedBids,
          auctionWins,
          impressions,
          revenue,
          eligibleAdRequests,
          publisher: pub.name,
          ssp: ssp.name,
          campaign,
          adUnit: pub.adUnit,
          country,
          device,
        });
      });
    });
  }

  const metadata: DatasetMetadata = {
    sourceName: 'Synthetic Demo Data (30-Day RTB Campaign)',
    isDemoData: true,
    uploadedAt: new Date().toISOString(),
    mappedFields: {
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
    },
    missingRequiredFields: [],
    uncalculableMetrics: [],
    importSummary: {
      totalRows: records.length,
      validRows: records.length,
      invalidRows: 0,
      missingValuesCount: 0,
      duplicateCount: 0,
      importedRows: records.length,
      rejectedRows: [],
    },
  };

  return { records, metadata };
}
