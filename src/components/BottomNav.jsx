import { Home, Edit2, Plus, Menu, X, Check, Search, Undo2, RotateCcw, LayoutGrid, Activity } from 'lucide-react';

const BottomNav = ({ currentView, isEditMode, onEditToggle, onAddService, onMenuClick, onCancelEdit, onUndo, canUndo, onReset, onStackManagerClick, onHomeClick, onMonitorClick }) => {
    return (
        <div className="bottom-nav">
            {!isEditMode && (
                <button
                    className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
                    onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        if (onHomeClick) onHomeClick();
                    }}
                >
                    <Home size={20} />
                    <span>Ana Sayfa</span>
                </button>
            )}

            {!isEditMode && (
                <button
                    className={`nav-item ${currentView === 'monitor' ? 'active' : ''}`}
                    onClick={onMonitorClick}
                >
                    <Activity size={20} />
                    <span>Monitör</span>
                </button>
            )}

            {!isEditMode && (
                <button
                    className="nav-item"
                    onClick={onStackManagerClick}
                >
                    <LayoutGrid size={20} />
                    <span>Stack Manager</span>
                </button>
            )}

            {!isEditMode && (
                <button
                    className="nav-item"
                    onClick={onMenuClick} // Reusing onMenuClick for Settings/Menu
                >
                    <Menu size={20} />
                    <span>Ayarlar</span>
                </button>
            )}

            {isEditMode && currentView === 'home' && (
                <button className="nav-item" onClick={onAddService}>
                    <Plus size={20} />
                    <span>Ekle</span>
                </button>
            )}

            {isEditMode && currentView === 'home' && canUndo && (
                <button className="nav-item" onClick={onUndo}>
                    <Undo2 size={20} />
                    <span>Geri Al</span>
                </button>
            )}

            {isEditMode && currentView === 'home' && (
                <button className="nav-item" onClick={onReset}>
                    <RotateCcw size={20} />
                    <span>Sıfırla</span>
                </button>
            )}

            {isEditMode && (
                <button
                    className="nav-item"
                    onClick={onCancelEdit}
                >
                    <X size={20} />
                    <span>İptal</span>
                </button>
            )}

            <button
                className="nav-item"
                onClick={onEditToggle}
            >
                {isEditMode ? <Check size={20} /> : <Edit2 size={20} />}
                <span>{isEditMode ? 'Tamam' : 'Düzenle'}</span>
            </button>
        </div>
    );
};

export default BottomNav;
