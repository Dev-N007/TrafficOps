'use client';

import { useState } from 'react';

interface PredictionResult {
  predicted_impact_score: number;
  predicted_resolution_time: number;
  criticality_score: number;
  explanation: string;
  global_importance: Record<string, number>;
}

interface ResourceResult {
  burden_score: number;
  officers: number;
  barricades: number;
  patrol_vehicles: number;
  explanation: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Hardcoded lists from dataset to populate dropdowns easily
const EVENT_TYPES = ['unplanned', 'planned'];
const EVENT_CAUSES = [
  'vehicle_breakdown', 'accident', 'water_logging', 'pot_holes', 
  'construction', 'tree_fall', 'road_conditions', 'congestion', 
  'public_event', 'procession', 'vip_movement', 'protest', 'others'
];
const ZONES = [
  'Central Zone 1', 'Central Zone 2', 'West Zone 1', 'West Zone 2',
  'North Zone 1', 'North Zone 2', 'South Zone 1', 'South Zone 2',
  'East Zone 1', 'Unknown Zone'
];
const CORRIDORS = [
  'Mysore Road', 'Bellary Road 1', 'Bellary Road 2', 'Tumkur Road',
  'Hosur Road', 'ORR North 1', 'Old Madras Road', 'Magadi Road',
  'ORR East 1', 'Non-corridor', 'Unknown Corridor'
];
const JUNCTIONS = [
  'MekhriCircle', 'AyyappaTempleJunc', 'SatteliteBusStandJunc', 
  'YeshwanthpuraCircle', 'YelhankaCircle', 'SilkBoardJunc',
  'Nagavara-ORR Junction', 'JalahalliCross(SM Circle)', 'HebbalFlyoverJunc',
  'QueensStatueCircle', 'UrvashiJunction', 'Unknown Junction'
];

export default function PredictionPage() {
  // Form state
  const [eventType, setEventType] = useState('unplanned');
  const [eventCause, setEventCause] = useState('vehicle_breakdown');
  const [zone, setZone] = useState('Central Zone 2');
  const [corridor, setCorridor] = useState('Mysore Road');
  const [junction, setJunction] = useState('Unknown Junction');
  const [priority, setPriority] = useState('High');
  const [roadClosure, setRoadClosure] = useState(false);
  const [startTime, setStartTime] = useState(new Date().toISOString().slice(0, 19).replace('T', ' '));

  // Loading & results
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [recommendation, setRecommendation] = useState<ResourceResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPrediction(null);
    setRecommendation(null);

    try {
      // 1. Fetch prediction
      const predictRes = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          event_cause: eventCause,
          zone,
          corridor,
          junction,
          priority,
          requires_road_closure: roadClosure,
          start_time: startTime,
        }),
      });

      if (!predictRes.ok) {
        const errData = await predictRes.json();
        throw new Error(errData.detail || 'Failed to generate predictions');
      }

      const predictData: PredictionResult = await predictRes.json();
      setPrediction(predictData);

      // 2. Fetch resource recommendations
      const recommendRes = await fetch(`${API_URL}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predicted_impact_score: predictData.predicted_impact_score,
          predicted_resolution_time: predictData.predicted_resolution_time,
          criticality_score: predictData.criticality_score,
          requires_road_closure: roadClosure,
          event_type: eventType,
          event_cause: eventCause,
          zone,
          corridor,
          junction,
          priority,
        }),
      });

      if (!recommendRes.ok) {
        const errData = await recommendRes.json();
        throw new Error(errData.detail || 'Failed to generate resource recommendations');
      }

      const recommendData: ResourceResult = await recommendRes.json();
      setRecommendation(recommendData);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Server connection failed. Is FastAPI online?');
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (score: number) => {
    if (score >= 70) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (score >= 40) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  };

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${Math.round(mins)} mins`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = Math.round(mins % 60);
    return `${hrs} hours ${remainingMins} mins`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Input panel (Form) */}
      <div className="lg:col-span-1">
        <div className="glass-panel p-6 border border-slate-800/80 sticky top-24">
          <h2 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
            <span>⚙️</span> Event Parameters
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {/* Event Type */}
            <div className="space-y-1">
              <label className="text-slate-400 font-medium text-xs uppercase tracking-wider">Event Type</label>
              <select 
                value={eventType} 
                onChange={(e) => setEventType(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 capitalize"
              >
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Event Cause */}
            <div className="space-y-1">
              <label className="text-slate-400 font-medium text-xs uppercase tracking-wider">Event Cause</label>
              <select 
                value={eventCause} 
                onChange={(e) => setEventCause(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 capitalize"
              >
                {EVENT_CAUSES.map(c => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-slate-400 font-medium text-xs uppercase tracking-wider">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {['Low', 'Medium', 'High'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2 border rounded-lg font-medium text-center transition-all ${
                      priority === p 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400 font-semibold' 
                        : 'bg-[#111827] border-[#1e293b] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Zone */}
            <div className="space-y-1">
              <label className="text-slate-400 font-medium text-xs uppercase tracking-wider">Zone</label>
              <select 
                value={zone} 
                onChange={(e) => setZone(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {ZONES.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            {/* Corridor */}
            <div className="space-y-1">
              <label className="text-slate-400 font-medium text-xs uppercase tracking-wider">Corridor</label>
              <select 
                value={corridor} 
                onChange={(e) => setCorridor(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {CORRIDORS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Junction */}
            <div className="space-y-1">
              <label className="text-slate-400 font-medium text-xs uppercase tracking-wider">Junction</label>
              <select 
                value={junction} 
                onChange={(e) => setJunction(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {JUNCTIONS.map(j => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>

            {/* Requires Road Closure */}
            <div className="flex items-center justify-between py-2">
              <div className="flex flex-col">
                <span className="text-slate-200 font-medium">Requires Road Closure</span>
                <span className="text-[11px] text-slate-500">Will diversion planning be needed?</span>
              </div>
              <input 
                type="checkbox" 
                checked={roadClosure}
                onChange={(e) => setRoadClosure(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-900 border-[#1e293b] rounded focus:ring-blue-500"
              />
            </div>

            {/* Start Time */}
            <div className="space-y-1">
              <label className="text-slate-400 font-medium text-xs uppercase tracking-wider">Start Datetime</label>
              <input 
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="YYYY-MM-DD HH:MM:SS"
                className="w-full bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold tracking-wider transition-colors disabled:opacity-50 mt-6 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Forecasting...
                </>
              ) : (
                'Run Forecast & Allocation'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Results panel */}
      <div className="lg:col-span-2 space-y-8">
        {error && (
          <div className="glass-panel p-6 border border-red-500/20 text-red-400 text-sm flex gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Calculation Error</p>
              <p className="text-xs text-red-500/70 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {!prediction && !recommendation && !loading && !error && (
          <div className="glass-panel p-12 text-center border border-slate-800/80 flex flex-col items-center justify-center min-h-[400px]">
            <span className="text-4xl mb-4">🔮</span>
            <h3 className="text-lg font-semibold text-slate-200">Awaiting Operation Parameters</h3>
            <p className="text-slate-400 text-sm max-w-sm mt-1">
              Select the incident characteristics in the control panel on the left and trigger forecasting.
            </p>
          </div>
        )}

        {loading && (
          <div className="glass-panel p-12 text-center border border-slate-800/80 flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400 mt-4 font-mono">Running CatBoost forecasting regressor and resource matrices...</p>
          </div>
        )}

        {prediction && recommendation && (
          <div className="space-y-8 animate-fade-in">
            {/* Primary Scores Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Traffic Impact Card */}
              <div className="glass-panel p-6 border border-slate-800/80 flex flex-col items-center text-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Traffic Impact</span>
                <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 ${getImpactColor(prediction.predicted_impact_score)}`}>
                  <span className="text-2xl font-bold text-slate-100">{prediction.predicted_impact_score}%</span>
                </div>
                <span className="text-xs text-slate-400 mt-3 capitalize">{eventCause.replace('_', ' ')} incident</span>
              </div>

              {/* Resolution Duration Card */}
              <div className="glass-panel p-6 border border-slate-800/80 flex flex-col items-center text-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Expected Resolution</span>
                <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 border-purple-500/20 text-purple-400">
                  <span className="text-sm font-bold text-slate-100 text-center px-1">
                    {formatMinutes(prediction.predicted_resolution_time)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 mt-3">Target duration</span>
              </div>

              {/* Operational Burden Card */}
              <div className="glass-panel p-6 border border-slate-800/80 flex flex-col items-center text-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Operational Burden</span>
                <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 border-blue-500/20 text-blue-400">
                  <span className="text-2xl font-bold text-slate-100">{recommendation.burden_score}%</span>
                </div>
                <span className="text-xs text-slate-400 mt-3">Overall burden score</span>
              </div>
            </div>

            {/* Recommended Assets Panel */}
            <div className="glass-panel p-6 border border-slate-800/80">
              <h3 className="text-md font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <span>🛡️</span> Recommended Resource Allocation
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                {/* Officers */}
                <div className="bg-[#111827]/40 border border-[#1e293b] rounded-lg p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Officers</span>
                  <p className="text-3xl font-extrabold text-blue-400 mt-1">{recommendation.officers}</p>
                  <span className="text-xs text-slate-500">Personnel</span>
                </div>
                {/* Barricades */}
                <div className="bg-[#111827]/40 border border-[#1e293b] rounded-lg p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Barricades</span>
                  <p className="text-3xl font-extrabold text-amber-500 mt-1">{recommendation.barricades}</p>
                  <span className="text-xs text-slate-500">Units</span>
                </div>
                {/* Vehicles */}
                <div className="bg-[#111827]/40 border border-[#1e293b] rounded-lg p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Patrol Vehicles</span>
                  <p className="text-3xl font-extrabold text-emerald-400 mt-1">{recommendation.patrol_vehicles}</p>
                  <span className="text-xs text-slate-500">Mobile units</span>
                </div>
              </div>
            </div>

            {/* Explainability & Rationale Panel */}
            <div className="glass-panel p-6 border border-slate-800/80 space-y-6">
              <div>
                <h3 className="text-md font-semibold text-slate-200 mb-2 flex items-center gap-2">
                  <span>🧠</span> AI Explainability & Recommendation Rationale
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed bg-[#0c1322] border border-[#1e293b]/50 rounded-lg p-4 font-sans">
                  {prediction.explanation}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-2">
                  Resource Score Rationale
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed bg-[#0c1322] border border-[#1e293b]/50 rounded-lg p-4 font-sans">
                  {recommendation.explanation}
                </p>
              </div>

              {/* Feature Importances list */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
                  Model Feature Importance weights (CatBoost Regressor)
                </h3>
                <div className="space-y-2">
                  {Object.entries(prediction.global_importance)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([feat, imp]) => (
                      <div key={feat} className="flex items-center gap-3 text-xs">
                        <span className="w-32 text-slate-400 font-mono truncate">{feat}</span>
                        <div className="flex-1 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${imp}%` }}
                          ></div>
                        </div>
                        <span className="w-10 text-right text-slate-300 font-bold font-mono">{imp.toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
