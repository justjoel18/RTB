import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AppSettings,
  DailyMetricPoint,
  EntitySummary,
} from '../types/rtb';
import { formatCount, formatCurrency } from '../utils/rtbEngine';

const DONUT_COLORS = ['#1d4ed8', '#0d9488', '#3b82f6', '#14b8a6', '#64748b', '#0f172a'];

function shortDate(iso: string): string {
  return iso.slice(5); // MM-DD
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, children }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 print-break-inside-avoid">
    <div className="mb-4">
      <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    <div className="h-64 w-full">{children}</div>
  </div>
);

interface DailyChartProps {
  daily: DailyMetricPoint[];
  settings: AppSettings;
}

export const DailyImpressionsChart: React.FC<DailyChartProps> = ({ daily, settings }) => (
  <ChartCard title="Daily Impressions Trend" subtitle="Served impressions over reporting dates">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={daily} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis
          tickFormatter={(v) => formatCount(Number(v), settings.numberFormat)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={56}
        />
        <Tooltip
          formatter={(value) => [formatCount(Number(value ?? 0), 'standard'), 'Impressions']}
          labelFormatter={(l) => `Date: ${l}`}
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            color: '#f8fafc',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="impressions"
          name="Impressions"
          stroke="#2563eb"
          strokeWidth={2.2}
          dot={{ r: 2.5, fill: '#2563eb' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </ChartCard>
);

export const DailyRevenueChart: React.FC<DailyChartProps> = ({ daily, settings }) => (
  <ChartCard title="Daily Revenue Trend" subtitle={`Daily revenue (${settings.currency})`}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={daily} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis
          tickFormatter={(v) => formatCurrency(Number(v), settings.currency, 'compact', 0)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={62}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value ?? 0), settings.currency, 'standard'), 'Revenue']}
          labelFormatter={(l) => `Date: ${l}`}
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            color: '#f8fafc',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#0d9488"
          strokeWidth={2.2}
          dot={{ r: 2.5, fill: '#0d9488' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </ChartCard>
);

export const DailyCpmChart: React.FC<DailyChartProps> = ({ daily, settings }) => (
  <ChartCard title="CPM / eCPM Trend" subtitle="(Revenue / Impressions) × 1,000">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={daily} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis
          tickFormatter={(v) => formatCurrency(Number(v), settings.currency, 'standard', 2)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={56}
        />
        <Tooltip
          formatter={(value) => [
            value === null || value === undefined
              ? 'N/A'
              : formatCurrency(Number(value), settings.currency, 'standard', 2),
            'CPM',
          ]}
          labelFormatter={(l) => `Date: ${l}`}
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            color: '#f8fafc',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="cpm"
          name="CPM"
          stroke="#0284c7"
          strokeWidth={2.2}
          connectNulls={false}
          dot={{ r: 2.5, fill: '#0284c7' }}
        />
      </LineChart>
    </ResponsiveContainer>
  </ChartCard>
);

export const BidRequestsVsResponsesChart: React.FC<DailyChartProps> = ({ daily, settings }) => (
  <ChartCard title="Bid Requests vs Bid Responses" subtitle="Daily bid request supply against bid responses">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={daily} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis
          tickFormatter={(v) => formatCount(Number(v), settings.numberFormat)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={56}
        />
        <Tooltip
          formatter={(value, name) => [formatCount(Number(value ?? 0), 'standard'), String(name)]}
          labelFormatter={(l) => `Date: ${l}`}
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            color: '#f8fafc',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="bidRequests" name="Bid Requests" fill="#1e3a8a" radius={[3, 3, 0, 0]} />
        <Bar dataKey="bidResponses" name="Bid Responses" fill="#0d9488" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </ChartCard>
);

export const SubmittedBidsVsWinsChart: React.FC<DailyChartProps> = ({ daily, settings }) => (
  <ChartCard title="Submitted Bids vs Auction Wins" subtitle="Daily bidding funnel conversion">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={daily} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis
          tickFormatter={(v) => formatCount(Number(v), settings.numberFormat)}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={56}
        />
        <Tooltip
          formatter={(value, name) => [formatCount(Number(value ?? 0), 'standard'), String(name)]}
          labelFormatter={(l) => `Date: ${l}`}
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            color: '#f8fafc',
            fontSize: '12px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="submittedBids" name="Submitted Bids" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="auctionWins" name="Auction Wins" fill="#14b8a6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </ChartCard>
);

interface EntityChartProps {
  entities: EntitySummary[];
  settings: AppSettings;
}

export const PublisherRevenueChart: React.FC<EntityChartProps> = ({ entities, settings }) => {
  const top = entities.slice(0, 8);
  return (
    <ChartCard title="Publisher Revenue Comparison" subtitle="Top publishers by total revenue">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 16, left: 12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
          <XAxis
            type="number"
            tickFormatter={(v) => formatCurrency(Number(v), settings.currency, 'compact', 0)}
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value ?? 0), settings.currency, 'standard'), 'Revenue']}
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="totalRevenue" name="Revenue" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export const SspPerformanceChart: React.FC<EntityChartProps> = ({ entities, settings }) => {
  const top = entities.slice(0, 8);
  return (
    <ChartCard title="SSP Performance Comparison" subtitle="Revenue and eCPM across supply partners">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => formatCurrency(Number(v), settings.currency, 'compact', 0)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={58}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => formatCurrency(Number(v), settings.currency, 'standard', 2)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={54}
          />
          <Tooltip
            formatter={(value, name) => [
              formatCurrency(Number(value ?? 0), settings.currency, 'standard', 2),
              String(name),
            ]}
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Bar yAxisId="left" dataKey="totalRevenue" name="Revenue" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="cpm" name="CPM" fill="#0d9488" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export const RevenueDistributionChart: React.FC<EntityChartProps & { dimensionLabel?: string }> = ({
  entities,
  settings,
  dimensionLabel = 'SSP',
}) => {
  const data = entities.slice(0, 6).map((e) => ({
    name: e.name,
    value: Number(e.totalRevenue.toFixed(2)),
    share: e.revenueSharePct ?? 0,
  }));

  return (
    <ChartCard title={`Revenue Distribution by ${dimensionLabel}`} subtitle="Share of total filtered revenue">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={86}
            paddingAngle={2}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value ?? 0), settings.currency, 'standard'), 'Revenue']}
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};
