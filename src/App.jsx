import React, { useState, useEffect } from 'react';
import ServiceCard from './components/ServiceCard';
import { SortableItem } from './components/SortableItem';
import { Search, LayoutGrid, Loader2, Plus, Edit2, Check, X, RotateCcw, Trash2 } from 'lucide-react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [servicesData, setServicesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState(null);

  // New Service Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newService, setNewService] = useState({ name: '', hostname: '', service: '', icon: '' });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Load config or local storage
    const loadData = async () => {
      try {
        const storedOrder = localStorage.getItem('dashboard_services');
        if (storedOrder) {
          setServicesData(JSON.parse(storedOrder));
          setLoading(false);
        } else {
          const res = await fetch('/config.json');
          const data = await res.json();
          // Add unique IDs if not present for DnD
          const dataWithIds = data.map((item, index) => ({
            ...item,
            id: item.id || `service-${index}`
          }));
          setServicesData(dataWithIds);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load config", err);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Save to local storage whenever data changes
  useEffect(() => {
    if (servicesData.length > 0) {
      localStorage.setItem('dashboard_services', JSON.stringify(servicesData));
    }
  }, [servicesData]);

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setServicesData((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all changes and load the default config?')) {
      localStorage.removeItem('dashboard_services');
      window.location.reload();
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this service?')) {
      setServicesData(servicesData.filter(s => s.id !== id));
    }
  };

  const handleAddService = (e) => {
    e.preventDefault();
    if (!newService.name || !newService.hostname) return;

    const newId = `custom-${Date.now()}`;
    const serviceToAdd = {
      ...newService,
      id: newId,
      // Auto-set service URL if empty based on hostname logic (simple approximation)
      service: newService.service || `http://${newService.hostname}`
    };

    setServicesData([...servicesData, serviceToAdd]);
    setNewService({ name: '', hostname: '', service: '', icon: '' });
    setShowAddModal(false);
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
          <div className="brand-icon">
            <LayoutGrid size={32} />
          </div>
          <div className="brand-text">
            <h1>Pi Dashboard</h1>
            <p>Raspberry Pi 4 • Docker Services</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Edit Mode Toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`action-btn ${isEditMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50' : 'bg-white/5 border-white/10'}`}
            title={isEditMode ? "Done Editing" : "Edit Dashboard"}
            style={{ width: 'auto', padding: '0 1rem', gap: '0.5rem' }}
          >
            {isEditMode ? <Check size={18} /> : <Edit2 size={18} />}
            {isEditMode ? 'Done' : 'Edit'}
          </button>

          {isEditMode && (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="action-btn bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                title="Add Service"
              >
                <Plus size={20} />
              </button>
              <button
                onClick={handleReset}
                className="action-btn bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                title="Reset to Default"
              >
                <RotateCcw size={20} />
              </button>
            </>
          )}

          {/* Search Bar */}
          <div className="search-container">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              className="search-input"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredServices.map(s => s.id)}
          strategy={rectSortingStrategy}
          disabled={!isEditMode}
        >
          <div className="service-grid">
            {filteredServices.map((service) => (
              <SortableItem key={service.id} id={service.id} disabled={!isEditMode}>
                <div className="relative group">
                  <ServiceCard service={service} />
                  {isEditMode && (
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {isEditMode && <div className="absolute inset-0 cursor-move" style={{ zIndex: -1 }} />}
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div style={{ opacity: 0.8 }}>
              <ServiceCard service={servicesData.find(s => s.id === activeId)} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add Service Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Add New Service</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddService} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name</label>
                <input
                  autoFocus
                  type="text"
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-sky-500"
                  placeholder="e.g. Plex"
                  value={newService.name}
                  onChange={e => setNewService({ ...newService, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Hostname (External)</label>
                <input
                  type="text"
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-sky-500"
                  placeholder="e.g. plex.noktafikir.com"
                  value={newService.hostname}
                  onChange={e => setNewService({ ...newService, hostname: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Service URL (Internal)</label>
                <input
                  type="text"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-sky-500"
                  placeholder="e.g. http://192.168.1.58:32400"
                  value={newService.service}
                  onChange={e => setNewService({ ...newService, service: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Icon URL</label>
                <input
                  type="text"
                  className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-sky-500"
                  placeholder="https://..."
                  value={newService.icon}
                  onChange={e => setNewService({ ...newService, icon: e.target.value })}
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium transition-colors">
                  Add Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredServices.length === 0 && (
        <div className="empty-state">
          <p>No services found matching "{searchTerm}"</p>
        </div>
      )}

      {/* Footer */}
      <div className="dashboard-footer">
        <p>© 2026 Noktafikir. Running on Debian Docker System.</p>
      </div>
    </div>
  );
}

export default App;
