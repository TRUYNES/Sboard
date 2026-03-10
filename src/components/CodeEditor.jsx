import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import { Copy, Check } from 'lucide-react';
import 'prismjs/components/prism-yaml';

export default function CodeEditor({ value, onChange, language = 'yaml', readOnly = false, placeholder = '', autoHeight = false }) {
    const highlight = (code) => {
        try {
            return Prism.highlight(code, Prism.languages[language] || Prism.languages.plaintext, language);
        } catch {
            return code;
        }
    };

    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    const lineCount = value.split('\n').length;
    const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

    return (
        <div style={{
            display: 'flex',
            flex: 1,
            width: '100%',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            height: autoHeight ? 'auto' : '100%',
            minHeight: autoHeight ? '300px' : 'auto',
            position: 'relative'
        }}>
            <button
                onClick={handleCopy}
                title="Copy content"
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 10,
                    padding: '6px',
                    background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                    border: copied ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '6px',
                    color: copied ? '#34d399' : '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(4px)'
                }}
            >
                {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {/* Line Numbers */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.9)',
                padding: '24px 16px',
                color: '#64748b',
                fontFamily: "'Fira Code', 'Consolas', monospace",
                fontSize: '13px',
                lineHeight: '1.6',
                textAlign: 'right',
                userSelect: 'none',
                borderRight: '1px solid rgba(148, 163, 184, 0.1)',
                minWidth: '50px',
                overflow: 'hidden'
            }}>
                {lineNumbers.map(num => (
                    <div key={num}>{num}</div>
                ))}
            </div>

            {/* Code Editor */}
            <div style={{ flex: 1, overflow: autoHeight ? 'visible' : 'auto', position: 'relative' }}>
                <Editor
                    value={value}
                    onValueChange={onChange}
                    highlight={highlight}
                    disabled={readOnly}
                    placeholder={placeholder}
                    padding={24}
                    style={{
                        fontFamily: "'Fira Code', 'Consolas', monospace",
                        fontSize: '13px',
                        lineHeight: '1.6',
                        color: '#e2e8f0',
                        background: 'transparent',
                        outline: 'none',
                        minHeight: '100%',
                        width: '100%',
                        whiteSpace: 'pre',
                        tabSize: 2,
                        WebkitTabSize: 2,
                        MozTabSize: 2
                    }}
                    textareaClassName="code-editor-textarea"
                />
            </div>
        </div>
    );
}
