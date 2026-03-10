import { Cpu, Thermometer, MemoryStick } from 'lucide-react';

const SystemMetrics = ({ isMobile = false, stats }) => {
    if (!stats) return null;

    // Calculate RAM percentage from fetched data if available, else fallback
    const ramPercent = stats.ram.percent ? Math.round(stats.ram.percent) : 0;

    // Mobile badge layout
    if (isMobile) {
        return (
            <div className="metric-badges">
                <span className="badge cpu">{parseFloat(stats.cpu.usage).toFixed(1)}%</span>
                <span className="badge temp">{stats.temp.celsius}°</span>
                <span className="badge ram">{ramPercent}%</span>
            </div>
        );
    }

    // Desktop horizontal layout
    return (
        <div className="system-metrics-container">
            {/* CPU */}
            <div className="metric-item" title="CPU Kullanımı">
                <Cpu size={14} className="metric-icon" />
                <span className="metric-text">{parseFloat(stats.cpu.usage).toFixed(1)}%</span>
            </div>

            {/* Divider */}
            <div className="metric-divider"></div>

            {/* Temperature */}
            <div className="metric-item" title="CPU Sıcaklığı">
                <Thermometer size={14} className="metric-icon" />
                <span className="metric-text">{stats.temp.celsius}°C</span>
            </div>

            {/* Divider */}
            <div className="metric-divider"></div>

            {/* RAM */}
            <div className="metric-item" title="RAM Kullanımı">
                <MemoryStick size={14} className="metric-icon" />
                <span className="metric-text">{ramPercent}%</span>
            </div>
        </div>
    );
};

export default SystemMetrics;
