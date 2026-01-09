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
  arraySwap,
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
    const loadData = async () => {
      try {
        const storedOrder = localStorage.getItem('dashboard_services');
        if (storedOrder) {
          setServicesData(JSON.parse(storedOrder));
          setLoading(false);
        } else {
          const res = await fetch('/config.json');
          const data = await res.json();
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
        return arraySwap(items, oldIndex, newIndex);
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

        <div className="header-controls">
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

          {/* Edit Controls */}
          <div className="edit-actions">
            {isEditMode && (
              <>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="action-btn btn-add"
                  title="Add Service"
                >
                  <Plus size={20} />
                </button>
                <button
                  onClick={handleReset}
                  className="action-btn btn-reset"
                  title="Reset to Default"
                >
                  <RotateCcw size={20} />
                </button>
              </>
            )}

            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`action-btn btn-edit ${isEditMode ? 'active' : ''}`}
              title={isEditMode ? "Done Editing" : "Edit Dashboard"}
            >
              {isEditMode ? <Check size={18} /> : <Edit2 size={18} />}
              {isEditMode ? 'Done' : 'Edit'}
            </button>
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
                <div className="service-card-wrapper group">
                  <ServiceCard service={service} />

                  {/* Delete Overlay */}
                  {isEditMode && (
                    <div className="delete-overlay">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          // Stop DnD from grabbing this
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(service.id);
                        }}
                        className="btn-delete"
                        title="Delete Service"
                      >
                        <Trash2 size={20} />
                      </button>
                      <span className="delete-text">Delete</span>
                    </div>
                  )}
                </div>
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

      {/* Add Service Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title">
                <div style={{ padding: '0.4rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: '#34d399' }}>
                  <Plus size={20} />
                </div>
                Add New Service
              </div>
              <button onClick={() => setShowAddModal(false)} className="modal-close">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddService} className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    autoFocus
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Plex"
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
                <label className="form-label">Internal URL (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="http://192.168.1.XX:PORT"
                  value={newService.service}
                  onChange={e => setNewService({ ...newService, service: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Icon URL</label>
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
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
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
