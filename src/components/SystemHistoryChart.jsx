import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        // Extract formatted time from payload
        const displayTime = payload[0]?.payload?.displayTime || label;

        return (
            <div style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '0.8rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
            }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>{displayTime}</p>
                {payload.map((entry, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', margin: '2px 0', fontSize: '0.875rem' }}>
                        <div
                            style={{
                                width: '8px',
                                height: '8px',
                                backgroundColor: entry.color,
                                marginRight: '6px',
                                borderRadius: '2px'
                            }}
                        ></div>
                        <span style={{ color: '#e2e8f0', marginRight: '4px' }}>{entry.name}:</span>
                        <span style={{ fontWeight: 'bold' }}>{entry.value}{entry.name === 'Sıcaklık' ? '°C' : '%'}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const formatTimeLabel = (isoString, range) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (range === 'daily') {
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } else if (range === 'weekly') {
            return date.toLocaleDateString('tr-TR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        } else if (range === 'monthly') {
            return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        } else if (range === 'yearly') {
            return date.toLocaleDateString('tr-TR', { month: 'long' });
        }
        return isoString;
    } catch {
        return '';
    }
};

const SystemHistoryChart = () => {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 240 });
    const [range, setRange] = useState('daily');
    const [chartData, setChartData] = useState([]);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/system/history?range=${range}`);
            if (res.ok) {
                const json = await res.json();
                const processed = json.map((d, i) => ({
                    ...d,
                    displayTime: formatTimeLabel(d.time, range),
                    timestamp: new Date(d.time).getTime(),
                    uniqueId: `${i}-${d.time}` // Used internally if needed
                }));
                setChartData(processed);
            }
        } catch (error) {
            console.error('Failed to fetch chart history', error);
        }
    }, [range]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();
        const interval = setInterval(fetchData, 10000); // refresh every 10s
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.contentRect.width > 0) {
                    setDimensions({
                        width: entry.contentRect.width,
                        height: 240
                    });
                }
            }
        });

        const timeoutId = setTimeout(() => {
            if (containerRef.current) {
                resizeObserver.observe(containerRef.current);
                setDimensions({
                    width: containerRef.current.getBoundingClientRect().width,
                    height: 240
                });
            }
        }, 50);

        return () => {
            clearTimeout(timeoutId);
            resizeObserver.disconnect();
        };
    }, []);

    const rangeOptions = [
        { id: 'daily', label: '24 Saat' },
        { id: 'weekly', label: '1 Hafta' },
        { id: 'monthly', label: '1 Ay' },
        { id: 'yearly', label: '1 Yıl' }
    ];

    return (
        <div className="history-chart-container" style={{ width: '100%', height: '340px', display: 'flex', flexDirection: 'column', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1rem 0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>Sistem Geçmişi</h3>

                {/* Range Toggle */}
                <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 1)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {rangeOptions.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setRange(opt.id)}
                            style={{
                                background: range === opt.id ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                                color: range === opt.id ? '#38bdf8' : '#94a3b8',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                fontWeight: range === opt.id ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #38bdf8', background: 'rgba(56, 189, 248, 0.2)' }}></div>
                        <span>CPU</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #a855f7', background: 'rgba(168, 85, 247, 0.2)' }}></div>
                        <span>RAM</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #ef4444', background: 'rgba(239, 68, 68, 0.2)' }}></div>
                        <span>Sıcaklık</span>
                    </div>
                </div>
            </div>

            <div ref={containerRef} style={{ width: '100%', height: '240px', display: 'block', position: 'relative', zIndex: 1, overflowX: 'hidden' }}>
                {(!chartData || chartData.length === 0) ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        Veri Bekleniyor...
                    </div>
                ) : (dimensions.width > 0 && (
                    <AreaChart
                        width={dimensions.width}
                        height={dimensions.height}
                        data={chartData}
                        margin={{
                            top: 10,
                            right: 0,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <defs>
                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(value) => value ? formatTimeLabel(new Date(value).toISOString(), range) : ''}
                            stroke="#475569"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={20}
                            padding={{ left: 0, right: 0 }}
                        />
                        <YAxis
                            stroke="#475569"
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 100]}
                            ticks={[0, 20, 40, 60, 80, 100]}
                            width={35}
                        />
                        <Tooltip content={<CustomTooltip />} animationDuration={200} />
                        <Area
                            type="monotone"
                            dataKey="cpu"
                            name="CPU"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorCpu)"
                            isAnimationActive={false}
                            activeDot={{ r: 4, strokeWidth: 2 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="temp"
                            name="Sıcaklık"
                            stroke="#ef4444"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorTemp)"
                            isAnimationActive={false}
                            activeDot={{ r: 4, strokeWidth: 2 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="ram"
                            name="RAM"
                            stroke="#a855f7"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorRam)"
                            isAnimationActive={false}
                            activeDot={{ r: 4, strokeWidth: 2 }}
                        />
                    </AreaChart>
                ))}
            </div>
        </div>
    );
};

export default SystemHistoryChart;
