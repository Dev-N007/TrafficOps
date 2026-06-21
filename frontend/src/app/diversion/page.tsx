'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-gray-900 border border-gray-800 rounded-xl">
      <span className="text-gray-400 animate-pulse">Loading Live Map...</span>
    </div>
  ),
});

interface RouteDetails {
  original_length_m: number;
  diversion_length_m: number;
  detour_length_m: number;
  detour_time_minutes: number;
  original_route: Array<[number, number]>;
  diversion_route: Array<[number, number]>;
  closure_point: [number, number];
  engine: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function DiversionPage() {
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMapClick = async (lat: number, lng: number) => {
    setSelectedCoords([lat, lng]);
    setLoading(true);
    setError(null);
    setRouteInfo(null);

    try {
      const res = await fetch(`${API_URL}/diversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      });

      if (!res.ok) {
        throw new Error('Failed to compute alternative routes.');
      }

      const result: RouteDetails = await res.json();
      setRouteInfo(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Routing server offline. Fallback failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <span>🛣️</span> Diversion Routing Planner
        </h2>
        <p className="text-sm text-slate-400">
          Simulate a road closure anywhere in Bengaluru by clicking on the map. The system will dynamically calculate the detour.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map Panel (2 cols) */}
        <div className="lg:col-span-2">
          <div className="glass-panel overflow-hidden border border-slate-800/80 h-[550px] relative">
            <div className="absolute top-4 right-4 z-10 bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-[10px] space-y-1 font-medium shadow-xl max-w-xs">
              <span className="uppercase text-slate-400 font-bold tracking-wider block mb-1">Routing Map Legend</span>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-red-500 block"></span>
                <span>Closed Road Segment</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-4 h-0.5 border-t-2 border-emerald-500 block"></span>
                <span>Calculated Diversion Path</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 block"></span>
                <span>Closure Point</span>
              </div>
            </div>
            
            <MapComponent
              center={selectedCoords || [12.9716, 77.5946]}
              zoom={14}
              closurePoint={selectedCoords || undefined}
              originalRoute={routeInfo?.original_route || undefined}
              diversionRoute={routeInfo?.diversion_route || undefined}
              onMapClick={handleMapClick}
            />
          </div>
        </div>

        {/* Details Panel (1 col) */}
        <div className="lg:col-span-1">
          <div className="glass-panel p-6 border border-slate-800/80 h-full flex flex-col justify-between">
            <div className="space-y-6">
              <h3 className="text-md font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
                <span>📋</span> Routing Details
              </h3>

              {!selectedCoords && (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg">
                  <span className="text-3xl block mb-2">🖱️</span>
                  <p className="text-sm text-slate-400 font-medium">No Coordinates Selected</p>
                  <p className="text-xs text-slate-500 mt-1 px-4">
                    Click anywhere on the map to simulate an incident closure and trigger diversion calculations.
                  </p>
                </div>
              )}

              {selectedCoords && (
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Target Coordinates</span>
                    <span className="font-mono text-slate-200">
                      {selectedCoords[0].toFixed(5)}, {selectedCoords[1].toFixed(5)}
                    </span>
                  </div>

                  {loading && (
                    <div className="flex items-center justify-center gap-2 py-6 text-blue-400 font-mono text-xs">
                      <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                      Calculating alternative paths...
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                      {error}
                    </div>
                  )}

                  {routeInfo && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Original Distance */}
                        <div className="bg-[#111827]/40 border border-[#1e293b] rounded-lg p-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Original Road</span>
                          <p className="text-lg font-bold text-slate-200 mt-0.5">
                            {routeInfo.original_length_m.toFixed(0)}m
                          </p>
                        </div>
                        {/* Diversion Distance */}
                        <div className="bg-[#111827]/40 border border-[#1e293b] rounded-lg p-3">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Alternative Path</span>
                          <p className="text-lg font-bold text-slate-200 mt-0.5">
                            {routeInfo.diversion_length_m.toFixed(0)}m
                          </p>
                        </div>
                      </div>

                      {/* Travel Delay Stats */}
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-emerald-400 font-medium">Estimated Delay</span>
                          <span className="text-lg font-extrabold text-emerald-400">
                            +{routeInfo.detour_time_minutes} min
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400">
                          <span>Detour Distance</span>
                          <span>+{routeInfo.detour_length_m.toFixed(0)} meters</span>
                        </div>
                      </div>

                      {/* Routing Engine information */}
                      <div className="bg-[#0c1322] border border-[#1e293b]/50 rounded-lg p-3 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Routing Engine</span>
                        <p className="text-xs text-slate-300 leading-tight">
                          {routeInfo.engine}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-500 border-t border-slate-800 pt-4 mt-6">
              * Delay estimation assumes typical city operational speed of 25 km/h.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
