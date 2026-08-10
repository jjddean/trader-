/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */
'use client';

import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceArea } from 'recharts';
import { Cloud, Scale, AlertTriangle, Info } from 'lucide-react';

interface RouteRiskChartProps {
    route: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
}

const GENERATED_DATA = [
    { segment: 'Origin', score: 12, label: 'Port Load' },
    { segment: 'Dep.', score: 15, label: 'Departure' },
    { segment: 'Transit 1', score: 18, label: 'Open Sea' },
    { segment: 'Choke 1', score: 45, label: 'Strait Entry', event: 'geo', eventDesc: 'Geopolitical Tension', action: 'Monitor naval updates' },
    { segment: 'Transit 2', score: 42, label: 'Gulf Transit' },
    { segment: 'Choke 2', score: 85, label: 'Key Canal', event: 'sanctions', eventDesc: 'Sanctioned Zone Proximity', action: 'Review alterative routing' },
    { segment: 'Transit 3', score: 65, label: 'Coastal', event: 'weather', eventDesc: 'Severe Storm Warning', action: 'Prepare delay contingency' },
    { segment: 'Arr.', score: 35, label: 'Arrival Zone' },
    { segment: 'Dest.', score: 25, label: 'Port Discharge' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const dataPoint = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl max-w-[220px]">
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wide mb-1">{dataPoint.label}</p>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-white font-bold text-[18px]">{dataPoint.score}</span>
                    <span className="text-slate-500 text-[12px]">/ 100 Risk Score</span>
                </div>

                {dataPoint.event && (
                    <div className="mb-2 text-[10px] text-white bg-slate-800 p-1.5 rounded border border-slate-700 flex items-start gap-1.5">
                        {dataPoint.event === 'geo' && <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />}
                        {dataPoint.event === 'sanctions' && <Scale className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" />}
                        {dataPoint.event === 'weather' && <Cloud className="h-3 w-3 text-cyan-400 mt-0.5 shrink-0" />}
                        <div>
                            <span className="font-semibold block">{dataPoint.eventDesc}</span>
                        </div>
                    </div>
                )}

                {dataPoint.action && dataPoint.score > 40 && (
                    <div className="text-[10px] text-blue-200 border-t border-slate-700 pt-2 mt-1">
                        <span className="font-bold text-blue-400 uppercase text-[9px]">Suggested Action:</span>
                        <p className="leading-tight mt-0.5">{dataPoint.action}</p>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export const RouteRiskChart: React.FC<RouteRiskChartProps> = ({ route, riskLevel }) => {
    const [activeFilter, setActiveFilter] = useState<'composite' | 'sanctions' | 'weather' | 'geo'>('composite');

    // Manipulate data based on filter
    const data = GENERATED_DATA.map(d => {
        let displayScore = d.score;
        if (activeFilter === 'sanctions') displayScore = d.event === 'sanctions' ? d.score : Math.max(5, d.score * 0.2);
        if (activeFilter === 'weather') displayScore = d.event === 'weather' ? d.score : Math.max(5, d.score * 0.1);
        if (activeFilter === 'geo') displayScore = d.event === 'geo' ? d.score : Math.max(5, d.score * 0.3);

        return { ...d, displayScore };
    });

    return (
        <div className="bg-white p-2 font-sans">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[12px] font-bold text-slate-800 uppercase tracking-wider">
                            Route-Level Risk Exposure
                        </h3>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            Beta · Enterprise Preview
                        </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 group relative cursor-help w-fit">
                        <Info className="h-3 w-3" />
                        <span>Risk Score (0–100): Composite of geopolitical, sanctions, & weather factors</span>
                    </div>
                </div>

                {/* Enterprise Toggle - Visual Only */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                    {['composite', 'sanctions', 'weather', 'geo'].map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter as any)}
                            className={`
                                px-2 py-1 text-[10px] font-medium rounded-md transition-all
                                ${activeFilter === filter
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                            `}
                        >
                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-50/50 rounded border border-slate-100 p-3 mb-2">
                <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Operational Risk Thresholds</p>
                <div className="h-[200px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>

                            {/* Threshold Bands */}
                            <ReferenceArea y1={60} y2={100} fill="#fecaca" fillOpacity={0.15} stroke="none" />
                            <ReferenceArea y1={30} y2={60} fill="#fef08a" fillOpacity={0.15} stroke="none" />
                            <ReferenceArea y1={0} y2={30} fill="#dcfce7" fillOpacity={0.15} stroke="none" />

                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                            <XAxis
                                dataKey="segment"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fill: '#64748b' }}
                                interval="preserveStartEnd"
                                dy={10}
                            />
                            <YAxis
                                hide={false}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 9, fill: '#94a3b8' }}
                                domain={[0, 100]}
                                ticks={[0, 30, 60, 90]}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />

                            <Area
                                type="monotone"
                                dataKey="displayScore"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fill="url(#colorScore)"
                                activeDot={{ r: 4, strokeWidth: 0 }}
                            />

                            {/* Event Markers Overlay if in Composite/Relevant Mode */}
                            {(activeFilter === 'composite' || activeFilter === 'geo') && (
                                <ReferenceDot x="Choke 1" y={45} r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                            )}
                            {(activeFilter === 'composite' || activeFilter === 'sanctions') && (
                                <ReferenceDot x="Choke 2" y={85} r={4} fill="#a855f7" stroke="#fff" strokeWidth={2} />
                            )}
                            {(activeFilter === 'composite' || activeFilter === 'weather') && (
                                <ReferenceDot x="Transit 3" y={65} r={4} fill="#06b6d4" stroke="#fff" strokeWidth={2} />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>

                    {/* Threshold Labels Overlay */}
                    <div className="absolute right-0 top-0 h-full w-8 pointer-events-none flex flex-col text-[8px] text-slate-400 justify-between py-6">
                        <span className="text-red-400/70 font-bold">CRIT</span>
                        <span className="text-yellow-500/70 font-bold">REV</span>
                        <span className="text-green-500/70 font-bold">MON</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 italic">
                    Risk evaluated continuously.
                </p>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-200 border border-red-400" />
                        <span className="text-[9px] text-slate-600 font-medium">Critical (60+)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-100 border border-yellow-400" />
                        <span className="text-[9px] text-slate-600 font-medium">Elevated (30-60)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
