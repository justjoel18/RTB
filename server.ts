import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Initialize server-side Gemini client using environment secret only.
// Never log campaign metrics or confidential payloads.
function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      // Do not retry client configuration or auth errors
      if (status === 400 || status === 401 || status === 403 || status === 404) {
        throw err;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 600 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description: 'Concise executive summary of campaign performance grounded strictly in the provided aggregated metrics.',
    },
    performanceAnalysis: {
      type: Type.OBJECT,
      properties: {
        bidResponse: { type: Type.STRING, description: 'Analysis of bid response volume and bid response rate.' },
        winRate: { type: Type.STRING, description: 'Analysis of auction win rate using the stated definition.' },
        impressionDelivery: { type: Type.STRING, description: 'Analysis of impression delivery, render rate, and fill rate if available.' },
        revenueTrends: { type: Type.STRING, description: 'Analysis of revenue totals and period-over-period revenue changes.' },
        cpmChanges: { type: Type.STRING, description: 'Analysis of CPM/eCPM levels and period shifts.' },
        publisherPerformance: { type: Type.STRING, description: 'Summary of publisher-level performance patterns and concentration.' },
        sspPerformance: { type: Type.STRING, description: 'Balanced SSP comparison accounting for volume, render rate, and auction dynamics.' },
      },
      required: [
        'bidResponse',
        'winRate',
        'impressionDelivery',
        'revenueTrends',
        'cpmChanges',
        'publisherPerformance',
        'sspPerformance',
      ],
    },
    anomalyExplanations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          anomalyRef: { type: Type.STRING, description: 'Affected date, entity, and anomaly type.' },
          whatChanged: { type: Type.STRING, description: 'Observed quantitative change from the rule-based trigger.' },
          possibleCauses: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Plausible programmatic/AdOps causes framed as hypotheses rather than confirmed facts.',
          },
          investigationSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Concrete steps an Ad Operations professional should check in DSP/SSP logs.',
          },
          additionalDataNeeded: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Additional logs or dimensions required to confirm root cause.',
          },
        },
        required: ['anomalyRef', 'whatChanged', 'possibleCauses', 'investigationSteps', 'additionalDataNeeded'],
      },
    },
    optimizationRecommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: 'One of: Campaign Delivery, Bid Response, Win Rate, Publisher Performance, SSP Performance, CPM & Revenue, Reporting Quality',
          },
          priority: {
            type: Type.STRING,
            description: 'High, Medium, or Low',
          },
          title: { type: Type.STRING },
          recommendation: { type: Type.STRING },
          supportingMetrics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          assumptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          missingInformation: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          factsVsHypotheses: { type: Type.STRING },
        },
        required: [
          'category',
          'priority',
          'title',
          'recommendation',
          'supportingMetrics',
          'assumptions',
          'missingInformation',
          'factsVsHypotheses',
        ],
      },
    },
    confidenceAndLimitations: {
      type: Type.OBJECT,
      properties: {
        overallConfidenceNote: { type: Type.STRING },
        dataGaps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        methodologicalNotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['overallConfidenceNote', 'dataGaps', 'methodologicalNotes'],
    },
  },
  required: [
    'executiveSummary',
    'performanceAnalysis',
    'anomalyExplanations',
    'optimizationRecommendations',
    'confidenceAndLimitations',
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/analyze', async (req: Request, res: Response) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable AI Campaign Analysis.',
      });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object' || !body.aggregatedMetrics || !body.reportingPeriod) {
      res.status(400).json({
        error: 'Invalid analysis request payload. Aggregated metrics and reporting period are required.',
      });
      return;
    }

    // Explicitly extract only aggregated summaries—never accept or forward raw row data.
    const sanitizedPayload = {
      dataSourceLabel: typeof body.dataSourceLabel === 'string' ? body.dataSourceLabel : 'Uploaded Report',
      currency: typeof body.currency === 'string' ? body.currency : 'USD',
      reportingPeriod: body.reportingPeriod,
      metricDefinitions: body.metricDefinitions ?? {},
      aggregatedMetrics: body.aggregatedMetrics,
      publisherSummaries: Array.isArray(body.publisherSummaries) ? body.publisherSummaries.slice(0, 25) : [],
      sspSummaries: Array.isArray(body.sspSummaries) ? body.sspSummaries.slice(0, 25) : [],
      detectedAnomalies: Array.isArray(body.detectedAnomalies) ? body.detectedAnomalies.slice(0, 30) : [],
      dataQualityWarnings: Array.isArray(body.dataQualityWarnings) ? body.dataQualityWarnings.slice(0, 20) : [],
    };

    const systemInstruction = `You are a senior Programmatic Advertising and RTB Operations Analyst.
Analyze ONLY the provided aggregated metrics, publisher summaries, SSP summaries, rule-based anomalies, metric definitions, and data quality warnings.

Strict analytical rules:
1. Never invent metrics, percentages, campaign outcomes, or technical errors not present in the input.
2. Never recalculate or contradict the deterministic metrics provided; treat them as authoritative.
3. Never claim a bid adjustment or floor-price change will improve performance without explicit supporting evidence; frame recommendations as testable hypotheses when causal data (like bid floor logs, creative specs, or latency telemetry) is missing.
4. Never label traffic spikes or unusual shifts as confirmed ad fraud; describe them strictly as investigation triggers requiring IVT/log verification.
5. Never declare one SSP objectively best from a single metric; consider inventory quality, traffic volume, render rate, auction dynamics, and commercial terms.
6. Clearly distinguish observed facts from hypotheses in every recommendation and anomaly explanation.
7. If a metric is null or N/A (such as Fill Rate when Eligible Ad Requests is unmapped, or Period Change when prior period data is absent), acknowledge the limitation explicitly.`;

    const prompt = `Analyze the following aggregated RTB campaign performance summary and return structured JSON matching the schema.

Payload:
${JSON.stringify(sanitizedPayload, null, 2)}`;

    try {
      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: analysisResponseSchema,
          },
        }),
      );

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty response. Please try again.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        analysis: parsed,
        generatedAt: new Date().toISOString(),
        modelUsed: 'gemini-4-hydrogen',
      });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const message = err instanceof Error ? err.message : 'Unexpected error calling Gemini API';

      if (status === 400 || status === 401 || status === 403) {
        res.status(status).json({
          error:
            'Gemini API authentication failed. Please verify GEMINI_API_KEY in the Settings > Secrets panel.',
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: 'Gemini API rate limit reached. Please wait a moment and try again.',
        });
        return;
      }

      res.status(502).json({
        error: `AI analysis request failed: ${message}`,
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RTB Intelligence server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
