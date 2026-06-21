'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet marker icon issues by pulling standard assets from CDN
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const ClosureIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to center the map when props update
function ChangeMapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Click handler component to capture clicks on the map
function MapClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onClick) {
        onClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

interface MapComponentProps {
  center: [number, number];
  zoom?: number;
  heatmapPoints?: Array<{
    latitude: number;
    longitude: number;
    impact: number;
    cause: string;
    address?: string;
  }>;
  markers?: Array<{
    latitude: number;
    longitude: number;
    title: string;
    description: string;
  }>;
  originalRoute?: Array<[number, number]>;
  diversionRoute?: Array<[number, number]>;
  closurePoint?: [number, number];
  onMapClick?: (lat: number, lng: number) => void;
}

export default function MapComponent({
  center,
  zoom = 13,
  heatmapPoints = [],
  markers = [],
  originalRoute = [],
  diversionRoute = [],
  closurePoint,
  onMapClick,
}: MapComponentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center bg-gray-900 border border-gray-800 rounded-xl">
        <span className="text-gray-400 animate-pulse">Initializing Control Room Map...</span>
      </div>
    );
  }

  // Get color for heatmap marker based on impact score
  const getImpactColor = (impact: number) => {
    if (impact >= 75) return '#ef4444'; // Red
    if (impact >= 40) return '#f59e0b'; // Amber
    return '#10b981'; // Emerald
  };

  return (
    <div className="w-full h-full relative" style={{ minHeight: '500px' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
        scrollWheelZoom={true}
      >
        <ChangeMapCenter center={center} />
        {onMapClick && <MapClickHandler onClick={onMapClick} />}
        
        {/* Dark mode cartodb map tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Heatmap / Historical Hotspots Layer */}
        {heatmapPoints.map((pt, idx) => (
          <Marker
            key={`heatmap-${idx}`}
            position={[pt.latitude, pt.longitude]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: ${getImpactColor(pt.impact)}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px ${getImpactColor(pt.impact)};"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            })}
          >
            <Popup className="dark-popup">
              <div className="text-sm p-1">
                <p className="font-semibold text-gray-800 capitalize">{pt.cause.replace('_', ' ')}</p>
                <p className="text-gray-600">Impact Score: <span className="font-bold">{pt.impact}%</span></p>
                {pt.address && <p className="text-xs text-gray-500 mt-1">{pt.address}</p>}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Custom Point Markers */}
        {markers.map((mk, idx) => (
          <Marker key={`marker-${idx}`} position={[mk.latitude, mk.longitude]}>
            <Popup>
              <div className="text-sm p-1">
                <p className="font-semibold text-gray-800">{mk.title}</p>
                <p className="text-gray-600 text-xs">{mk.description}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Road Closure Active Point */}
        {closurePoint && (
          <Marker position={closurePoint} icon={ClosureIcon}>
            <Popup>
              <div className="text-sm p-1 font-semibold text-red-600">
                ⚠️ Simulated Road Closure Active
              </div>
            </Popup>
          </Marker>
        )}

        {/* Original blocked route (Red dashed line) */}
        {originalRoute.length > 0 && (
          <Polyline
            positions={originalRoute}
            pathOptions={{ color: '#ef4444', weight: 4, dashArray: '5, 10' }}
          />
        )}

        {/* Alternative Diversion Route (Emerald solid line) */}
        {diversionRoute.length > 0 && (
          <Polyline
            positions={diversionRoute}
            pathOptions={{ color: '#10b981', weight: 5, lineCap: 'round', lineJoin: 'round' }}
          />
        )}
      </MapContainer>
    </div>
  );
}
