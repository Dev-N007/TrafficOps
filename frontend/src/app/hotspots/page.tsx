'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-gray-900 border border-gray-800 rounded-xl">
      <span className="text-gray-400 animate-pulse">Loading Hotspots Map Layer...</span>
    </div>
  ),
});

interface HotspotItem {
  name: string;
  count: number;
  criticality: number;
}

interface HotspotCoordinates {
  latitude: number;
  longitude: number;
  impact: number;
  cause: string;
  address?: string;
}

interface HotspotsData {
  critical_junctions: HotspotItem[];
  critical_corridors: HotspotItem[];
  critical_zones: HotspotItem[];
  heatmap_data: HotspotCoordinates[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function HotspotsPage() {
  const [data, setData] = useState<HotspotsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'junctions' | 'corridors' | 'zones'>('junctions');

  useEffect(() => {
    async function fetchHotspots() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/hotspots`);
        if (!res.ok) throw new Error('Failed to load hotspots analytics');
        const result = await res.json();
        setData(result);
      } catch (err: any) {
        console.error(err);
        setError('FastAPI Server is offline or database is empty.');
      } finally {
        setLoading(false);
      }
    }
    fetchHotspots();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin"></div>
        <span className="text-sm text-slate-400 mt-4 font-mono">Loading critical hotspots data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 text-center max-w-xl mx-auto my-12 border border-red-500/20">
        <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-semibold text-slate-200 mb-2">Failed to Load Hotspots</h3>
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
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>📍</span> Critical Traffic Hotspots
          </h2>
          <p className="text-sm text-slate-400">
            Real-time mapping of historical and generated traffic incident severity hotspots across Bengaluru.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map Panel (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel overflow-hidden border border-slate-800/80 h-[550px] relative">
            <div className="absolute top-4 right-4 z-10 bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-[10px] space-y-1.5 font-medium shadow-xl">
              <span className="uppercase text-slate-400 font-bold tracking-wider block mb-1">Impact Legend</span>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 block"></span>
                <span>Severe Impact (&gt;75%)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span>
                <span>Moderate Impact (40%-75%)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                <span>Low Impact (&lt;40%)</span>
              </div>
            </div>
            {data && (
              <MapComponent
                center={[12.9716, 77.5946]} // Center of Bengaluru
                zoom={12}
                heatmapPoints={data.heatmap_data}
              />
            )}
          </div>
        </div>

        {/* Listings Panel (1 col) */}
        <div className="lg:col-span-1">
          <div className="glass-panel p-6 border border-slate-800/80 h-full flex flex-col">
            {/* Tabs selector */}
            <div className="grid grid-cols-3 border-b border-slate-800 mb-6 text-sm">
              {(['junctions', 'corridors', 'zones'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 text-center border-b-2 font-medium capitalize transition-all ${
                    activeTab === tab 
                      ? 'border-blue-500 text-blue-400 font-semibold' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {activeTab === 'junctions' && data?.critical_junctions.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-slate-800/20 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                  <div className="space-y-1">
                    <span className="text-slate-500 text-xs font-mono">#{idx + 1}</span>
                    <p className="text-slate-200 font-medium text-sm">{item.name}</p>
                    <span className="text-[10px] text-slate-400">{item.count} events recorded</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
                      {item.criticality}% Crit
                    </span>
                  </div>
                </div>
              ))}

              {activeTab === 'corridors' && data?.critical_corridors.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-slate-800/20 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                  <div className="space-y-1">
                    <span className="text-slate-500 text-xs font-mono">#{idx + 1}</span>
                    <p className="text-slate-200 font-medium text-sm">{item.name}</p>
                    <span className="text-[10px] text-slate-400">{item.count} events recorded</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
                      {item.criticality}% Crit
                    </span>
                  </div>
                </div>
              ))}

              {activeTab === 'zones' && data?.critical_zones.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-slate-800/20 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                  <div className="space-y-1">
                    <span className="text-slate-500 text-xs font-mono">#{idx + 1}</span>
                    <p className="text-slate-200 font-medium text-sm">{item.name}</p>
                    <span className="text-[10px] text-slate-400">{item.count} events recorded</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-full">
                      {item.criticality}% Crit
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
