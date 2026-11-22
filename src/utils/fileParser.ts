import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { format, isValid, parse, parseISO } from 'date-fns';
import type {
  ColumnMapping,
  DatasetMetadata,
  ImportSummary,
  RejectedRowInfo,
  RtbRecord,
  StandardFieldKey,
} from '../types/rtb';

export interface ParsedWorkbookPreview {
  fileName: string;
  fileType: 'csv' | 'excel';
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rows: Record<string, string>[];
  rawWorkbook?: XLSX.WorkBook;
}

export interface FieldDefinition {
  key: StandardFieldKey;
  label: string;
  required: boolean;
  isNumeric: boolean;
  description: string;
  affectedMetricsWhenMissing: string[];
}

export const STANDARD_FIELDS: FieldDefinition[] = [
  {
    key: 'date',
    label: 'Date',
    required: true,
    isNumeric: false,
    description: 'Reporting date (YYYY-MM-DD, MM/DD/YYYY, or Excel date).',
    affectedMetricsWhenMissing: ['All daily trends', 'Period-over-period comparisons', 'Missing date anomaly checks'],
  },
  {
    key: 'bidRequests',
    label: 'Bid Requests',
    required: true,
    isNumeric: true,
    description: 'Outbound or incoming RTB bid request volume.',
    affectedMetricsWhenMissing: ['Total Bid Requests', 'Bid Response Rate', 'Bid Participation Rate', 'Traffic Surge anomalies'],
  },
  {
    key: 'bidResponses',
    label: 'Bid Responses',
    required: true,
    isNumeric: true,
    description: 'Total bid responses received or returned.',
    affectedMetricsWhenMissing: ['Total Bid Responses', 'Bid Response Rate', 'Average Daily Bid Responses', 'Alternative Win Rate'],
  },
  {
    key: 'submittedBids',
    label: 'Submitted Bids',
    required: true,
    isNumeric: true,
    description: 'Bids actually submitted into the auction.',
    affectedMetricsWhenMissing: ['Submitted Bids', 'Bid Participation Rate', 'Default Win Rate'],
  },
  {
    key: 'auctionWins',
    label: 'Auction Wins',
    required: true,
    isNumeric: true,
    description: 'Auctions won before impression rendering.',
    affectedMetricsWhenMissing: ['Auction Wins', 'Win Rate', 'Render Rate'],
  },
  {
    key: 'impressions',
    label: 'Impressions',
    required: true,
    isNumeric: true,
    description: 'Rendered / served impressions.',
    affectedMetricsWhenMissing: ['Total Impressions', 'CPM / eCPM', 'Render Rate', 'Fill Rate', 'Impression Change'],
  },
  {
    key: 'revenue',
    label: 'Revenue',
    required: true,
    isNumeric: true,
    description: 'Net or publisher revenue in consistent currency.',
    affectedMetricsWhenMissing: ['Total Revenue', 'CPM / eCPM', 'Revenue Change', 'Publisher/SSP Revenue Shares'],
  },
  {
    key: 'eligibleAdRequests',
    label: 'Eligible Ad Requests (Optional)',
    required: false,
    isNumeric: true,
    description: 'Used strictly for Fill Rate. Never inferred from Bid Requests.',
    affectedMetricsWhenMissing: ['Fill Rate (cannot be calculated without Eligible Ad Requests)'],
  },
  {
    key: 'publisher',
    label: 'Publisher (Optional)',
    required: false,
    isNumeric: false,
    description: 'Publisher, site, or app name.',
    affectedMetricsWhenMissing: ['Publisher Analysis breakdown'],
  },
  {
    key: 'ssp',
    label: 'SSP / Exchange (Optional)',
    required: false,
    isNumeric: false,
    description: 'Supply-side platform or exchange partner.',
    affectedMetricsWhenMissing: ['SSP Analysis breakdown'],
  },
  {
    key: 'campaign',
    label: 'Campaign (Optional)',
    required: false,
    isNumeric: false,
    description: 'Campaign or line-item name.',
    affectedMetricsWhenMissing: ['Campaign filtering & breakdown'],
  },
  {
    key: 'adUnit',
    label: 'Ad Unit (Optional)',
    required: false,
    isNumeric: false,
    description: 'Ad slot, placement, or format.',
    affectedMetricsWhenMissing: ['Ad Unit dimension details'],
  },
  {
    key: 'country',
    label: 'Country (Optional)',
    required: false,
    isNumeric: false,
    description: 'Country or geo code.',
    affectedMetricsWhenMissing: ['Country filter'],
  },
  {
    key: 'device',
    label: 'Device (Optional)',
    required: false,
    isNumeric: false,
    description: 'Device type (Desktop, Mobile Web, CTV, In-App).',
    affectedMetricsWhenMissing: ['Device filter'],
  },
];

const FIELD_ALIASES: Record<StandardFieldKey, string[]> = {
  date: ['date', 'day', 'report_date', 'reporting_date', 'dt', 'timestamp'],
  bidRequests: ['bid_requests', 'bid requests', 'requests', 'bid_req', 'total_requests', 'bidrequests'],
  bidResponses: ['bid_responses', 'bid responses', 'responses', 'bid_resp', 'bidresponses'],
  submittedBids: ['submitted_bids', 'submitted bids', 'bids', 'bids_submitted', 'submittedbids', 'bid_count'],
  auctionWins: ['auction_wins', 'auction wins', 'wins', 'won_bids', 'auctions_won', 'auctionwins'],
  impressions: ['impressions', 'served_impressions', 'served impressions', 'imps', 'rendered_impressions', 'impressions_served'],
  revenue: ['revenue', 'publisher_revenue', 'publisher revenue', 'net_revenue', 'gross_revenue', 'earnings', 'spend', 'pub_rev'],
  eligibleAdRequests: ['eligible_ad_requests', 'eligible ad requests', 'ad_requests', 'ad requests', 'eligible_requests'],
  publisher: ['publisher', 'publisher_name', 'publisher name', 'site', 'site_name', 'app_name', 'media_owner'],
  ssp: ['ssp', 'exchange', 'ssp_name', 'supply_partner', 'exchange_name', 'supply_source'],
  campaign: ['campaign', 'campaign_name', 'campaign name', 'line_item', 'order'],
  adUnit: ['ad_unit', 'ad unit', 'adunit', 'placement', 'slot', 'ad_slot'],
  country: ['country', 'geo', 'country_code', 'region'],
  device: ['device', 'device_type', 'platform', 'environment'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s\-]+/g, '_');
}

export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null,
    bidRequests: null,
    bidResponses: null,
    submittedBids: null,
    auctionWins: null,
    impressions: null,
    revenue: null,
    eligibleAdRequests: null,
    publisher: null,
    ssp: null,
    campaign: null,
    adUnit: null,
    country: null,
    device: null,
  };

  const usedHeaders = new Set<string>();

  for (const field of STANDARD_FIELDS) {
    const aliases = FIELD_ALIASES[field.key].map(normalizeHeader);
    // Exact normalized match first
    const exactMatch = headers.find((h) => !usedHeaders.has(h) && aliases.includes(normalizeHeader(h)));
    if (exactMatch) {
      mapping[field.key] = exactMatch;
      usedHeaders.add(exactMatch);
      continue;
    }
    // Partial contains match fallback
    const partialMatch = headers.find((h) => {
      if (usedHeaders.has(h)) return false;
      const norm = normalizeHeader(h);
      return aliases.some((alias) => norm === alias || (alias.length >= 4 && norm.includes(alias)));
    });
    if (partialMatch) {
      mapping[field.key] = partialMatch;
      usedHeaders.add(partialMatch);
    }
  }

  return mapping;
}

export async function parseUploadedFile(file: File): Promise<ParsedWorkbookPreview> {
  const lower = file.name.toLowerCase();
  const isCsv = lower.endsWith('.csv');
  const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');

  if (!isCsv && !isExcel) {
    throw new Error(
      `Unsupported file format "${file.name}". Please upload a .csv, .xlsx, or .xls report.`,
    );
  }

  if (isCsv) {
    const text = await file.text();
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });

    if (result.errors.length > 0 && (!result.data || result.data.length === 0)) {
      throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
    }

    const headers = (result.meta.fields ?? []).filter((h) => h.length > 0);
    if (headers.length === 0 || result.data.length === 0) {
      throw new Error('The uploaded CSV file contains no headers or data rows.');
    }

    const rows = result.data.map((row) => {
      const clean: Record<string, string> = {};
      for (const h of headers) {
        const val = row[h];
        clean[h] = val === undefined || val === null ? '' : String(val).trim();
      }
      return clean;
    });

    return {
      fileName: file.name,
      fileType: 'csv',
      sheetNames: ['CSV Data'],
      selectedSheet: 'CSV Data',
      headers,
      rows,
    };
  }

  // Excel (.xlsx / .xls)
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded Excel workbook contains no worksheets.');
  }

  const firstSheet = workbook.SheetNames[0];
  const { headers, rows } = extractExcelSheet(workbook, firstSheet);

  return {
    fileName: file.name,
    fileType: 'excel',
    sheetNames: workbook.SheetNames,
    selectedSheet: firstSheet,
    headers,
    rows,
    rawWorkbook: workbook,
  };
}

export function extractExcelSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
): { headers: string[]; rows: Record<string, string>[] } {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Worksheet "${sheetName}" not found.`);
  }
  const rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  if (rawObjects.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerSet = new Set<string>();
  for (const row of rawObjects) {
    for (const k of Object.keys(row)) {
      if (k.trim() && !k.startsWith('__EMPTY')) {
        headerSet.add(k.trim());
      }
    }
  }
  const headers = Array.from(headerSet);
  const rows = rawObjects.map((row) => {
    const clean: Record<string, string> = {};
    for (const h of headers) {
      const val = row[h];
      clean[h] = val === undefined || val === null ? '' : String(val).trim();
    }
    return clean;
  });

  return { headers, rows };
}

function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Excel serial number (typically 30000 - 60000 for 1982-2064)
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial > 20000 && serial < 90000) {
      const parsedCode = XLSX.SSF.parse_date_code(serial);
      if (parsedCode && parsedCode.y && parsedCode.m && parsedCode.d) {
        const dt = new Date(Date.UTC(parsedCode.y, parsedCode.m - 1, parsedCode.d));
        if (isValid(dt)) {
          return format(dt, 'yyyy-MM-dd');
        }
      }
    }
  }

  // ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const dt = parseISO(trimmed.slice(0, 10));
    if (isValid(dt)) return format(dt, 'yyyy-MM-dd');
  }

  // Common slash/dash formats
  const formats = ['MM/dd/yyyy', 'M/d/yyyy', 'yyyy/MM/dd', 'dd/MM/yyyy', 'MM-dd-yyyy', 'dd-MM-yyyy'];
  for (const fmt of formats) {
    const dt = parse(trimmed, fmt, new Date());
    if (isValid(dt) && dt.getFullYear() >= 2000 && dt.getFullYear() <= 2100) {
      return format(dt, 'yyyy-MM-dd');
    }
  }

  return null;
}

function parseStrictNumeric(raw: string): { value: number | null; isMissing: boolean; isInvalid: boolean } {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'n/a') {
    return { value: null, isMissing: true, isInvalid: false };
  }
  // Strip currency symbols and thousand separators
  const cleaned = trimmed.replace(/[$€£¥,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { value: null, isMissing: false, isInvalid: true };
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) {
    return { value: null, isMissing: false, isInvalid: true };
  }
  return { value: num, isMissing: false, isInvalid: false };
}

export function getMissingFieldExplanations(mapping: ColumnMapping): {
  missingRequiredFields: StandardFieldKey[];
  uncalculableMetrics: { metric: string; reason: string }[];
} {
  const missingRequiredFields: StandardFieldKey[] = [];
  const uncalculableMetrics: { metric: string; reason: string }[] = [];

  for (const field of STANDARD_FIELDS) {
    if (!mapping[field.key]) {
      if (field.required) {
        missingRequiredFields.push(field.key);
        uncalculableMetrics.push({
          metric: field.affectedMetricsWhenMissing.join(', '),
          reason: `Required field "${field.label}" is not mapped.`,
        });
      } else if (field.key === 'eligibleAdRequests') {
        uncalculableMetrics.push({
          metric: 'Fill Rate',
          reason:
            'Optional field "Eligible Ad Requests" is not mapped. Bid Requests are never used as a substitute.',
        });
      }
    }
  }

  return { missingRequiredFields, uncalculableMetrics };
}

export function validateAndTransformRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  sourceName: string,
): {
  records: RtbRecord[];
  metadata: DatasetMetadata;
} {
  const mappedFields = Object.keys(mapping).reduce(
    (acc, key) => {
      const k = key as StandardFieldKey;
      acc[k] = Boolean(mapping[k]);
      return acc;
    },
    {} as Record<StandardFieldKey, boolean>,
  );

  const { missingRequiredFields, uncalculableMetrics } = getMissingFieldExplanations(mapping);

  const records: RtbRecord[] = [];
  const rejectedRows: RejectedRowInfo[] = [];
  const seenSignatures = new Set<string>();

  let validRows = 0;
  let invalidRows = 0;
  let missingValuesCount = 0;
  let duplicateCount = 0;

  const numericKeys: StandardFieldKey[] = [
    'bidRequests',
    'bidResponses',
    'submittedBids',
    'auctionWins',
    'impressions',
    'revenue',
    'eligibleAdRequests',
  ];

  rows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2; // 1-indexed + header row
    const reasons: string[] = [];

    // Date validation
    let normalizedDate = '';
    if (mapping.date) {
      const rawDate = rawRow[mapping.date] ?? '';
      if (!rawDate) {
        missingValuesCount++;
        reasons.push('Missing date value');
      } else {
        const parsed = parseFlexibleDate(rawDate);
        if (!parsed) {
          reasons.push(`Invalid date format "${rawDate}"`);
        } else {
          normalizedDate = parsed;
        }
      }
    } else {
      reasons.push('Date column is unmapped');
    }

    // Numeric fields validation
    const parsedNums: Record<string, number | null> = {};
    for (const nk of numericKeys) {
      const colName = mapping[nk];
      if (!colName) {
        parsedNums[nk] = null;
        continue;
      }
      const rawVal = rawRow[colName] ?? '';
      const check = parseStrictNumeric(rawVal);
      if (check.isMissing) {
        missingValuesCount++;
        if (STANDARD_FIELDS.find((f) => f.key === nk)?.required) {
          reasons.push(`Missing value for ${nk}`);
        }
        parsedNums[nk] = null;
      } else if (check.isInvalid) {
        reasons.push(`Invalid numeric value "${rawVal}" for ${nk}`);
        parsedNums[nk] = null;
      } else {
        parsedNums[nk] = check.value;
      }
    }

    if (reasons.length > 0) {
      invalidRows++;
      rejectedRows.push({
        rowNumber,
        reasons,
        rawPreview: rawRow,
      });
      return;
    }

    const publisher = mapping.publisher ? rawRow[mapping.publisher] || 'Unspecified' : 'Unspecified';
    const ssp = mapping.ssp ? rawRow[mapping.ssp] || 'Unspecified' : 'Unspecified';
    const campaign = mapping.campaign ? rawRow[mapping.campaign] || 'Unspecified' : 'Unspecified';
    const adUnit = mapping.adUnit ? rawRow[mapping.adUnit] || 'Unspecified' : 'Unspecified';
    const country = mapping.country ? rawRow[mapping.country] || 'Unspecified' : 'Unspecified';
    const device = mapping.device ? rawRow[mapping.device] || 'Unspecified' : 'Unspecified';

    const signature = [
      normalizedDate,
      publisher,
      ssp,
      campaign,
      adUnit,
      country,
      device,
      parsedNums.bidRequests,
      parsedNums.impressions,
      parsedNums.revenue,
    ].join('|');

    if (seenSignatures.has(signature)) {
      duplicateCount++;
      rejectedRows.push({
        rowNumber,
        reasons: ['Duplicate record (matches date, dimensions, and core metrics of an earlier row)'],
        rawPreview: rawRow,
      });
      return;
    }
    seenSignatures.add(signature);

    validRows++;
    records.push({
      date: normalizedDate,
      bidRequests: parsedNums.bidRequests,
      bidResponses: parsedNums.bidResponses,
      submittedBids: parsedNums.submittedBids,
      auctionWins: parsedNums.auctionWins,
      impressions: parsedNums.impressions,
      revenue: parsedNums.revenue,
      eligibleAdRequests: parsedNums.eligibleAdRequests,
      publisher,
      ssp,
      campaign,
      adUnit,
      country,
      device,
    });
  });

  const importSummary: ImportSummary = {
    totalRows: rows.length,
    validRows,
    invalidRows,
    missingValuesCount,
    duplicateCount,
    importedRows: records.length,
    rejectedRows,
  };

  return {
    records,
    metadata: {
      sourceName,
      isDemoData: false,
      uploadedAt: new Date().toISOString(),
      mappedFields,
      missingRequiredFields,
      uncalculableMetrics,
      importSummary,
    },
  };
}
