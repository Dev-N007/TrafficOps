'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AnalyticsData {
  total_events: number;
  avg_resolution_time: number;
  high_risk_zone: string;
  top_junction: string;
  cause_distribution: Record<string, number>;
  planned_vs_unplanned: Record<string, number>;
}

interface PredictionLogItem {
  id: number;
  timestamp: string;
  event_type: string;
  event_cause: string;
  zone: string;
  corridor: string;
  junction: string;
  priority: string;
  requires_road_closure: boolean;
  predicted_impact_score: number;
  predicted_resolution_time: number;
  burden_score: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentPreds, setRecentPreds] = useState<PredictionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch analytics
        const resAnal = await fetch(`${API_URL}/analytics`);
        if (!resAnal.ok) throw new Error('Failed to fetch analytics data');
        const dataAnal = await resAnal.json();
        setAnalytics(dataAnal);

        // Fetch recent predictions
        const resPred = await fetch(`${API_URL}/recent_predictions?limit=5`);
        if (resPred.ok) {
          const dataPred = await resPred.json();
          setRecentPreds(dataPred);
        }
      } catch (err: any) {
        console.error(err);
        setError('FastAPI Server is offline. Please make sure backend is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
        <span className="text-sm text-slate-400 mt-4 font-mono">Loading operations dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 text-center max-w-xl mx-auto my-12 border border-red-500/20">
        <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-semibold text-slate-200 mb-2">Backend Connection Failed</h3>
        <p className="text-slate-400 text-sm mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Format minutes to hours/mins
  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)} mins`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    return `${hrs}h ${remainingMins}m`;
  };

  const getImpactColor = (score: number) => {
    if (score >= 70) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (score >= 40) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  };

  return (
    <div className="space-y-8">
      {/* Overview stats cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="glass-panel p-6 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Incidents</span>
            <p className="text-3xl font-bold text-slate-100">{analytics?.total_events}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
            📊
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel p-6 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Resolution Time</span>
            <p className="text-3xl font-bold text-slate-100">{formatMinutes(analytics?.avg_resolution_time || 0)}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
            ⏱️
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel p-6 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">High Risk Zone</span>
            <p className="text-lg font-bold text-slate-100 truncate max-w-[150px]">{analytics?.high_risk_zone}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
            🔥
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel p-6 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Top Bottleneck</span>
            <p className="text-lg font-bold text-slate-100 truncate max-w-[150px]">{analytics?.top_junction}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
            ⚠️
          </div>
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Predictions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 border border-slate-800/80">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <span>📋</span> Recent Prediction Logs
              </h2>
              <Link 
                href="/prediction"
                className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline transition-colors"
              >
                + New Prediction
              </Link>
            </div>

            {recentPreds.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg">
                <p className="text-sm text-slate-500">No predictions logged yet.</p>
                <Link 
                  href="/prediction"
                  className="inline-block mt-3 text-xs text-blue-500 hover:text-blue-400 font-medium"
                >
                  Create one now &rarr;
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400 font-medium uppercase tracking-wider">
                      <th className="py-3 px-4">Cause</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4 text-center">Impact</th>
                      <th className="py-3 px-4 text-center">Expected Duration</th>
                      <th className="py-3 px-4 text-center">Burden Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-sm">
                    {recentPreds.map((pred) => (
                      <tr key={pred.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-300 capitalize">
                          {pred.event_cause.replace('_', ' ')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          <div className="flex flex-col">
                            <span className="text-slate-300 font-medium">{pred.junction}</span>
                            <span className="text-[11px]">{pred.corridor}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${getImpactColor(pred.predicted_impact_score)}`}>
                            {pred.predicted_impact_score}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-300">
                          {formatMinutes(pred.predicted_resolution_time)}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-blue-400">
                          {pred.burden_score}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Event Causes Breakdown */}
        <div className="space-y-6">
          <div className="glass-panel p-6 border border-slate-800/80">
            <h2 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
              <span>🚨</span> Incident Causes Distribution
            </h2>
            <div className="space-y-4">
              {analytics && Object.entries(analytics.cause_distribution).slice(0, 6).map(([cause, count]) => {
                const total = analytics.total_events || 1;
                const percentage = Math.round((count / total) * 100);
                return (
                  <div key={cause} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="capitalize text-slate-300">{cause.replace('_', ' ')}</span>
                      <span className="text-slate-400">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
