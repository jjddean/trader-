/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */
"use client";

import React, { useState, useMemo } from 'react';
import Map, { NavigationControl, Layer, Source, MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

interface RiskMapProps {
    lanes: any[];
    scores: any[];
}

export const RiskMap: React.FC<RiskMapProps> = ({ lanes, scores }) => {
    const [viewState, setViewState] = useState({
        longitude: 30,
        latitude: 45,
        zoom: 3
    });

    const [hoverInfo, setHoverInfo] = useState<{
        longitude: number;
        latitude: number;
        route: string;
        score: number;
        x: number;
        y: number;
    } | null>(null);

    // Transform lanes into GeoJSON for Mapbox layers
    const mapData = useMemo(() => {
        const corridors: any[] = [];
        const ports: any[] = [];
        const vessels: any[] = [];

        lanes.forEach(lane => {
            const scoreData = scores.find(s => s.entityType === 'lane' && s.entityId === lane.id);
            const score = scoreData?.score || 0;
            const level = score >= 90 ? 'SEVERE' : score >= 80 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';

            const origin = [lane.origin_port?.longitude || 0, lane.origin_port?.latitude || 0];
            const dest = [lane.destination_port?.longitude || 0, lane.destination_port?.latitude || 0];

            // 1. Corridor
            corridors.push({
                type: 'Feature',
                properties: { id: lane.id, route: `${lane.origin_port?.name} → ${lane.destination_port?.name}`, score, level },
                geometry: { type: 'LineString', coordinates: [origin, dest] }
            });

            // 2. Port Markers
            [lane.origin_port, lane.destination_port].forEach(p => {
                if (p && !ports.find((existing: any) => existing.properties.id === p.id)) {
                    ports.push({
                        type: 'Feature',
                        properties: { id: p.id, name: p.name, type: 'port' },
                        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }
                    });
                }
            });

            // 3. Mock Vessel (midpoint)
            const midLng = (origin[0] + dest[0]) / 2;
            const midLat = (origin[1] + dest[1]) / 2;
            vessels.push({
                type: 'Feature',
                properties: { id: `v-${lane.id}`, name: `Vessel-${lane.id.toString().padStart(3, '0')}`, level, score },
                geometry: { type: 'Point', coordinates: [midLng, midLat] }
            });
        });

        return {
            corridors: { type: 'FeatureCollection', features: corridors },
            ports: { type: 'FeatureCollection', features: ports },
            vessels: { type: 'FeatureCollection', features: vessels }
        };
    }, [lanes, scores]);

    const onHover = (event: MapMouseEvent) => {
        const {
            features,
            point: { x, y }
        } = event;
        const hoveredFeature = features && features[0];

        if (hoveredFeature) {
            const properties = (hoveredFeature as unknown as {
                properties?: Record<string, string | number>;
            }).properties;
            setHoverInfo({
                longitude: event.lngLat.lng,
                latitude: event.lngLat.lat,
                route: String(properties?.route || properties?.name || 'Asset Detected'),
                score: Number(properties?.score || 0),
                x,
                y
            });
        } else {
            setHoverInfo(null);
        }
    };

    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
            <Map
                {...viewState}
                onMove={(evt: any) => setViewState(evt.viewState)}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/light-v11"
                mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                interactiveLayerIds={['risk-corridors', 'vessel-markers']}
                onMouseMove={onHover}
            >
                <NavigationControl position="top-right" />

                {/* Corridor Source */}
                <Source id="corridor-data" type="geojson" data={mapData.corridors as any}>
                    <Layer
                        id="risk-corridors"
                        type="line"
                        paint={{
                            'line-width': 3,
                            'line-color': [
                                'match', ['get', 'level'],
                                'SEVERE', '#9333ea', 'HIGH', '#dc2626', 'MEDIUM', '#eab308', 'LOW', '#16a34a', '#94a3b8'
                            ],
                            'line-opacity': 0.6
                        }}
                    />
                </Source>

                {/* Port Source */}
                <Source id="port-data" type="geojson" data={mapData.ports as any}>
                    <Layer
                        id="port-markers"
                        type="circle"
                        paint={{
                            'circle-radius': 4,
                            'circle-color': '#000000',
                            'circle-stroke-width': 1,
                            'circle-stroke-color': '#ffffff'
                        }}
                    />
                </Source>

                {/* Vessel Source */}
                <Source id="vessel-data" type="geojson" data={mapData.vessels as any}>
                    <Layer
                        id="vessel-markers"
                        type="circle"
                        paint={{
                            'circle-radius': 6,
                            'circle-color': [
                                'match', ['get', 'level'],
                                'SEVERE', '#9333ea', 'HIGH', '#dc2626', 'MEDIUM', '#eab308', 'LOW', '#16a34a', '#94a3b8'
                            ],
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#ffffff'
                        }}
                    />
                </Source>

                {hoverInfo && (
                    <div
                        className="absolute z-10 p-2 bg-white/90 backdrop-blur-sm rounded border border-gray-200 shadow-lg pointer-events-none"
                        style={{ left: hoverInfo.x + 10, top: hoverInfo.y + 10 }}
                    >
                        <p className="text-[10px] font-bold text-black uppercase tracking-wider mb-1">{hoverInfo.route}</p>
                        <p className="text-[9px] text-gray-500">Risk Intelligence Score: <span className="font-bold text-gray-900">{hoverInfo.score}/100</span></p>
                    </div>
                )}
            </Map>

            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm space-y-2">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Risk Legend</p>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full border border-white shadow-sm bg-purple-600" />
                    <span className="text-[10px] text-gray-600">Severe Conflict Risk</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full border border-white shadow-sm bg-red-600" />
                    <span className="text-[10px] text-gray-600">High Operations Risk</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full border border-white shadow-sm bg-green-600" />
                    <span className="text-[10px] text-gray-600">Low Friction (Cleared)</span>
                </div>
                <div className="pt-1 border-t border-gray-200 mt-1">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 bg-black rounded-full border border-white shadow-sm" />
                        <span className="text-[10px] text-gray-500 italic">Strategic Port Entity</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
