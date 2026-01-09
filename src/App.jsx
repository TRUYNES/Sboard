import React, { useState, useMemo, useEffect } from 'react';
import ServiceCard from './components/ServiceCard';
import { Search, LayoutGrid, Loader2 } from 'lucide-react';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [servicesData, setServicesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/config.json')
      .then(res => res.json())
      .then(data => {
        setServicesData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load config", err);
        setLoading(false);
      });
  }, []);

  const filteredServices = useMemo(() => {
    return servicesData.filter(service =>
      service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.hostname.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, servicesData]);

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

      {/* Grid */}
      <div className="service-grid">
        {filteredServices.map((service, index) => (
          <ServiceCard key={index} service={service} />
        ))}
      </div>

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
