import React, { useState, useRef } from 'react';
import { X, Download, Upload, Shield, Key, AlertTriangle, Check, Copy, Eye, EyeOff } from 'lucide-react';
import { saveAs } from 'file-saver';

export default function SettingsModal({ onClose, servicesData, onImport, onUpdatePassword, hasPassword }) {
    const [activeTab, setActiveTab] = useState('data'); // 'data' or 'security'
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passError, setPassError] = useState('');
    const [passSuccess, setPassSuccess] = useState('');
    const [showRawJson, setShowRawJson] = useState(false);

    const fileInputRef = useRef(null);

    // --- Data Handlers ---

    const handleExport = () => {
        try {
            const dataStr = JSON.stringify(servicesData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
            saveAs(blob, `sboard-backup-${new Date().toISOString().split('T')[0]}.json`);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Yedek indirme işlemi başlatılamadı. Lütfen 'Manuel Kopyalama' yöntemini deneyin.");
        }
    };

    const handleCopyJson = () => {
        const dataStr = JSON.stringify(servicesData, null, 2);
        navigator.clipboard.writeText(dataStr).then(() => {
            alert("Yedek verisi panoya kopyalandı! Bir metin dosyasına yapıştırıp .json olarak kaydedebilirsiniz.");
        }).catch(err => {
            console.error('Copy failed', err);
            setShowRawJson(true); // Fallback: show text area
        });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    onImport(importedData);
                    onClose(); // Close modal on success
                } else {
                    alert("Geçersiz yedek dosyası formatı.");
                }
            } catch (err) {
                alert("Dosya okunamadı: " + err.message);
            }
        };
        reader.readAsText(file);
    };

    // --- Security Handlers ---

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        setPassError('');
        setPassSuccess('');

        if (password.length < 4) {
            setPassError('Şifre en az 4 karakter olmalıdır.');
            return;
        }

        if (password !== confirmPassword) {
            setPassError('Şifreler eşleşmiyor.');
            return;
        }

        // Save Password
        onUpdatePassword(password);
        setPassSuccess('Şifre başarıyla güncellendi.');
        setPassword('');
        setConfirmPassword('');

        // Clear success msg after 3s
        setTimeout(() => setPassSuccess(''), 3000);
    };

    const clearPassword = () => {
        if (confirm("Giriş şifresini kaldırmak istediğinize emin misiniz? Pano herkese açık olacak.")) {
            onUpdatePassword(null);
            setPassSuccess('Şifre kaldırıldı.');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <div className="modal-title">
                        Ayarlar
                    </div>
                    <button onClick={onClose} className="modal-close">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ padding: '0 1.5rem', display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <button
                        onClick={() => setActiveTab('data')}
                        style={{
                            padding: '1rem 0',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'data' ? '2px solid #38bdf8' : '2px solid transparent',
                            color: activeTab === 'data' ? '#38bdf8' : '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontWeight: 500
                        }}
                    >
                        <Download size={18} /> Yedekleme
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        style={{
                            padding: '1rem 0',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'security' ? '2px solid #38bdf8' : '2px solid transparent',
                            color: activeTab === 'security' ? '#38bdf8' : '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontWeight: 500
                        }}
                    >
                        <Shield size={18} /> Güvenlik
                    </button>
                </div>

                <div className="modal-body" style={{ minHeight: '300px' }}>

                    {/* DATA TAB */}
                    {activeTab === 'data' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* DOWNLOAD SECTION */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Download size={20} color="#34d399" />
                                    Yedekle
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
                                    Yedek dosyasını (.json) bilgisayarınıza indirir.
                                </p>
                                <button
                                    onClick={handleExport}
                                    className="btn-submit"
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                >
                                    <Download size={18} /> Dosyayı İndir
                                </button>

                                {/* Fallback Copy Section */}
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                        İndirme çalışmazsa:
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={handleCopyJson}
                                            className="btn-cancel"
                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
                                        >
                                            <Copy size={16} /> Panoya Kopyala
                                        </button>
                                        <button
                                            onClick={() => setShowRawJson(!showRawJson)}
                                            className="btn-cancel"
                                            style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Veriyi Gör"
                                        >
                                            {showRawJson ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>

                                    {showRawJson && (
                                        <textarea
                                            readOnly
                                            value={JSON.stringify(servicesData, null, 2)}
                                            style={{
                                                width: '100%',
                                                height: '150px',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '6px',
                                                color: '#94a3b8',
                                                marginTop: '0.5rem',
                                                padding: '0.5rem',
                                                fontSize: '0.8rem',
                                                fontFamily: 'monospace'
                                            }}
                                            onClick={(e) => e.target.select()}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* IMPORT SECTION */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Upload size={20} color="#60a5fa" />
                                    Geri Yükle
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
                                    Daha önce aldığınız bir yedeği geri yükleyin.
                                    <span style={{ display: 'block', color: '#f87171', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                                        <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                        Uyarı: Mevcut düzeniniz silinecektir.
                                    </span>
                                </p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept=".json"
                                    onChange={handleFileChange}
                                />
                                <button
                                    onClick={handleImportClick}
                                    className="btn-submit"
                                    style={{ width: '100%', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' }}
                                >
                                    <Upload size={18} /> Dosya Seç ve Yükle
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Key size={20} color="#fbbf24" />
                                    Giriş Şifresi
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem' }}>
                                    Panoya erişim için bir güvenlik şifresi belirleyin.
                                </p>

                                {hasPassword && (
                                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', color: '#34d399', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Check size={16} /> Güvenlik Aktif
                                    </div>
                                )}

                                <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">{hasPassword ? 'Yeni Şifre' : 'Şifre Oluştur'}</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            placeholder="******"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Şifre Tekrar</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            placeholder="******"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>

                                    {passError && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{passError}</p>}
                                    {passSuccess && <p style={{ color: '#34d399', fontSize: '0.85rem' }}>{passSuccess}</p>}

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button type="submit" className="btn-submit">
                                            {hasPassword ? 'Şifreyi Güncelle' : 'Kaydet'}
                                        </button>
                                        {hasPassword && (
                                            <button type="button" onClick={clearPassword} className="btn-cancel" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                                Kaldır
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
