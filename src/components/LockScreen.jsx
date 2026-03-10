import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

export default function LockScreen({ onUnlock, savedPassword }) {
    const inputRef = React.useRef(null);
    const [hasInput, setHasInput] = useState(false);
    const [error, setError] = useState(false);

    // Focus input on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Check for autofill periodically to show/hide arrow button
    useEffect(() => {
        const checkAutofill = setInterval(() => {
            if (inputRef.current) {
                const val = inputRef.current.value;
                if (val && !hasInput) setHasInput(true);
                if (!val && hasInput) setHasInput(false);
            }
        }, 200);
        return () => clearInterval(checkAutofill);
    }, [hasInput]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const currentPassword = inputRef.current?.value || '';
        if (currentPassword === savedPassword) {
            onUnlock();
        } else {
            setError(true);
            if (inputRef.current) inputRef.current.value = '';
            setHasInput(false);
        }
    };

    // Explicit Enter key handler as backup
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '2rem'
        }}>
            <div style={{
                padding: '1.5rem',
                background: 'rgba(56, 189, 248, 0.1)',
                borderRadius: '24px', // Squareshape consistent with logo
                color: '#38bdf8',
                boxShadow: '0 0 30px rgba(56, 189, 248, 0.2)'
            }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* S-Shape Grid Logo */}
                    <rect x="5" y="3" width="4" height="3" rx="1" fill="#38bdf8" />
                    <rect x="10" y="3" width="4" height="3" rx="1" fill="#38bdf8" />
                    <rect x="15" y="3" width="4" height="3" rx="1" fill="#38bdf8" />

                    <rect x="5" y="7" width="4" height="3" rx="1" fill="#38bdf8" fillOpacity="0.8" />

                    <rect x="5" y="11" width="4" height="3" rx="1" fill="#38bdf8" />
                    <rect x="10" y="11" width="4" height="3" rx="1" fill="#38bdf8" />
                    <rect x="15" y="11" width="4" height="3" rx="1" fill="#38bdf8" />

                    <rect x="15" y="15" width="4" height="3" rx="1" fill="#38bdf8" fillOpacity="0.8" />

                    <rect x="5" y="19" width="4" height="3" rx="1" fill="#38bdf8" />
                    <rect x="10" y="19" width="4" height="3" rx="1" fill="#38bdf8" />
                    <rect x="15" y="19" width="4" height="3" rx="1" fill="#38bdf8" />
                </svg>
            </div>

            <div style={{ textAlign: 'center' }}>
                <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Sboard
                </h1>
                <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Güvenli Giriş</p>
                <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.2rem', opacity: 0.7 }}>Varsayılan: admin123</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
                <input
                    ref={inputRef}
                    id="password-input"
                    type="password"
                    onChange={(e) => {
                        setHasInput(e.target.value.length > 0);
                        setError(false);
                    }}
                    onFocus={(e) => {
                        e.target.value = '';
                        setHasInput(false);
                    }}
                    placeholder="Şifre Giriniz"
                    onKeyDown={handleKeyDown}
                    className={`login-input ${error ? 'error' : ''}`}
                />
                <button
                    type="submit"
                    className={`login-submit-btn ${hasInput ? 'visible' : ''}`}
                >
                    <ArrowRight size={20} />
                </button>
            </form>
        </div >
    );
}
