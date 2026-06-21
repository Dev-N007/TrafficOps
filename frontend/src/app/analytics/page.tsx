'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

interface AnalyticsData {
  cause_distribution: Record<string, number>;
  planned_vs_unplanned: Record<string, number>;
  resolution_time_trends: Array<{ cause: string; avg_duration_minutes: number; count: number }>;
  monthly_trends: Array<{ month: string; count: number; avg_impact: number }>;
  total_events: number;
  avg_resolution_time: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plotlyLoaded, setPlotlyLoaded] = useState(false);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/analytics`);
        if (!res.ok) throw new Error('Failed to load analytics trends.');
        const result = await res.json();
        setData(result);
      } catch (err: any) {
        console.error(err);
        setError('FastAPI Server is offline or database is empty.');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  // Render Plotly charts when data and library are available
  useEffect(() => {
    if (plotlyLoaded && data) {
      renderCharts(data);
    }
  }, [plotlyLoaded, data]);

  const renderCharts = (analytics: AnalyticsData) => {
    const Plotly = (window as any).Plotly;
    if (!Plotly) return;

    const commonLayout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#94a3b8', family: 'ui-sans-serif, system-ui' },
      margin: { t: 30, b: 60, l: 60, r: 20 },
      xaxis: { gridcolor: '#1e293b', zeroline: false },
      yaxis: { gridcolor: '#1e293b', zeroline: false },
    };

    // Chart 1: Event Cause Distribution (Horizontal Bar)
    const sortedCauses = Object.entries(analytics.cause_distribution)
      .sort((a, b) => a[1] - b[1]); // Ascending order for horizontal bar
    const causeNames = sortedCauses.map(c => c[0].replace('_', ' '));
    const causeCounts = sortedCauses.map(c => c[1]);

    Plotly.newPlot('cause-chart', [{
      y: causeNames,
      x: causeCounts,
      type: 'bar',
      orientation: 'h',
      marker: { color: '#3b82f6', opacity: 0.8 }
    }], {
      ...commonLayout,
      margin: { t: 20, b: 40, l: 140, r: 20 },
      height: 380
    }, { displayModeBar: false });

    // Chart 2: Planned vs Unplanned Events (Pie)
    const typeNames = Object.keys(analytics.planned_vs_unplanned);
    const typeValues = Object.values(analytics.planned_vs_unplanned);

    Plotly.newPlot('type-chart', [{
      labels: typeNames.map(t => t.charAt(0).toUpperCase() + t.slice(1)),
      values: typeValues,
      type: 'pie',
      hole: 0.4,
      marker: { colors: ['#f59e0b', '#3b82f6'] }
    }], {
      ...commonLayout,
      margin: { t: 20, b: 40, l: 20, r: 20 },
      height: 380,
      showlegend: true,
      legend: { font: { color: '#cbd5e1' } }
    }, { displayModeBar: false });

    // Chart 3: Monthly Trends & Avg Traffic Impact (Bar + Line combo)
    const months = analytics.monthly_trends.map(t => t.month);
    const counts = analytics.monthly_trends.map(t => t.count);
    const impacts = analytics.monthly_trends.map(t => t.avg_impact);

    Plotly.newPlot('trend-chart', [
      {
        x: months,
        y: counts,
        type: 'bar',
        name: 'Incidents Count',
        marker: { color: '#3b82f6', opacity: 0.6 }
      },
      {
        x: months,
        y: impacts,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Avg Impact Score (%)',
        yaxis: 'y2',
        line: { color: '#ef4444', width: 3 }
      }
    ], {
      ...commonLayout,
      yaxis: { ...commonLayout.yaxis, title: 'Incidents Count' },
      yaxis2: {
        title: 'Avg Impact Score (%)',
        overlaying: 'y',
        side: 'right',
        gridcolor: 'rgba(0,0,0,0)',
        zeroline: false
      },
      legend: { font: { color: '#cbd5e1' }, orientation: 'h', y: -0.2 },
      height: 380
    }, { displayModeBar: false });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
        <span className="text-sm text-slate-400 mt-4 font-mono">Loading operations analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 text-center max-w-xl mx-auto my-12 border border-red-500/20">
        <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-semibold text-slate-200 mb-2">Failed to Load Analytics</h3>
        <p className="text-slate-400 text-sm mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Plotly Script Injection */}
      <Script 
        src="https://cdn.plot.ly/plotly-2.24.1.min.js" 
        onLoad={() => setPlotlyLoaded(true)}
      />

      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <span>📈</span> Operations Analytics
        </h2>
        <p className="text-sm text-slate-400">
          Historical trends, incident profiles, and average impact distribution analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Event Cause Distribution */}
        <div className="glass-panel p-6 border border-slate-800/80">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Incident Cause Distribution
          </h3>
          <div id="cause-chart" className="w-full"></div>
        </div>

        {/* Chart 2: Planned vs Unplanned */}
        <div className="glass-panel p-6 border border-slate-800/80">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Planned vs. Unplanned Incidents Profile
          </h3>
          <div id="type-chart" className="w-full"></div>
        </div>

        {/* Chart 3: Monthly Trends */}
        <div className="glass-panel p-6 border border-slate-800/80 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Monthly Incident Count & Average Impact Score Trend
          </h3>
          <div id="trend-chart" className="w-full"></div>
        </div>
      </div>
    </div>
  );
}
