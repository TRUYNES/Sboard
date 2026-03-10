import React, { useState, useEffect } from 'react';
import { Cpu, Thermometer, MemoryStick, HardDrive, Activity, ArrowDown, ArrowUp, FlaskConical, GripHorizontal } from 'lucide-react';
import { io } from 'socket.io-client';
import SystemHistoryChart from './SystemHistoryChart';
import { SortableItem } from './SortableItem';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arraySwap,
    SortableContext,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

const defaultWidgetOrder = ['cpu', 'ram', 'temp', 'disk'];
const defaultSectionOrder = ['widgets', 'chart', 'containers'];

const SystemMonitor = ({ stats, isEditMode, saveSignal, cancelSignal, onDraftChange }) => {
    const [containers, setContainers] = useState([]);

    // Sortable Widgets State
    const [widgetOrder, setWidgetOrder] = useState(() => {
        const saved = localStorage.getItem('monitor_widget_order');
        return saved ? JSON.parse(saved) : defaultWidgetOrder;
    });

    // Sortable Sections State
    const [sectionOrder, setSectionOrder] = useState(() => {
        const saved = localStorage.getItem('monitor_section_order');
        return saved ? JSON.parse(saved) : defaultSectionOrder;
    });

    const sectionNames = {
        'widgets': 'Sensör Kartları',
        'chart': 'Sistem Geçmişi Grafiği',
        'containers': 'Konteyner Monitörü'
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;

        if (active.id !== over.id) {
            if (sectionOrder.includes(active.id) && sectionOrder.includes(over.id)) {
                setSectionOrder((items) => {
                    const oldIndex = items.indexOf(active.id);
                    const newIndex = items.indexOf(over.id);
                    const newOrder = arraySwap(items, oldIndex, newIndex);
                    // Emit draft change
                    if (onDraftChange) onDraftChange();
                    return newOrder;
                });
            } else if (widgetOrder.includes(active.id) && widgetOrder.includes(over.id)) {
                setWidgetOrder((items) => {
                    const oldIndex = items.indexOf(active.id);
                    const newIndex = items.indexOf(over.id);
                    const newOrder = arraySwap(items, oldIndex, newIndex);
                    // Emit draft change
                    if (onDraftChange) onDraftChange();
                    return newOrder;
                });
            }
        }
    };

    // Save Drafts when saveSignal changes
    useEffect(() => {
        if (saveSignal > 0) {
            localStorage.setItem('monitor_section_order', JSON.stringify(sectionOrder));
            localStorage.setItem('monitor_widget_order', JSON.stringify(widgetOrder));
        }
    }, [saveSignal, sectionOrder, widgetOrder]);

    // Restore Drafts when cancelSignal changes
    useEffect(() => {
        if (cancelSignal > 0) {
            const savedSections = localStorage.getItem('monitor_section_order');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (savedSections) setSectionOrder(JSON.parse(savedSections));
            else setSectionOrder(defaultSectionOrder);

            const savedWidgets = localStorage.getItem('monitor_widget_order');
            if (savedWidgets) setWidgetOrder(JSON.parse(savedWidgets));
            else setWidgetOrder(defaultWidgetOrder);
        }
    }, [cancelSignal]);

    useEffect(() => {
        // Socket.io for Docker Stats
        const socket = io();

        socket.on('connect', () => {
            socket.emit('stats:subscribe');
        });

        socket.on('stats:init', (initialContainers) => {
            setContainers(initialContainers.map(c => ({
                ...c,
                cpu: '0.00',
                ram: '0.0',
                ramUsedMB: '0.00',
                ramTotalGB: '0.0',
                netRxMB: '0.00',
                netTxMB: '0.00'
            })));
        });

        socket.on('stats:update', (update) => {
            setContainers(prev => prev.map(c => {
                if (c.id === update.id) {
                    return { ...c, ...update };
                }
                return c;
            }));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    if (!stats) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                Sistem verileri yükleniyor...
            </div>
        );
    }

    // Helper to format Uptime (seconds to dd hh mm ss)
    const formatUptime = (seconds) => {
        if (!seconds) return 'Bilinmiyor';
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor(seconds % (3600 * 24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = Math.floor(seconds % 60);
        return `${d}g ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getStatusColor = (percent) => {
        if (percent > 85) return '#ef4444'; // Red
        if (percent > 70) return '#f59e0b'; // Orange
        return '#10b981'; // Green
    };

    const renderWidget = (id) => {
        const widgetCursorStyle = isEditMode ? { cursor: 'grab' } : {};
        switch (id) {
            case 'cpu':
                return (
                    <div className="monitor-widget-card" key="cpu" style={widgetCursorStyle}>
                        <div className="widget-header">
                            <span>CPU Kullanımı</span>
                            <div className="widget-icon-wrapper" style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' }}>
                                <Cpu size={20} />
                            </div>
                        </div>
                        <div className="widget-value">{stats.current.cpu.usage}%</div>
                        <div className="widget-peak-container">
                            <span className="peak-label">Pik (24s)</span>
                            <div className="peak-badge" style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.2)' }}>
                                {stats.peaks?.cpu?.value}% {stats.peaks?.cpu?.time}
                            </div>
                        </div>
                        <div className="widget-progress-container">
                            <div className="widget-progress-bar" style={{ width: `${Math.min(100, stats.current.cpu.usage)}%`, backgroundColor: '#38bdf8' }}></div>
                        </div>
                    </div>
                );
            case 'ram':
                return (
                    <div className="monitor-widget-card" key="ram" style={widgetCursorStyle}>
                        <div className="widget-header">
                            <span>RAM Kullanımı</span>
                            <div className="widget-icon-wrapper" style={{ color: '#a855f7', background: 'rgba(168, 85, 247, 0.1)' }}>
                                <FlaskConical size={20} />
                            </div>
                        </div>
                        <div className="widget-value">{stats.current.ram.percent}%</div>
                        <div className="widget-peak-container">
                            <span className="peak-label">Pik (24s)</span>
                            <div className="peak-badge" style={{ color: '#a855f7', background: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.2)' }}>
                                {stats.peaks?.ram?.value}% {stats.peaks?.ram?.time}
                            </div>
                        </div>
                        <div className="widget-progress-container">
                            <div className="widget-progress-bar" style={{ width: `${Math.min(100, stats.current.ram.percent)}%`, backgroundColor: '#a855f7' }}></div>
                        </div>
                    </div>
                );
            case 'temp':
                return (
                    <div className="monitor-widget-card" key="temp" style={widgetCursorStyle}>
                        <div className="widget-header">
                            <span>Sıcaklık</span>
                            <div className="widget-icon-wrapper" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
                                <Thermometer size={20} />
                            </div>
                        </div>
                        <div className="widget-value">{stats.current.temp.celsius}°C</div>
                        <div className="widget-peak-container">
                            <span className="peak-label">Pik (24s)</span>
                            <div className="peak-badge" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                                {stats.peaks?.temp?.value}°C {stats.peaks?.temp?.time}
                            </div>
                        </div>
                        <div className="widget-progress-container">
                            <div className="widget-progress-bar" style={{ width: `${Math.min(100, (stats.current.temp.celsius / 85) * 100)}%`, backgroundColor: '#ef4444' }}></div>
                        </div>
                    </div>
                );
            case 'disk':
                return (
                    <div className="monitor-widget-card" key="disk" style={widgetCursorStyle}>
                        <div className="widget-header">
                            <span>Disk Kullanımı</span>
                            <div className="widget-icon-wrapper" style={{ color: '#eab308', background: 'rgba(234, 179, 8, 0.1)' }}>
                                <HardDrive size={20} />
                            </div>
                        </div>
                        <div className="widget-value">{stats.current.disk.percent}%</div>
                        <div className="widget-details" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', marginTop: '1rem', color: '#94a3b8' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Kullanılan:</span>
                                <span style={{ color: '#facc15' }}>{stats.current.disk.usedGB} GB</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Boş:</span>
                                <span style={{ color: '#4ade80' }}>{stats.current.disk.freeGB} GB</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Toplam:</span>
                                <span>{stats.current.disk.totalGB} GB</span>
                            </div>
                        </div>
                        <div className="widget-progress-container" style={{ marginTop: '0.5rem' }}>
                            <div className="widget-progress-bar" style={{ width: `${Math.min(100, stats.current.disk.percent)}%`, backgroundColor: '#facc15' }}></div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const renderSectionContent = (sectionId) => {
        switch (sectionId) {
            case 'widgets':
                return (
                    <SortableContext items={widgetOrder} disabled={!isEditMode}>
                        <div className="monitor-widgets-grid">
                            {widgetOrder.map((id) => (
                                <SortableItem key={id} id={id} disabled={!isEditMode}>
                                    {renderWidget(id)}
                                </SortableItem>
                            ))}
                        </div>
                    </SortableContext>
                );
            case 'chart':
                return (
                    <div style={{ zIndex: 1, paddingTop: isEditMode ? '1rem' : '0' }}>
                        {stats.history && stats.history.length > 0 ? (
                            <SystemHistoryChart data={stats.history} />
                        ) : (
                            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Grafik verisi bekleniyor...</div>
                        )}
                    </div>
                );
            case 'containers':
                return (
                    <div className="container-monitor-section" style={{ marginTop: isEditMode ? '1rem' : '2rem' }}>
                        <div className="section-header">
                            <h2>Konteyner Monitörü</h2>
                            <span className="container-count">{containers.length} Konteyner Çalışıyor</span>
                        </div>
                        <div className="table-responsive">
                            <table className="monitor-table">
                                <thead>
                                    <tr>
                                        <th>AD</th>
                                        <th>DURUM</th>
                                        <th>CPU %</th>
                                        <th>RAM %</th>
                                        <th><ArrowDown size={14} /> İNDİRME</th>
                                        <th><ArrowUp size={14} /> GÖNDERME</th>
                                        <th>RAM DETAY</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {containers.map((container) => (
                                        <tr key={container.id}>
                                            <td>
                                                <div className="container-name-cell">
                                                    <div className={`status-indicator ${container.state === 'running' ? 'active' : 'stopped'}`}></div>
                                                    <div>
                                                        <div className="c-name">{container.name}</div>
                                                        <div className="c-id">{container.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className={`status-badge ${container.state}`}>{container.state}</span></td>
                                            <td>
                                                <div className="stat-with-bar">
                                                    <span>{container.cpu}%</span>
                                                    <div className="mini-bar-bg"><div className="mini-bar-fill cpu-fill" style={{ width: `${Math.min(100, parseFloat(container.cpu))}%` }}></div></div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="stat-with-bar">
                                                    <span>{container.ram}%</span>
                                                    <div className="mini-bar-bg"><div className="mini-bar-fill ram-fill" style={{ width: `${Math.min(100, parseFloat(container.ram))}%` }}></div></div>
                                                </div>
                                            </td>
                                            <td><span className="net-stat rx">↓ {container.netRxMB} MB</span></td>
                                            <td><span className="net-stat tx">↑ {container.netTxMB} MB</span></td>
                                            <td><span className="ram-detail">{container.ramUsedMB} MB / {container.ramTotalGB} GB</span></td>
                                        </tr>
                                    ))}
                                    {containers.length === 0 && (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                                Çalışan konteyner bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="system-monitor-view">
            {/* Header Banner */}
            <div className="monitor-header-banner">
                <div className="monitor-header-left">
                    <div className="monitor-status-pill">
                        <div className="status-dot" style={{ backgroundColor: getStatusColor(stats.current.cpu.usage) }}></div>
                        <span>Sistem {stats.current.cpu.usage > 85 ? 'Kritik' : 'Normal'}</span>
                    </div>
                </div>
                <div className="monitor-header-right">
                    <div className="monitor-header-stat">
                        <span className="stat-label">ÇALIŞMA SÜRESİ</span>
                        <span className="stat-value uptime-text">{formatUptime(stats.current.uptime)}</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area (Sortable) */}
            <div className="monitor-sortable-area" style={{ marginTop: '1.5rem' }}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sectionOrder}
                        disabled={!isEditMode}
                    >
                        {sectionOrder.map((sectionId) => {
                            if (!isEditMode) {
                                return (
                                    <div key={sectionId} className="monitor-section-wrapper" style={{ width: '100%', display: 'block', position: 'relative', marginBottom: '1.5rem' }}>
                                        {renderSectionContent(sectionId)}
                                    </div>
                                );
                            }

                            return (
                                <SortableItem key={sectionId} id={sectionId} disabled={!isEditMode}>
                                    {({ attributes, listeners, isDragging }) => (
                                        <div className={`monitor-section-wrapper edit-mode ${isDragging ? 'dragging' : ''}`} style={{ width: '100%', display: 'block', position: 'relative', marginBottom: '1.5rem' }}>
                                            <div
                                                className="section-drag-handle"
                                                {...attributes}
                                                {...listeners}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.75rem 1rem',
                                                    background: 'rgba(56, 189, 248, 0.1)',
                                                    border: '1px dashed rgba(56, 189, 248, 0.4)',
                                                    borderRadius: '12px',
                                                    color: '#38bdf8',
                                                    cursor: 'grab',
                                                    marginBottom: '1rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                <GripHorizontal size={20} />
                                                <span>{sectionNames[sectionId]} Bölümünü Sürükle</span>
                                            </div>
                                            {renderSectionContent(sectionId)}
                                        </div>
                                    )}
                                </SortableItem>
                            );
                        })}
                    </SortableContext>
                </DndContext>
            </div>
        </div>
    );
};

export default SystemMonitor;
