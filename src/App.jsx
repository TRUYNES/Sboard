import React, { useState, useEffect, useCallback } from 'react';
import ServiceCard from './components/ServiceCard';
import SystemMetrics from './components/SystemMetrics';
import BottomNav from './components/BottomNav';
import SettingsModal from './components/SettingsModal';
import LockScreen from './components/LockScreen';
import TerminalModal from './components/TerminalModal';
import StackManager from './components/StackManager';
import SystemMonitor from './components/SystemMonitor';
import { SortableItem } from './components/SortableItem';
import { Search, LayoutGrid, Loader2, Plus, Edit2, Check, X, RotateCcw, Trash2, GripVertical, Undo2, Settings, Activity } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    arraySwap,
    SortableContext,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

function App() {
    const [searchTerm, setSearchTerm] = useState('');
    const [servicesData, setServicesData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [overId, setOverId] = useState(null);

    // Undo History
    const [history, setHistory] = useState([]);

    // New Service Form State
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [newService, setNewService] = useState({ name: '', hostname: '', service: '', icon: '' });

    // Reset Confirmation State
    const [showResetModal, setShowResetModal] = useState(false);

    // Delete Confirmation State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [serviceToDelete, setServiceToDelete] = useState(null);

    // Exit Warning Modal State
    const [showExitWarningModal, setShowExitWarningModal] = useState(false);

    // Menu/Settings Modal State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [monitorSaveSignal, setMonitorSaveSignal] = useState(0);
    const [monitorCancelSignal, setMonitorCancelSignal] = useState(0);
    const [monitorHasUnsavedChanges, setMonitorHasUnsavedChanges] = useState(false);

    // Terminal Modal State
    const [showTerminal, setShowTerminal] = useState(false);
    const [terminalContainer, setTerminalContainer] = useState(null); // { id, name }

    // Stack Manager State
    const [showStackManager, setShowStackManager] = useState(false);

    // Security State
    const [password, setPassword] = useState(null);
    const [isLocked, setIsLocked] = useState(false);

    // View Routing State
    const [currentView, setCurrentView] = useState('home'); // 'home' | 'monitor'
    const [systemStats, setSystemStats] = useState(null);

    // Centralize System Stats Fetching for complete sync between widgets
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/system/stats');
                const data = await res.json();
                setSystemStats(data);
            } catch (err) {
                console.error("Failed to fetch system stats:", err);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

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

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load Services
                const storedOrder = localStorage.getItem('dashboard_services');
                if (storedOrder) {
                    setServicesData(JSON.parse(storedOrder));
                } else {
                    const res = await fetch('/config.json');
                    const data = await res.json();

                    // Process Data to replace __HOST__ with actual hostname
                    const processedData = data.map((item, index) => ({
                        ...item,
                        id: item.id || `service-${index}`,
                        hostname: item.hostname ? item.hostname.replace('__HOST__', window.location.hostname) : item.hostname,
                        service: item.service ? item.service.replace('__HOST__', window.location.hostname) : item.service
                    }));

                    setServicesData(processedData);
                }

                // Load Security Settings
                const storedPassword = localStorage.getItem('sboard_password');
                if (storedPassword) {
                    setPassword(storedPassword);
                    setIsLocked(true);
                } else {
                    // Default Password Strategy
                    const defaultPass = 'admin123';
                    localStorage.setItem('sboard_password', defaultPass);
                    setPassword(defaultPass);
                    setIsLocked(true);
                }

                setLoading(false);
            } catch (err) {
                console.error("Failed to load config", err);
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleCancel = useCallback(() => {
        // Discard changes and exit edit mode
        // Reload data from localStorage or config.json
        const storedOrder = localStorage.getItem('dashboard_services');
        if (storedOrder) {
            setServicesData(JSON.parse(storedOrder));
        }

        // Signal System Monitor to reset
        setMonitorCancelSignal(prev => prev + 1);

        setIsEditMode(false);
        setHistory([]);
        setMonitorHasUnsavedChanges(false);
        setShowExitWarningModal(false);
    }, []);

    // Handle Escape key to exit edit mode
    const handleExitEditMode = useCallback(() => {
        if (history.length > 0 || monitorHasUnsavedChanges) {
            setShowExitWarningModal(true);
        } else {
            handleCancel();
        }
    }, [history.length, monitorHasUnsavedChanges, handleCancel]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isEditMode) {
                handleExitEditMode();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isEditMode, handleExitEditMode]);

    // Handle monitor draft changes
    useEffect(() => {
        const handleMonitorDraft = () => {
            setMonitorHasUnsavedChanges(true);
        };
        window.addEventListener('monitorDraftChange', handleMonitorDraft);
        return () => window.removeEventListener('monitorDraftChange', handleMonitorDraft);
    }, []);

    const addToHistory = (currentData) => {
        setHistory(prev => [...prev, JSON.stringify(currentData)]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;

        const previousState = JSON.parse(history[history.length - 1]);
        setServicesData(previousState);
        setHistory(prev => prev.slice(0, prev.length - 1));
    };

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event) => {
        setOverId(event.over?.id || null);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            // Save state before changing
            addToHistory(servicesData);

            setServicesData((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arraySwap(items, oldIndex, newIndex);
            });
        }
        setActiveId(null);
        setOverId(null);
    };

    const handleReset = () => {
        setShowResetModal(true);
    };

    const confirmReset = () => {
        localStorage.removeItem('dashboard_services');
        window.location.reload();
    };

    const handleDeleteClick = (id) => {
        setServiceToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = () => {
        if (serviceToDelete) {
            // Save state before changing
            addToHistory(servicesData);

            setServicesData(prev => prev.filter(s => s.id !== serviceToDelete));
            setServiceToDelete(null);
            setShowDeleteModal(false);
        }
    };

    const handleAddService = (e) => {
        e.preventDefault();
        if (!newService.name || !newService.hostname) return;

        // Save state before changing
        addToHistory(servicesData);

        if (editingServiceId) {
            // UPDATE Existing Service
            setServicesData(prev => prev.map(s =>
                s.id === editingServiceId ? { ...newService, id: editingServiceId } : s
            ));
            setEditingServiceId(null);
        } else {
            // CREATE New Service
            const newId = `custom-${Date.now()}`;
            const serviceToAdd = {
                ...newService,
                id: newId,
                // Default to 192.168.1.58: if not provided
                service: newService.service || `http://192.168.1.58:`
            };
            setServicesData([...servicesData, serviceToAdd]);
        }

        setNewService({ name: '', hostname: '', service: '', icon: '' });
        setShowAddModal(false);
    };

    const handleEditService = (service) => {
        setNewService({
            name: service.name,
            hostname: service.hostname,
            service: service.service,
            icon: service.icon || ''
        });
        setEditingServiceId(service.id);
        setShowAddModal(true);
    };

    // Clear edit state when closing modal
    const closeAddModal = () => {
        setShowAddModal(false);
        setEditingServiceId(null);
        setNewService({ name: '', hostname: '', service: '', icon: '' });
    };

    const handleSave = () => {
        localStorage.setItem('dashboard_services', JSON.stringify(servicesData));

        // Signal System Monitor to save
        setMonitorSaveSignal(prev => prev + 1);

        setIsEditMode(false);
        setHistory([]); // Clear history on save
        setMonitorHasUnsavedChanges(false);
    };


    const toggleEditMode = () => {
        if (isEditMode) {
            // User clicked "Done" - Save
            handleSave();
        } else {
            // User clicked "Edit" - Enter edit mode
            // Initial state is already loaded, so just enable edit mode
            setIsEditMode(true);
            setHistory([]); // Clear history when entering edit mode
        }
    };

    // --- Security & Settings Handlers ---

    const handleUnlock = () => {
        setIsLocked(false);
    };

    const handleUpdatePassword = (newPassword) => {
        if (newPassword) {
            localStorage.setItem('sboard_password', newPassword);
            setPassword(newPassword);
        } else {
            // Logic for 'removing' password? 
            // User asked for "Default Password", so maybe we don't allow removing, just changing.
            // But for now, if they want to remove security, we can allow it or reset to default.
            // Let's allow removal for flexibility, or reset to null.
            localStorage.removeItem('sboard_password');
            setPassword(null);
        }
    };

    const handleImport = (importedData) => {
        // Basic validation
        if (!Array.isArray(importedData)) return;

        // Normalize IDs if missing
        const dataWithIds = importedData.map((item, index) => ({
            ...item,
            id: item.id || `restored-${index}-${Date.now()}`
        }));

        setServicesData(dataWithIds);
        localStorage.setItem('dashboard_services', JSON.stringify(dataWithIds));

        // Add to history so user can undo if it was a mistake
        addToHistory(servicesData);

        alert("Yedek başarıyla geri yüklendi!");
    };

    const filteredServices = servicesData.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.hostname.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="loader-container">
                <Loader2 className="spin-anim" size={40} color="#38bdf8" />
            </div>
        );
    }

    return (
        <div className="container">
            {/* Header */}
            <div className="dashboard-header">
                <div className="brand">
                    <div className="brand-container" onClick={() => setCurrentView('home')} style={{ cursor: 'pointer' }}>
                        <div className="brand-icon">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="24" height="24" rx="6" fill="url(#paint0_linear)" />
                                <defs>
                                    <linearGradient id="paint0_linear" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#3b82f6" stopOpacity="0.2" />
                                        <stop offset="1" stopColor="#8b5cf6" stopOpacity="0.1" />
                                    </linearGradient>
                                </defs>
                                {/* S Harfi Noktalar */}
                                <rect x="15" y="5" width="4" height="3" rx="1" fill="#38bdf8" />
                                <rect x="10" y="5" width="4" height="3" rx="1" fill="#38bdf8" />
                                <rect x="5" y="5" width="4" height="3" rx="1" fill="#38bdf8" />

                                <rect x="5" y="9" width="4" height="3" rx="1" fill="#38bdf8" />

                                <rect x="5" y="12" width="4" height="3" rx="1" fill="#38bdf8" />
                                <rect x="10" y="12" width="4" height="3" rx="1" fill="#38bdf8" />
                                <rect x="15" y="12" width="4" height="3" rx="1" fill="#38bdf8" />

                                <rect x="15" y="16" width="4" height="3" rx="1" fill="#38bdf8" />

                                <rect x="5" y="19" width="4" height="3" rx="1" fill="#38bdf8" />
                                <rect x="10" y="19" width="4" height="3" rx="1" fill="#38bdf8" />
                                <rect x="15" y="19" width="4" height="3" rx="1" fill="#38bdf8" />
                            </svg>
                        </div>
                        <div className="brand-text">
                            <h1>Sboard</h1>
                            <p>System Dashboard</p>
                        </div>
                    </div>
                    {/* Mobile Search - Integrated into Header */}
                    <div className="mobile-inline-search">
                        <Search size={16} className="search-icon-sm" />
                        <input
                            type="text"
                            placeholder="Ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Mobile Metric Badges */}
                    <SystemMetrics isMobile={true} stats={systemStats?.current} />
                </div>

                {/* Lock Screen Overlay */}
                {isLocked && (
                    <LockScreen
                        savedPassword={password}
                        onUnlock={handleUnlock}
                    />
                )}

                {/* Settings Modal */}
                {showSettingsModal && (
                    <SettingsModal
                        onClose={() => setShowSettingsModal(false)}
                        servicesData={servicesData}
                        onImport={handleImport}
                        onUpdatePassword={handleUpdatePassword}
                        hasPassword={!!password}
                    />
                )}

                {/* Terminal Modal */}
                {showTerminal && terminalContainer && (
                    <TerminalModal
                        onClose={() => setShowTerminal(false)}
                        containerId={terminalContainer.containerId || terminalContainer.id.replace('auto-', '')}
                        containerName={terminalContainer.name}
                    />
                )}

                {/* Stack Manager Modal */}
                {showStackManager && (
                    <StackManager onClose={() => setShowStackManager(false)} />
                )}

                {/* Desktop System Metrics */}
                <SystemMetrics stats={systemStats?.current} />

                <div className="header-controls">
                    {/* Desktop Search Bar */}
                    {/* Desktop Search Bar - Hidden in Edit Mode to make space */}
                    {!isEditMode && (
                        <div className="search-container">
                            <Search className="search-icon" size={20} />
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Servis ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Monitor Button (Desktop) */}
                    {!isEditMode && (
                        <button
                            onClick={() => setCurrentView(currentView === 'home' ? 'monitor' : 'home')}
                            className={`action-btn btn-view-toggle ${currentView === 'monitor' ? 'active' : ''}`}
                            title="Sistem Monitörü"
                            style={{ borderRadius: '12px', marginRight: '0.5rem', height: '48px', ...(currentView === 'monitor' ? { background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.2)' } : {}) }}
                        >
                            <Activity size={20} />
                            {currentView === 'home' ? <span>Sistem Monitörü</span> : <span>Ana Sayfa</span>}
                        </button>
                    )}

                    {/* Stack Manager Button (Desktop) */}
                    {!isEditMode && currentView === 'home' && (
                        <button
                            onClick={() => setShowStackManager(true)}
                            className="action-btn btn-neon-glow"
                            title="Stack Yöneticisi"
                            style={{ borderRadius: '12px', marginRight: '0.5rem', height: '48px' }}
                        >
                            <LayoutGrid size={20} />
                            <span>Stack Yöneticisi</span>
                        </button>
                    )}

                    {/* Settings Button (Desktop) */}
                    {!isEditMode && currentView === 'home' && (
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="action-btn"
                            title="Ayarlar"
                            style={{ width: '48px', height: '48px', borderRadius: '12px', marginRight: '0.5rem' }}
                        >
                            <Settings size={20} />
                        </button>
                    )}

                    {/* Edit Controls */}
                    <div className="edit-actions">

                        {isEditMode && (
                            <>
                                {currentView === 'home' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setEditingServiceId(null);
                                                setNewService({ name: '', hostname: '', service: '', icon: '' });
                                                setShowAddModal(true);
                                            }}
                                            className="action-btn btn-add"
                                            title="Servis Ekle"
                                        >
                                            <Plus size={20} />
                                        </button>

                                        {history.length > 0 && (
                                            <button
                                                onClick={handleUndo}
                                                className="action-btn btn-reset"
                                                title="Son İşlemi Geri Al"
                                                style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.2)', background: 'rgba(251, 191, 36, 0.1)' }}
                                            >
                                                <Undo2 size={20} />
                                            </button>
                                        )}

                                        <button
                                            onClick={handleReset}
                                            className="action-btn btn-reset"
                                            title="Varsayılana Dön"
                                        >
                                            <RotateCcw size={20} />
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={handleExitEditMode}
                                    className="action-btn btn-cancel"
                                    title="Düzenleme Modundan Çık"
                                >
                                    <X size={18} />
                                    İptal
                                </button>
                            </>
                        )}

                        <button
                            onClick={toggleEditMode}
                            className={`action-btn btn-edit ${isEditMode ? 'active' : ''}`}
                            title={isEditMode ? "Değişiklikleri Kaydet" : "Paneli Düzenle"}
                        >
                            {isEditMode ? <Check size={18} /> : <Edit2 size={18} />}
                            {isEditMode ? 'Tamam' : 'Düzenle'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            {currentView === 'monitor' ? (
                <SystemMonitor
                    stats={systemStats}
                    isEditMode={isEditMode}
                    saveSignal={monitorSaveSignal}
                    cancelSignal={monitorCancelSignal}
                    onDraftChange={() => {
                        window.dispatchEvent(new Event('monitorDraftChange'));
                    }}
                />
            ) : (
                /* Grid */
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={filteredServices.map(s => s.id)}
                        strategy={() => null}
                        disabled={!isEditMode}
                    >
                        <div className="service-grid">
                            {filteredServices.map((service) => (
                                <SortableItem
                                    key={service.id}
                                    id={service.id}
                                    disabled={!isEditMode}
                                    isOver={overId === service.id && activeId !== service.id} // Highlight if it's the drop target
                                >
                                    {({ attributes, listeners }) => (
                                        <div className="service-card-wrapper group relative">
                                            {/* Edit Overlay - Only visible in Edit Mode on Hover */}
                                            {isEditMode && (
                                                <div className="edit-controls-overlay">
                                                    {/* Drag Handle Button */}
                                                    <div
                                                        {...attributes}
                                                        {...listeners}
                                                        className="edit-control-btn btn-drag"
                                                        title="Taşımak İçin Sürükle"
                                                    >
                                                        <GripVertical size={24} />
                                                    </div>

                                                    {/* Edit Button */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditService(service);
                                                        }}
                                                        className="edit-control-btn btn-edit-action"
                                                        title="Servisi Düzenle"
                                                    >
                                                        <Edit2 size={24} />
                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteClick(service.id);
                                                        }}
                                                        className="edit-control-btn btn-delete-action"
                                                        title="Servisi Sil"
                                                    >
                                                        <Trash2 size={24} />
                                                    </button>
                                                </div>
                                            )}

                                            <ServiceCard
                                                service={service}
                                                onTerminal={(s) => {
                                                    setTerminalContainer(s);
                                                    setShowTerminal(true);
                                                }}
                                            />
                                        </div>
                                    )}
                                </SortableItem>
                            ))}
                        </div>
                    </SortableContext>

                    <DragOverlay>
                        {activeId ? (
                            <div className="service-card" style={{ opacity: 0.9, cursor: 'grabbing' }}>
                                <ServiceCard service={servicesData.find(s => s.id === activeId)} />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Add Service Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-title">
                                <div style={{ padding: '0.4rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: '#34d399' }}>
                                    {editingServiceId ? <Edit2 size={20} /> : <Plus size={20} />}
                                </div>
                                {editingServiceId ? 'Servisi Düzenle' : 'Yeni Servis Ekle'}
                            </div>
                            <button onClick={closeAddModal} className="modal-close">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddService} className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">İsim</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        required
                                        className="form-input"
                                        placeholder="örn. Plex"
                                        value={newService.name}
                                        onChange={e => setNewService({ ...newService, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hostname</label>
                                    <input
                                        type="text"
                                        required
                                        className="form-input"
                                        placeholder="app.domain.com"
                                        value={newService.hostname}
                                        onChange={e => setNewService({ ...newService, hostname: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Dahili URL (Opsiyonel)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="http://192.168.1.58:"
                                    value={newService.service}
                                    onChange={e => setNewService({ ...newService, service: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">İkon URL</label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="https://..."
                                        value={newService.icon}
                                        onChange={e => setNewService({ ...newService, icon: e.target.value })}
                                        style={{ flex: 1 }}
                                    />
                                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {newService.icon ? (
                                            <img src={newService.icon} alt="" style={{ width: '24px', height: '24px', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                                        ) : (
                                            <LayoutGrid size={20} color="#64748b" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={closeAddModal} className="btn-cancel">
                                    İptal
                                </button>
                                <button type="submit" className="btn-submit">
                                    {editingServiceId ? 'Kaydet' : 'Servis Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            {showResetModal && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <div className="modal-title">
                                <div style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444' }}>
                                    <RotateCcw size={20} />
                                </div>
                                Pano Sıfırlansın mı?
                            </div>
                            <button onClick={() => setShowResetModal(false)} className="modal-close">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p style={{ color: '#94a3b8', lineHeight: '1.5' }}>
                                Tüm değişiklikleri sıfırlamak istediğinizden emin misiniz? Bu, özel servislerinizi silecek ve varsayılan yapılandırmaya dönecektir. Bu işlem geri alınamaz.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button onClick={() => setShowResetModal(false)} className="btn-cancel">
                                İptal
                            </button>
                            <button
                                onClick={confirmReset}
                                className="btn-submit"
                                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                            >
                                Her Şeyi Sıfırla
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Warning Modal */}
            {showExitWarningModal && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <div className="modal-title">
                                <div style={{ padding: '0.4rem', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px', color: '#fbbf24' }}>
                                    <X size={20} />
                                </div>
                                Kaydedilmemiş Değişiklikler
                            </div>
                            <button onClick={() => setShowExitWarningModal(false)} className="modal-close">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p style={{ color: '#94a3b8', lineHeight: '1.5' }}>
                                Kaydedilmemiş değişiklikleriniz var. Bunları atmak istediğinizden emin misiniz?
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                onClick={() => setShowExitWarningModal(false)}
                                className="btn-submit"
                            >
                                Düzenlemeye Devam Et
                            </button>
                            <button
                                onClick={handleCancel}
                                className="btn-cancel"
                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            >
                                Değişiklikleri At
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <div className="modal-title">
                                <div style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444' }}>
                                    <Trash2 size={20} />
                                </div>
                                Servis Silinsin mi?
                            </div>
                            <button onClick={() => setShowDeleteModal(false)} className="modal-close">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p style={{ color: '#94a3b8', lineHeight: '1.5' }}>
                                Bu servisi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteModal(false)} className="btn-cancel">
                                İptal
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="btn-submit"
                                style={{ background: '#ef4444', borderColor: '#ef4444' }}
                            >
                                Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {filteredServices.length === 0 && (
                <div className="empty-state">
                    <p>"{searchTerm}" ile eşleşen servis bulunamadı</p>
                </div>
            )}

            {/* Footer */}
            <div className="dashboard-footer">
                <p>© 2026 Noktafikir. Debian Docker Sistemi üzerinde çalışıyor.</p>
            </div>

            {/* Fade Overlay for Mobile */}
            <div className="bottom-fade-overlay"></div>

            {/* Bottom Navigation - Mobile Only */}
            <BottomNav
                currentView={currentView}
                onHomeClick={() => setCurrentView('home')}
                onMonitorClick={() => setCurrentView('monitor')}
                isEditMode={isEditMode}
                onEditToggle={toggleEditMode}
                onAddService={() => {
                    setEditingServiceId(null);
                    setNewService({ name: '', hostname: '', service: '', icon: '' });
                    setShowAddModal(true);
                }}
                onCancelEdit={handleExitEditMode}
                onUndo={handleUndo}
                canUndo={history.length > 0}
                onReset={handleReset}
                onStackManagerClick={() => setShowStackManager(true)}
                onMenuClick={() => setShowSettingsModal(true)}
            />
        </div>
    );
}

export default App;
