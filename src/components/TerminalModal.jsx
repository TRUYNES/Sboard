import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io } from 'socket.io-client';
import { X, Loader2 } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

export default function TerminalModal({ onClose, containerId, containerName }) {
    const terminalRef = useRef(null);

    useEffect(() => {
        // Initialize Terminal
        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0f172a',
                foreground: '#f8fafc',
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            rows: 30
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        if (terminalRef.current) {
            term.open(terminalRef.current);
            fitAddon.fit();
        }

        term.writeln(`\x1b[1;34m>>> Connecting to logs for ${containerName}...\x1b[0m\r\n`);

        // Initialize Socket
        // Use current host for socket connection (dynamically)
        const socketInstance = io(window.location.origin, {
            path: '/socket.io'
        });

        socketInstance.on('connect', () => {
            term.writeln(`\x1b[1;32m>>> Connected! Streaming logs...\x1b[0m\r\n`);

            // Subscribe to specific container logs
            // We need the REAL docker container ID, not the service ID 'auto-...'
            // We assume 'containerId' passed here is the real one or we handle it in parent.
            socketInstance.emit('logs:subscribe', containerId);
        });

        socketInstance.on('logs:data', (data) => {
            // Basic cleanup of docker headers if raw bytes appear (simplistic approach)
            // Docker headers usually invoke unprintable chars. xterm handles most well.
            // If we see header issues, we might strip first 8 chars if binary.
            // But for text stream, it's usually fine.

            // Filter out the 8-byte header visually if possible?
            // Actually, if we just convert to string, it prints OK mostly.
            // Let's print raw for now.

            // Very simple check: if first char is non-printable and < 30 (but not \n \r), maybe skip 8 bytes?
            // Not robust implementation for client-side demux.

            // Just write it.
            term.write(data);
        });

        socketInstance.on('logs:error', (err) => {
            term.writeln(`\r\n\x1b[1;31m>>> Error: ${err}\x1b[0m`);
        });

        socketInstance.on('logs:end', () => {
            term.writeln(`\r\n\x1b[1;33m>>> Log stream ended.\x1b[0m`);
        });

        // Resize handler
        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            socketInstance.disconnect();
            term.dispose();
            window.removeEventListener('resize', handleResize);
        };
    }, [containerId, containerName]);

    return (
        <div className="modal-overlay">
            <div className="modal-card" style={{ maxWidth: '900px', width: '95%', height: '80vh', display: 'flex', flexDirection: 'column', background: '#0f172a', border: '1px solid #1e293b' }}>
                <div className="modal-header" style={{ borderBottom: '1px solid #1e293b', background: '#020617' }}>
                    <div className="modal-title" style={{ fontFamily: 'monospace' }}>
                        {">_"} {containerName}
                    </div>
                    <button onClick={onClose} className="modal-close">
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-body" style={{ flex: 1, padding: 0, overflow: 'hidden', position: 'relative' }}>
                    <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
                </div>
            </div>
        </div>
    );
}
