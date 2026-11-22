import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import type {
  ColumnMapping,
  DatasetMetadata,
  RtbRecord,
  StandardFieldKey,
} from '../types/rtb';
import {
  autoDetectColumnMapping,
  extractExcelSheet,
  getMissingFieldExplanations,
  parseUploadedFile,
  STANDARD_FIELDS,
  validateAndTransformRows,
} from '../utils/fileParser';
import type { ParsedWorkbookPreview } from '../utils/fileParser';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (records: RtbRecord[], metadata: DatasetMetadata) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'select' | 'map' | 'validate'>('select');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ParsedWorkbookPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [validationResult, setValidationResult] = useState<{
    records: RtbRecord[];
    metadata: DatasetMetadata;
  } | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  const missingInfo = useMemo(() => {
    if (!mapping) return { missingRequiredFields: [], uncalculableMetrics: [] };
    return getMissingFieldExplanations(mapping);
  }, [mapping]);

  if (!isOpen) return null;

  const resetWizard = () => {
    setStep('select');
    setError(null);
    setPreview(null);
    setMapping(null);
    setValidationResult(null);
    setShowRejected(false);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const handleFile = async (file: File) => {
    setError(null);
    setIsParsing(true);
    try {
      const parsed = await parseUploadedFile(file);
      const detected = autoDetectColumnMapping(parsed.headers);
      setPreview(parsed);
      setMapping(detected);
      setStep('map');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse the selected file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    if (!preview || !preview.rawWorkbook) return;
    try {
      const { headers, rows } = extractExcelSheet(preview.rawWorkbook, sheetName);
      if (headers.length === 0 || rows.length === 0) {
        setError(`Worksheet "${sheetName}" is empty.`);
        return;
      }
      setError(null);
      setPreview({
        ...preview,
        selectedSheet: sheetName,
        headers,
        rows,
      });
      setMapping(autoDetectColumnMapping(headers));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read worksheet.');
    }
  };

  const handleRunValidation = () => {
    if (!preview || !mapping) return;
    const result = validateAndTransformRows(
      preview.rows,
      mapping,
      `${preview.fileName}${preview.fileType === 'excel' ? ` (${preview.selectedSheet})` : ''}`,
    );
    setValidationResult(result);
    setStep('validate');
  };

  const handleConfirm = () => {
    if (!validationResult || validationResult.records.length === 0) return;
    onConfirmImport(validationResult.records, validationResult.metadata);
    resetWizard();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
              Upload RTB Campaign Report
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Step {step === 'select' ? '1 of 3: Select File' : step === 'map' ? '2 of 3: Map Columns & Preview' : '3 of 3: Validate & Confirm Import'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close upload dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Privacy Notice */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
            <ShieldAlert className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Local Browser Processing & Data Authorization:</span>{' '}
              Uploaded reports are parsed directly in your browser and are not persisted to any database.
              Do not upload confidential client data unless you have authorization.
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Select File */}
          {step === 'select' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) void handleFile(dropped);
              }}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-blue-400'
              }`}
            >
              <Upload className="h-10 w-10 mx-auto text-blue-600 dark:text-blue-400 mb-3" />
              <div className="font-display font-semibold text-base text-slate-900 dark:text-white">
                {isParsing ? 'Parsing report file...' : 'Drag and drop your campaign report here'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
                Supports CSV (.csv) and Excel (.xlsx, .xls) exports from DSPs, SSPs, or ad servers. One report at a time.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) void handleFile(chosen);
                }}
              />
              <button
                type="button"
                disabled={isParsing}
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Browse Files
              </button>
            </div>
          )}

          {/* STEP 2: Worksheet selector + Column Mapping + Preview */}
          {step === 'map' && preview && mapping && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-sm font-medium text-slate-900 dark:text-white">
                  <FileSpreadsheet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span>{preview.fileName}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    ({preview.rows.length.toLocaleString()} rows · {preview.headers.length} columns)
                  </span>
                </div>

                {preview.fileType === 'excel' && preview.sheetNames.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <label htmlFor="sheet-select" className="font-medium text-slate-600 dark:text-slate-300">
                      Worksheet:
                    </label>
                    <select
                      id="sheet-select"
                      value={preview.selectedSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                    >
                      {preview.sheetNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Missing field warning */}
              {missingInfo.uncalculableMetrics.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Unmapped Fields Impact Metric Availability</span>
                  </div>
                  <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1 pl-6 list-disc">
                    {missingInfo.uncalculableMetrics.map((item, idx) => (
                      <li key={idx}>
                        <span className="font-medium">{item.metric}:</span> {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Column mapping grid */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Map Source Columns to Standard RTB Fields
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {STANDARD_FIELDS.map((field) => {
                    const selectedCol = mapping[field.key] ?? '';
                    const isMissingRequired = field.required && !selectedCol;
                    return (
                      <div
                        key={field.key}
                        className={`p-3 rounded-lg border ${
                          isMissingRequired
                            ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <label
                            htmlFor={`map-${field.key}`}
                            className="text-xs font-semibold text-slate-800 dark:text-slate-100"
                          >
                            {field.label}
                            {field.required && <span className="text-red-600 ml-1">*</span>}
                          </label>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {field.required ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        <select
                          id={`map-${field.key}`}
                          value={selectedCol}
                          onChange={(e) => {
                            const nextVal = e.target.value || null;
                            setMapping((prev) =>
                              prev ? { ...prev, [field.key as StandardFieldKey]: nextVal } : prev,
                            );
                          }}
                          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="">-- Not Mapped --</option>
                          {preview.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {field.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5-row data preview */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  Source Data Preview (First 5 Rows)
                </h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        {preview.headers.map((h) => (
                          <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {preview.rows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {preview.headers.map((h) => (
                            <td
                              key={h}
                              className="px-3 py-2 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap"
                            >
                              {row[h] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Validation & Import Summary */}
          {step === 'validate' && validationResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Rows', value: validationResult.metadata.importSummary.totalRows },
                  { label: 'Valid Rows', value: validationResult.metadata.importSummary.validRows },
                  { label: 'Invalid Rows', value: validationResult.metadata.importSummary.invalidRows },
                  { label: 'Missing Values', value: validationResult.metadata.importSummary.missingValuesCount },
                  { label: 'Duplicates', value: validationResult.metadata.importSummary.duplicateCount },
                  { label: 'Ready to Import', value: validationResult.metadata.importSummary.importedRows },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"
                  >
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{stat.label}</div>
                    <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                      {stat.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {validationResult.records.length === 0 ? (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  No valid rows could be imported with the current column mapping. Please go back and check Date and required numeric field mappings.
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Validated {validationResult.records.length.toLocaleString()} clean RTB records ready for deterministic analysis.
                  </span>
                </div>
              )}

              {validationResult.metadata.importSummary.rejectedRows.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Rejected Rows ({validationResult.metadata.importSummary.rejectedRows.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowRejected((v) => !v)}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showRejected ? 'Hide Details' : 'Review Rejected Rows'}
                    </button>
                  </div>
                  {showRejected && (
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {validationResult.metadata.importSummary.rejectedRows.slice(0, 100).map((rej) => (
                        <div key={rej.rowNumber} className="p-3 space-y-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            Row {rej.rowNumber}:{' '}
                            <span className="text-red-600 dark:text-red-400 font-normal">
                              {rej.reasons.join('; ')}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {JSON.stringify(rej.rawPreview)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div>
            {step !== 'select' && (
              <button
                type="button"
                onClick={() => setStep(step === 'validate' ? 'map' : 'select')}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            {step === 'map' && (
              <button
                type="button"
                onClick={handleRunValidation}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700"
              >
                Validate Rows
              </button>
            )}
            {step === 'validate' && (
              <button
                type="button"
                disabled={!validationResult || validationResult.records.length === 0}
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50"
              >
                Confirm Import ({validationResult?.records.length.toLocaleString() ?? 0} Rows)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
