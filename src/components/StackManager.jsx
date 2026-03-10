
import React, { useState, useEffect, useRef } from 'react';
import {
    Save, Play, Square, Plus, Trash2, FileText, Loader2, X, Terminal, Github, Box, RefreshCw,
    GitBranch, Layers, Check, AlertCircle, Settings, Network, Menu, RotateCw, AlertTriangle,
    HardDrive, Image, Edit2, ChevronUp, ChevronDown, XCircle, Search, ChevronRight, CheckCircle,
    Info, Cpu, Copy
} from 'lucide-react';
import { io } from 'socket.io-client';
import yaml from 'js-yaml';
import CodeEditor from './CodeEditor';
import './CodeEditorStyles.css';

export default function StackManager({ onClose }) {
    const [stacks, setStacks] = useState([]);
    const [selectedStack, setSelectedStack] = useState(null);
    const [editorContent, setEditorContent] = useState('');
    const [envContent, setEnvContent] = useState('');
    const [activeView, setActiveView] = useState('stacks'); // 'stacks', 'volumes', 'images'
    const [activeTab, setActiveTab] = useState('yaml'); // 'yaml', 'env', 'volumes', 'images', 'logs'
    const [newStackName, setNewStackName] = useState('');
    const [gitRepoUrl, setGitRepoUrl] = useState('');
    const [parsedContainers, setParsedContainers] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isImportingGit, setIsImportingGit] = useState(false);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // New state for resources
    const [, setVolumes] = useState([]);
    const [, setImages] = useState([]);
    const [containers, setContainers] = useState([]);
    const [globalVolumes, setGlobalVolumes] = useState([]);
    const [globalImages, setGlobalImages] = useState([]);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [refreshingVol, setRefreshingVol] = useState(false);
    const [refreshingImg, setRefreshingImg] = useState(false);

    // Custom Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        action: null, // 'delete', 'stop', 'restart', 'update'
        confirmText: 'Confirm',
        confirmColor: '#6366f1' // default indigo
    });

    // Terminal/Operation Logs State
    const [, setSocket] = useState(null);
    const [terminalLogs, setTerminalLogs] = useState([]);
    const logsEndRef = useRef(null);

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [terminalLogs]);

    useEffect(() => {
        const newSocket = io();
        setSocket(newSocket);

        newSocket.on('docker:output', (data) => {
            // Only show logs for current stack or globally if we want
            // For now, show all since user is single
            if (!selectedStack || data.stack === selectedStack?.name) {
                setTerminalLogs(prev => [...prev, data]);
            }
        });

        return () => newSocket.close();
    }, [selectedStack]);

    // Lock body scroll when StackManager is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    useEffect(() => {
        fetchStacks();
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!editorContent) {
            setParsedContainers([]);
            return;
        }
        try {
            const doc = yaml.load(editorContent);
            if (doc && doc.services) {
                setParsedContainers(Object.keys(doc.services).map(key => ({
                    name: key,
                    image: doc.services[key].image || 'unknown'
                })));
            } else {
                setParsedContainers([]);
            }
        } catch {
            // Invalid YAML
        }
    }, [editorContent]);

    // Auto-fill stack name from YAML container_name
    useEffect(() => {
        if (isCreating && !isImportingGit && editorContent) {
            const match = editorContent.match(/container_name:\s*([^\s"#]+)/);
            if (match && match[1]) {
                setNewStackName(match[1]);
            }
        }
    }, [editorContent, isCreating, isImportingGit]);

    // Clear editor content when switching to GitHub mode
    useEffect(() => {
        if (isCreating && isImportingGit) {
            setEditorContent('');
            setGitRepoUrl('');
        }
    }, [isImportingGit, isCreating]);

    const fetchStacks = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/stacks');
            if (!res.ok) throw new Error('Failed to fetch stacks');
            const data = await res.json();
            setStacks(data);
        } catch (err) {
            console.error(err);
            setErrorMsg('Failed to load stacks');
        } finally {
            setLoading(false);
        }
    };

    const fetchStackEnv = async (stackName) => {
        try {
            const res = await fetch(`/ api / stacks / ${stackName}/env`);
            if (res.ok) {
                const data = await res.json();
                setEnvContent(data.content || '');
            }
        } catch (err) {
            console.error('Failed to fetch env:', err);
        }
    };

    const handleSelectStack = (stack) => {
        setSelectedStack(stack);
        setEditorContent(stack.content);
        setEnvContent(''); // Clear first
        fetchStackEnv(stack.name);
        setIsCreating(false);
        setIsImportingGit(false);
        setActiveTab('yaml');
        setStatusMsg('');
        setErrorMsg('');
        setIsRenaming(false);
        // Fetch resources for this stack
        fetchStackResources(stack.name);
    };

    const fetchStackResources = async (stackName) => {
        try {
            const timestamp = Date.now();
            // Fetch volumes
            const volRes = await fetch(`/api/stacks/${stackName}/volumes?t=${timestamp}`);
            if (volRes.ok) {
                const volData = await volRes.json();
                setVolumes(volData);
            }

            // Fetch images
            const imgRes = await fetch(`/api/stacks/${stackName}/images?t=${timestamp}`);
            if (imgRes.ok) {
                const imgData = await imgRes.json();
                setImages(imgData);
            }

            // Fetch containers
            const contRes = await fetch(`/api/stacks/${stackName}/containers?t=${timestamp}`);
            if (contRes.ok) {
                const contData = await contRes.json();
                console.log('Fetched containers:', contData); // Debug log
                setContainers(contData);
            }
        } catch (err) {
            console.error('Failed to fetch stack resources:', err);
        }
    };

    // Auto-refresh resources when tab changes
    useEffect(() => {
        if (selectedStack && ['logs', 'volumes', 'images'].includes(activeTab)) {
            fetchStackResources(selectedStack.name);

            // Polling for real-time updates (every 3 seconds)
            const interval = setInterval(() => {
                fetchStackResources(selectedStack.name);
            }, 3000);

            return () => clearInterval(interval);
        }
    }, [activeTab, selectedStack]); // Added selectedContainer back to satisfy React Hooks

    // Fetch Global Resources when activeView changes
    useEffect(() => {
        if (activeView === 'volumes') fetchGlobalVolumes();
        if (activeView === 'images') fetchGlobalImages();
    }, [activeView]);

    const fetchGlobalVolumes = async () => {
        try {
            const res = await fetch('/api/docker/volumes');
            if (res.ok) setGlobalVolumes(await res.json());
        } catch (e) {
            console.error('Failed to fetch global volumes', e);
        }
    };

    const fetchGlobalImages = async () => {
        try {
            const res = await fetch('/api/docker/images');
            if (res.ok) setGlobalImages(await res.json());
        } catch (e) {
            console.error('Failed to fetch global images', e);
        }
    };

    // Request handlers for volume and image deletion
    const requestDeleteVolume = (name) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Volume',
            message: `Delete volume "${name}"?\n\nThis action cannot be undone.`,
            action: 'deleteVolume',
            confirmText: 'Delete Volume',
            confirmColor: '#ef4444', // red
            data: { volumeName: name }
        });
    };

    const requestDeleteImage = (id, repoTag) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Image',
            message: `Delete image "${repoTag || 'untagged'}"?\n\nThis action cannot be undone.`,
            action: 'deleteImage',
            confirmText: 'Delete Image',
            confirmColor: '#ef4444', // red
            data: { imageId: id }
        });
    };

    const handleDeleteVolume = async (name) => {
        try {
            const res = await fetch(`/api/docker/volumes/${name}`, { method: 'DELETE' });
            if (res.ok) {
                setStatusMsg(`Volume ${name} deleted.`);
                fetchGlobalVolumes();
                setTimeout(() => setStatusMsg(''), 3000);
            } else {
                const data = await res.json();
                throw new Error(data.error);
            }
        } catch (err) {
            setErrorMsg(err.message);
            setTimeout(() => setErrorMsg(''), 5000);
        }
    };
    const handleDeleteImage = async (id) => {
        try {
            const res = await fetch(`/api/docker/images/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setStatusMsg('Image deleted successfully.');
                fetchGlobalImages();
                setTimeout(() => setStatusMsg(''), 3000);
            } else {
                const data = await res.json();
                // Better error handling for common cases
                let errorMessage = data.error;
                if (res.status === 409) {
                    // Image is in use by a container
                    errorMessage = 'Cannot delete image: It is currently in use by a running container. Stop the container first.';
                }
                throw new Error(errorMessage);
            }
        } catch (err) {
            setErrorMsg(err.message);
            setTimeout(() => setErrorMsg(''), 5000);
        }
    };

    const handleStartRename = () => {
        setIsRenaming(true);
        setRenameValue(selectedStack.name.replace('.yaml', '').replace('.yml', ''));
    };

    const handleCancelRename = () => {
        setIsRenaming(false);
        setRenameValue('');
    };

    const handleConfirmRename = async () => {
        if (!renameValue || renameValue === selectedStack.name) {
            setIsRenaming(false);
            return;
        }

        try {
            setActionLoading(true);
            const res = await fetch(`/api/stacks/${selectedStack.name}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName: renameValue })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Rename failed');
            }

            setStatusMsg('Stack renamed successfully');
            setIsRenaming(false);
            await fetchStacks();

            // Select the renamed stack
            const stacksRes = await fetch('/api/stacks');
            const stacksData = await stacksRes.json();
            const renamed = stacksData.find(s => s.name === renameValue || s.name === renameValue + '.yaml');
            if (renamed) {
                handleSelectStack(renamed);
            } else {
                setSelectedStack(null);
            }
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateNew = () => {
        setSelectedStack(null);
        setEditorContent('version: "3.8"\nservices:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n');
        setNewStackName('');
        setIsCreating(true);
        setIsImportingGit(false);
        setStatusMsg('');
        setErrorMsg('');
    };

    // Removed handleImportGit function as per instruction

    const handleClone = async () => {
        if (!gitRepoUrl) return setErrorMsg('Repository URL is required');
        try {
            setActionLoading(true);
            setStatusMsg('Cloning repository...');

            const res = await fetch('/api/git/clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl: gitRepoUrl, stackName: newStackName })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Clone failed');

            setStatusMsg('Repository cloned successfully! Loading compose file...');

            // Refresh stacks and select the new one
            await fetchStacks();
            const stacksRes = await fetch('/api/stacks');
            const stacksData = await stacksRes.json();

            const newStack = stacksData.find(s => s.name === data.name);
            if (newStack) {
                // Load the compose file content
                const composeRes = await fetch(`/api/stacks/${data.name}`);
                if (composeRes.ok) {
                    const composeData = await composeRes.json();
                    setEditorContent(composeData.content || '');

                    // Load .env if it exists
                    const envRes = await fetch(`/api/stacks/${data.name}/env`);
                    if (envRes.ok) {
                        const envData = await envRes.json();
                        setEnvContent(envData.content || '');
                    }
                }

                // Switch to the cloned stack
                handleSelectStack(newStack);
                setIsCreating(false);
                setIsImportingGit(false);
                setStatusMsg('Repository cloned! Ready to deploy.');
            }

        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setActionLoading(false);
        }
    };


    // --- Action Handlers Wrapper ---

    // Instead of executing directly, these open the modal
    const requestDelete = () => {
        if (!selectedStack) return;
        setConfirmModal({
            isOpen: true,
            title: 'Delete Stack',
            message: `Are you sure you want to delete stack "${selectedStack.name}"?\nThis action cannot be undone.`,
            action: 'delete',
            confirmText: 'Delete',
            confirmColor: '#ef4444' // red
        });
    };

    const requestStop = () => {
        if (!selectedStack) return;
        setConfirmModal({
            isOpen: true,
            title: 'Stop Stack',
            message: 'Stop this stack? All services will go down.',
            action: 'stop',
            confirmText: 'Stop',
            confirmColor: '#f97316' // orange/red
        });
    };

    const requestRestart = () => {
        if (!selectedStack) return;
        setConfirmModal({
            isOpen: true,
            title: 'Restart Stack',
            message: 'Restart this stack?',
            action: 'restart',
            confirmText: 'Restart',
            confirmColor: '#eab308' // yellow
        });
    };

    // Note: Update usually doesn't need strict confirmation but we can add if desired.
    // User asked for "restart stop veya silme" generally. Update is usually safe but let's be consistent.
    // Actually user said "restart stop veya silme", leaving update as direct action unless risky.
    // Let's execute Update directly to be quick, but if user wants it we can add later.
    // Wait, user said "browser undefined alert appears", so we must assume any alert(...) needs replacement.
    // Update didn't have a confirm() in previous code, so it's fine.
    const requestUpdate = () => {
        if (!selectedStack) return;
        executeAction('update');
    };

    // Helper to start operation logs
    const startOperation = (msg) => {
        setTerminalLogs(prev => [...prev, { type: 'info', data: `\n--- ${msg} ---\n` }]);
        setActionLoading(true);
    };

    // --- Actual Execution Logic ---

    const executeAction = async (actionType, directData = null) => {
        setConfirmModal(prev => ({ ...prev, isOpen: false })); // Close modal

        // Allow deleteImage, deleteVolume, and stopContainer without a selected stack
        if (!selectedStack && !['deploy', 'deleteImage', 'deleteVolume', 'stopContainer'].includes(actionType)) return;

        try {
            setActionLoading(true);

            if (actionType === 'delete') {
                startOperation('DELETE STARTED');
                setStatusMsg('Deleting stack...');
                const res = await fetch(`/api/stacks/${selectedStack.name}`, { method: 'DELETE' });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Delete failed');
                }
                setStatusMsg('Stack deleted successfully');
                setSelectedStack(null);
                setEditorContent('');
                await fetchStacks();
            }
            else if (actionType === 'stop') {
                startOperation('STOPPING STACK');
                setStatusMsg('Stopping stack...');
                const res = await fetch('/api/stop', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: selectedStack.name })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Stop failed');
                setStatusMsg('Stopped successfully.');
                await fetchStackResources(selectedStack.name);
            }
            else if (actionType === 'restart') {
                startOperation('RESTARTING STACK');
                setStatusMsg('Restarting stack...');
                const res = await fetch('/api/restart', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: selectedStack.name })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Restart failed');
                setStatusMsg('Restarted successfully.');
                await fetchStackResources(selectedStack.name);
            }
            else if (actionType === 'update') {
                startOperation('UPDATING STACK');
                setStatusMsg('Updating (Pulling)...');
                const res = await fetch('/api/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: selectedStack.name })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Update failed');
                setStatusMsg('Stack Updated & Deployed!');
                await fetchStackResources(selectedStack.name);
            }
            else if (actionType === 'deleteVolume') {
                const volumeName = directData?.volumeName || confirmModal.data?.volumeName;
                if (!volumeName) throw new Error('Volume name not provided');
                await handleDeleteVolume(volumeName);
            }
            else if (actionType === 'deleteImage') {
                const imageId = directData?.imageId || confirmModal.data?.imageId;
                if (!imageId) throw new Error('Image ID not provided');
                await handleDeleteImage(imageId);
            }
            else if (actionType === 'stopContainer') {
                const containerId = directData?.containerId || confirmModal.data?.containerId;
                if (!containerId) throw new Error('Container ID not provided');
                const res = await fetch(`/api/containers/${containerId}/stop`, { method: 'POST' });
                const data = await res.json();
                if (!res.ok && !data.success) throw new Error(data.error || data.message || 'Failed to stop container');

                setStatusMsg(data.message || 'Container stopped');
                // Refresh containers if we have a selected stack
                if (selectedStack) {
                    await fetchStackResources(selectedStack.name);
                }
            }
            else if (actionType === 'startContainer') {
                const containerId = directData?.containerId || confirmModal.data?.containerId;
                if (!containerId) throw new Error('Container ID not provided');
                const res = await fetch(`/api/containers/${containerId}/start`, { method: 'POST' });
                const data = await res.json();
                if (!res.ok && !data.success) throw new Error(data.error || data.message || 'Failed to start container');

                setStatusMsg(data.message || 'Container started');
                if (selectedStack) {
                    await fetchStackResources(selectedStack.name);
                }
            }

        } catch (err) {
            setErrorMsg(actionType + ' failed: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSave = async () => {
        const name = isCreating ? newStackName : selectedStack?.name;
        if (isCreating && !newStackName) return setErrorMsg('Stack name is required');
        if (activeTab === 'yaml' && !editorContent && !isImportingGit) return setErrorMsg('Content is required');

        try {
            setActionLoading(true);

            if (activeTab === 'env') {
                // Save .env file
                const res = await fetch(`/api/stacks/${name}/env`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: envContent })
                });
                if (!res.ok) throw new Error('Failed to save .env');
                setStatusMsg('.env saved!');
            } else if (isImportingGit) {
                // Git Clone
                const res = await fetch('/api/git/clone', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        repoUrl: gitRepoUrl,
                        stackName: name
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to clone repo');
                }
                const data = await res.json();
                setStatusMsg('Repository cloned successfully!');

                // If the clone determined a new name, use it
                if (data.name && data.name !== name) {
                    // Update selection logic below
                }
            } else {
                // Save YAML
                const res = await fetch('/api/stacks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        content: editorContent,
                        type: 'git'
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to save');
                }
                setStatusMsg('Stack saved!');
            }

            setTimeout(() => setStatusMsg(''), 3000);
            await fetchStacks();
            if (isCreating) {
                // Locate and select
                const stacksRes = await fetch('/api/stacks');
                const stacksData = await stacksRes.json();
                const created = stacksData.find(s => s.name === name);
                if (created) handleSelectStack(created);
            }
            setIsCreating(false);
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeploy = async () => {
        if (!selectedStack && !newStackName) return;
        try {
            startOperation('DEPLOYING STACK');
            setActionLoading(true);
            setStatusMsg('Deploying stack...');
            const res = await fetch('/api/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: selectedStack ? selectedStack.name : newStackName })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Deploy failed');

            setStatusMsg('Deployed successfully!');
            await fetchStackResources(selectedStack ? selectedStack.name : newStackName);
        } catch (err) {
            setErrorMsg('Deploy failed: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };


    return (
        <div
            className="modal-overlay"
            style={{
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // Ensure high z-index
                zIndex: 3000
            }}
        >
            <div
                style={{
                    width: isMobile ? '100%' : '90vw',
                    maxWidth: isMobile ? '100%' : '1400px',
                    height: isMobile ? '100%' : '85vh',
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: isMobile ? 'none' : '1px solid rgba(148, 163, 184, 0.1)',
                    boxShadow: isMobile ? 'none' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    borderRadius: isMobile ? '0' : '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative'
                }}
            >
                {/* Custom Confirmation Modal */}
                {confirmModal.isOpen && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            background: '#1e293b',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '400px',
                            maxWidth: '90%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{
                                    padding: '10px',
                                    borderRadius: '10px',
                                    background: `${confirmModal.confirmColor}20`,
                                    color: confirmModal.confirmColor
                                }}>
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'white' }}>
                                    {confirmModal.title}
                                </h3>
                            </div>

                            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', marginBottom: '24px' }}>
                                {confirmModal.message}
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        background: 'transparent',
                                        border: '1px solid rgba(148, 163, 184, 0.2)',
                                        color: '#cbd5e1',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => executeAction(confirmModal.action)}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        background: confirmModal.confirmColor,
                                        border: 'none',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500',
                                        boxShadow: `0 4px 12px ${confirmModal.confirmColor}40`
                                    }}
                                >
                                    {confirmModal.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                )}


                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: isMobile ? '16px' : '24px 32px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        backdropFilter: 'blur(12px)',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        flexShrink: 0
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            padding: '12px',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                            borderRadius: '12px',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Layers size={24} style={{ color: '#a5b4fc' }} />
                        </div>
                        <div>
                            <h1 style={{
                                fontSize: isMobile ? '18px' : '24px',
                                fontWeight: 'bold',
                                color: 'white',
                                margin: 0,
                                lineHeight: 1.2
                            }}>
                                Stack Manager
                            </h1>
                            {!isMobile && (
                                <p style={{
                                    fontSize: '14px',
                                    color: '#94a3b8',
                                    margin: '4px 0 0 0'
                                }}>
                                    Manage your Docker Compose stacks
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="action-btn"
                        style={{
                            background: 'rgba(71, 85, 105, 0.3)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            padding: '10px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#cbd5e1'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Global Notification Area - Visible only when not in specific stack view (to avoid duplicates) */}
                {(statusMsg || errorMsg) && !(activeView === 'stacks' && (selectedStack || isCreating)) && (
                    <div style={{
                        padding: '12px 24px',
                        background: statusMsg ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        borderBottom: '1px solid ' + (statusMsg ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexShrink: 0
                    }}>
                        {statusMsg ? <Check size={16} style={{ color: '#34d399' }} /> : <AlertCircle size={16} style={{ color: '#f87171' }} />}
                        <span style={{ fontSize: '13px', color: statusMsg ? '#34d399' : '#f87171', flex: 1 }}>{statusMsg || errorMsg}</span>
                        <button
                            onClick={() => { setStatusMsg(''); setErrorMsg(''); }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: statusMsg ? '#34d399' : '#f87171',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Body */}
                <div style={{
                    display: 'flex',
                    flex: 1,
                    overflow: 'hidden',
                    flexDirection: isMobile ? 'column' : 'row'
                }}>

                    {/* Sidebar */}
                    <div
                        style={{
                            width: isMobile ? '100%' : '280px',
                            height: isMobile ? 'auto' : 'auto',
                            flexShrink: 0,
                            background: 'rgba(15, 23, 42, 0.4)',
                            backdropFilter: 'blur(16px)',
                            borderRight: isMobile ? 'none' : '1px solid rgba(148, 163, 184, 0.1)',
                            borderBottom: isMobile ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: isMobile ? 'visible' : 'auto'
                        }}
                    >
                        {/* Navigation Tabs */}
                        <div style={{ padding: '16px', display: 'flex', gap: '4px', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                            <button onClick={() => {
                                if (activeView === 'stacks') {
                                    // Reset view if already on stacks
                                    setSelectedStack(null);
                                    setIsCreating(false);
                                } else {
                                    setActiveView('stacks');
                                }
                            }} style={{ flex: 1, padding: '8px 4px', background: activeView === 'stacks' ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeView === 'stacks' ? '#c7d2fe' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><Layers size={14} /> Stacks</button>
                            <button onClick={() => setActiveView('volumes')} style={{ flex: 1, padding: '8px 4px', background: activeView === 'volumes' ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeView === 'volumes' ? '#c7d2fe' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><HardDrive size={14} /> Volumes</button>
                            <button onClick={() => setActiveView('images')} style={{ flex: 1, padding: '8px 4px', background: activeView === 'images' ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeView === 'images' ? '#c7d2fe' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}><Image size={14} /> Images</button>
                        </div>

                        {activeView === 'stacks' && (
                            <>
                                {/* Compact Header with Buttons and Label */}
                                <div style={{
                                    padding: '20px 16px 12px 16px',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}>
                                    {/* Buttons Row */}
                                    <div style={{ display: 'flex' }}>
                                        <button
                                            onClick={handleCreateNew}
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                padding: '12px',
                                                borderRadius: '12px',
                                                fontWeight: '600',
                                                color: 'white',
                                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Plus size={18} />
                                            <span>New Stack</span>
                                        </button>
                                    </div>

                                    {/* Your Stacks Label */}
                                    <div style={{
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        paddingLeft: '4px'
                                    }}>
                                        Your Stacks
                                    </div>
                                </div>

                                {/* Stacks List - Limited Height with Scroll */}
                                <div style={{
                                    padding: '12px 16px',
                                    overflow: 'auto',
                                    maxHeight: '240px',
                                    flexShrink: 0
                                }}>
                                    {loading && stacks.length === 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                                            <Loader2 className="animate-spin" style={{ color: '#64748b' }} size={24} />
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {stacks.map(stack => (
                                            <div
                                                key={stack.name}
                                                onClick={() => handleSelectStack(stack)}
                                                style={{
                                                    padding: '12px 16px',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    background: selectedStack?.name === stack.name
                                                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))'
                                                        : 'rgba(30, 41, 59, 0.3)',
                                                    backdropFilter: 'blur(8px)',
                                                    border: selectedStack?.name === stack.name
                                                        ? '1px solid rgba(99, 102, 241, 0.4)'
                                                        : '1px solid rgba(148, 163, 184, 0.1)',
                                                    color: selectedStack?.name === stack.name ? '#c7d2fe' : '#cbd5e1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }}
                                            >
                                                {stack.type === 'git' || !stack.name.includes('.') ? (
                                                    <GitBranch size={16} style={{ color: '#a78bfa', flexShrink: 0 }} />
                                                ) : (
                                                    <FileText size={16} style={{ flexShrink: 0 }} />
                                                )}
                                                <span style={{
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {stack.name.replace('.yaml', '').replace('.yml', '')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>


                    {/* Main Content */}
                    {(activeView === 'stacks' && (selectedStack || isCreating)) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', background: 'rgba(15, 23, 42, 0.3)' }}>

                            {/* Creation Tabs */}
                            {isCreating && (
                                <div style={{ padding: '24px 24px 0 24px' }}>
                                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '4px', borderRadius: '10px', display: 'flex', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                        <button
                                            onClick={() => setIsImportingGit(false)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                borderRadius: '8px',
                                                background: !isImportingGit ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                                color: !isImportingGit ? '#c7d2fe' : '#94a3b8',
                                                fontWeight: '600',
                                                fontSize: '13px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <FileText size={14} />
                                            Docker Compose
                                        </button>
                                        <button
                                            onClick={() => setIsImportingGit(true)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                borderRadius: '8px',
                                                background: isImportingGit ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                                color: isImportingGit ? '#c7d2fe' : '#94a3b8',
                                                fontWeight: '600',
                                                fontSize: '13px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Github size={14} />
                                            GitHub Repository
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1', minWidth: '200px' }}>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Stack Name</label>
                                    {isCreating ? (
                                        <input type="text" value={newStackName} onChange={e => setNewStackName(e.target.value)} placeholder="my-awesome-stack" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', color: 'white', fontSize: '16px', fontWeight: '600', outline: 'none', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.2)' }} />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {isRenaming ? (
                                                <>
                                                    <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', color: 'white', fontSize: '18px', fontWeight: '700', outline: 'none', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(99, 102, 241, 0.4)' }} onKeyPress={e => e.key === 'Enter' && handleConfirmRename()} />
                                                    <button onClick={handleConfirmRename} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', cursor: 'pointer' }}><Check size={16} /></button>
                                                    <button onClick={handleCancelRename} style={{ padding: '8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', cursor: 'pointer' }}><X size={16} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'white' }}>{selectedStack.name.replace('.yaml', '').replace('.yml', '')}</div>
                                                    <button onClick={handleStartRename} style={{ padding: '6px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', cursor: 'pointer' }} title="Rename Stack"><Edit2 size={14} /></button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {!isImportingGit && (
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <button onClick={handleDeploy} disabled={actionLoading} style={{ padding: '10px 18px', borderRadius: '10px', fontWeight: '600', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><Play size={16} fill="currentColor" /> Deploy Stack</button>
                                        <button onClick={requestUpdate} disabled={actionLoading} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: '500', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={16} /> Update</button>
                                        <button onClick={requestRestart} disabled={actionLoading} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: '500', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><RotateCw size={16} /> Restart</button>
                                        <button onClick={requestStop} disabled={actionLoading} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: '500', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><Square size={16} /> Stop</button>
                                        <button onClick={handleSave} disabled={actionLoading} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: '500', background: 'rgba(71, 85, 105, 0.3)', border: '1px solid rgba(148, 163, 184, 0.2)', color: '#cbd5e1', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><Save size={16} /> Save</button>
                                        {!isCreating && <button onClick={requestDelete} disabled={actionLoading} style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', cursor: 'pointer' }} title="Delete Stack"><Trash2 size={16} /></button>}
                                    </div>
                                )}
                                {isImportingGit && (
                                    <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '600', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}><Github size={12} /> Repository URL</label>
                                            <input type="text" value={gitRepoUrl} onChange={e => setGitRepoUrl(e.target.value)} placeholder="https://github.com/username/repo" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(99, 102, 241, 0.3)' }} />
                                        </div>
                                        <button onClick={handleClone} disabled={actionLoading} style={{ padding: '10px 16px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', cursor: 'pointer' }}>{actionLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}</button>
                                    </div>
                                )}
                            </div>
                            {(statusMsg || errorMsg) && (
                                <div style={{ padding: '12px 24px', background: statusMsg ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid ' + (statusMsg ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'), display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {statusMsg ? <Check size={16} style={{ color: '#34d399' }} /> : <AlertCircle size={16} style={{ color: '#f87171' }} />}
                                    <span style={{ fontSize: '13px', color: statusMsg ? '#34d399' : '#f87171' }}>{statusMsg || errorMsg}</span>
                                </div>
                            )}

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'visible' }}>

                                {(actionLoading || terminalLogs.length > 0) && (
                                    <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Terminal size={16} color="#38bdf8" />
                                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>Operation Logs</span>
                                                {actionLoading && <Loader2 size={14} className="animate-spin" color="#94a3b8" />}
                                            </div>
                                            {terminalLogs.length > 0 && <button onClick={() => setTerminalLogs([])} style={{ fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>}
                                        </div>
                                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '10px', padding: '16px', minHeight: '120px', maxHeight: '250px', overflowY: 'auto', fontFamily: "'Fira Code', monospace", fontSize: '12px', lineHeight: '1.6', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                                            {terminalLogs.length === 0 ? <span style={{ color: '#64748b', fontStyle: 'italic' }}>Waiting for operations...</span> : terminalLogs.map((log, i) => (
                                                <div key={i} style={{ color: log.type === 'stderr' ? '#fca5a5' : log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#34d399' : '#e2e8f0', opacity: log.type === 'info' ? 0.7 : 1, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{log.data}</div>
                                            ))}
                                            <div ref={logsEndRef} />
                                        </div>
                                    </div>
                                )}

                                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', flexShrink: 0 }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Box size={16} /> Konteynerler</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                        {parsedContainers.length === 0 ? (
                                            <p style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>No containers defined</p>
                                        ) : (
                                            parsedContainers.map((container, idx) => {
                                                // Find actual runtime container to get status
                                                // We try to match by name pattern since docker-compose adds prefixes/suffixes
                                                const runtimeContainer = containers.find(c =>
                                                    c.Labels && c.Labels['com.docker.compose.service'] === container.name
                                                ) || containers.find(c => c.Names[0].includes(container.name));

                                                const isRunning = runtimeContainer && (runtimeContainer.State || '').toLowerCase() === 'running';

                                                return (
                                                    <div key={idx} style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isRunning ? '#10b981' : '#64748b', boxShadow: isRunning ? '0 0 10px rgba(16, 185, 129, 0.6)' : 'none', flexShrink: 0 }} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>{container.name}</div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{container.image}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                if (isRunning) {
                                                                    // Direct execute Stop (no modal as requested)
                                                                    executeAction('stopContainer', { containerId: runtimeContainer?.Id || container.name });
                                                                } else {
                                                                    // Direct execute Start (no modal as requested)
                                                                    executeAction('startContainer', { containerId: runtimeContainer?.Id });
                                                                }
                                                            }}
                                                            disabled={!runtimeContainer} // Disable if we can't find the container
                                                            title={isRunning ? "Stop Container" : "Start Container"}
                                                            style={{
                                                                padding: '6px',
                                                                borderRadius: '6px',
                                                                background: isRunning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                                border: 'none',
                                                                cursor: runtimeContainer ? 'pointer' : 'not-allowed',
                                                                color: isRunning ? '#fca5a5' : '#34d399',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                opacity: runtimeContainer ? 1 : 0.5
                                                            }}
                                                        >
                                                            {isRunning ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '600px' }}>
                                    <div style={{ display: 'flex', gap: '8px', padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', overflow: 'auto' }}>
                                        <button onClick={() => setActiveTab('yaml')} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === 'yaml' ? 'rgba(99, 102, 241, 0.2)' : 'transparent', border: activeTab === 'yaml' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent', color: activeTab === 'yaml' ? '#c7d2fe' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><FileText size={14} /> compose.yaml</button>
                                        <button onClick={() => setActiveTab('env')} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === 'env' ? 'rgba(99, 102, 241, 0.2)' : 'transparent', border: activeTab === 'env' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent', color: activeTab === 'env' ? '#c7d2fe' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><Settings size={14} /> .env</button>
                                        <button onClick={() => setActiveTab('logs')} style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === 'logs' ? 'rgba(99, 102, 241, 0.2)' : 'transparent', border: activeTab === 'logs' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent', color: activeTab === 'logs' ? '#c7d2fe' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}><Terminal size={14} /> Container Logs</button>
                                    </div>
                                    <div style={{ flex: 1, overflow: activeTab === 'logs' ? 'auto' : 'visible', display: 'flex' }}>
                                        {(activeTab === 'yaml' || activeTab === 'env') && (
                                            <CodeEditor
                                                value={activeTab === 'yaml' ? editorContent : envContent}
                                                onChange={activeTab === 'yaml' ? setEditorContent : setEnvContent}
                                                language={activeTab === 'yaml' ? 'yaml' : 'properties'}
                                                placeholder={activeTab === 'yaml' ? "# Enter your docker-compose.yaml content here..." : "# Define environment variables\n# KEY=value\n"}
                                                autoHeight={true}
                                            />
                                        )}
                                        {activeTab === 'logs' && (
                                            <LogsViewer containers={containers} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : activeView === 'volumes' ? (
                        <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: 'rgba(15, 23, 42, 0.4)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <h2 style={{ color: 'white', fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><HardDrive size={24} color="#a5b4fc" /> All Volumes ({globalVolumes.length})</h2>
                                <button
                                    onClick={async () => {
                                        setRefreshingVol(true);
                                        await fetchGlobalVolumes();
                                        await new Promise(r => setTimeout(r, 500));
                                        setRefreshingVol(false);
                                    }}
                                    style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', cursor: 'pointer' }}
                                    title="Refresh Volumes"
                                >
                                    <RefreshCw className={refreshingVol ? 'spin' : ''} size={16} style={{ transition: 'transform 0.5s' }} />
                                    <style>{`
                                        .spin { animation: spin 0.5s linear infinite; }
                                        @keyframes spin { 100% { transform: rotate(360deg); } }
                                    `}</style>
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                {globalVolumes.map(vol => (
                                    <div key={vol.Name} style={{ background: 'rgba(30,41,59,0.4)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(148,163,184,0.1)', position: 'relative' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px', wordBreak: 'break-all', paddingRight: '24px' }}>{vol.Name}</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Driver: {vol.Driver}</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>{vol.Mountpoint}</div>
                                        <button onClick={() => requestDeleteVolume(vol.Name)} style={{ position: 'absolute', top: '12px', right: '12px', padding: '6px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', color: '#fca5a5', cursor: 'pointer', transition: 'background 0.2s' }} title="Delete Volume"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : activeView === 'images' ? (
                        <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: 'rgba(15, 23, 42, 0.4)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <h2 style={{ color: 'white', fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Image size={24} color="#a5b4fc" /> All Images ({globalImages.length})</h2>
                                <button
                                    onClick={async () => {
                                        setRefreshingImg(true);
                                        await fetchGlobalImages();
                                        await new Promise(r => setTimeout(r, 500));
                                        setRefreshingImg(false);
                                    }}
                                    style={{ padding: '8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', cursor: 'pointer' }}
                                    title="Refresh Images"
                                >
                                    <RefreshCw className={refreshingImg ? 'spin' : ''} size={16} style={{ transition: 'transform 0.5s' }} />
                                    <style>{`
                                        .spin { animation: spin 0.5s linear infinite; }
                                        @keyframes spin { 100% { transform: rotate(360deg); } }
                                    `}</style>
                                </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                {globalImages.map(img => (
                                    <div key={img.Id} style={{ background: 'rgba(30,41,59,0.4)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(148,163,184,0.1)', position: 'relative' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px', wordBreak: 'break-all', paddingRight: '24px' }}>{img.RepoTags?.[0] || 'untagged'}</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>Size: {(img.Size / 1024 / 1024).toFixed(2)} MB</div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>{img.Id.substring(7, 19)}</div>
                                        <button onClick={() => requestDeleteImage(img.Id, img.RepoTags?.[0])} style={{ position: 'absolute', top: '12px', right: '12px', padding: '6px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', color: '#fca5a5', cursor: 'pointer', transition: 'background 0.2s' }} title="Delete Image"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(12px)', opacity: isMobile ? 0 : 1, pointerEvents: isMobile ? 'none' : 'auto' }}>
                            <div style={{ width: '120px', height: '120px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(148, 163, 184, 0.1)', marginBottom: '32px' }}><Layers size={48} style={{ color: '#475569' }} /></div>
                            <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: '#cbd5e1', marginBottom: '12px' }}>No Stack Selected</h3>
                            <p style={{ fontSize: '15px', color: '#64748b', textAlign: 'center', maxWidth: '400px', lineHeight: 1.6 }}>Choose an existing stack from the sidebar or create a new one to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// LogsViewer Component
function LogsViewer({ containers }) {
    const [selectedContainer, setSelectedContainer] = React.useState(null);
    const [logs, setLogs] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        if (!logs) return;
        try {
            await navigator.clipboard.writeText(logs);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy logs:', err);
        }
    };

    const fetchLogs = async (containerId) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/containers/${containerId}/logs?lines=200`);
            if (res.ok) {
                const text = await res.text();
                setLogs(text);
            } else {
                setLogs('Error fetching logs');
            }
        } catch (err) {
            setLogs('Failed to load logs: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (selectedContainer) {
            fetchLogs(selectedContainer.Id);
        }
    }, [selectedContainer]);

    // Handle container updates (e.g. restart causing new IDs)
    React.useEffect(() => {
        if (selectedContainer) {
            // Try to find the same container in the new list (by ID first, then Name)
            const sameId = containers.find(c => c.Id === selectedContainer.Id);
            if (!sameId) {
                const sameName = containers.find(c => c.Names[0] === selectedContainer.Names[0]);
                if (sameName) {
                    setSelectedContainer(sameName); // Auto-switch to new ID
                }
            } else {
                setSelectedContainer(sameId); // Update object reference
            }
        } else if (containers.length > 0) {
            // Auto-select first container if none selected
            setSelectedContainer(containers[0]);
        }
    }, [containers, selectedContainer]);

    if (containers.length === 0) {
        return (
            <div style={{ flex: 1, padding: '24px' }}>
                <p style={{ color: '#64748b', fontSize: '14px' }}>No containers found for this stack</p>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            {/* Container Selector */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {containers.map(cont => (
                        <button
                            key={cont.Id}
                            onClick={() => setSelectedContainer(cont)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                background: selectedContainer?.Id === cont.Id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.4)',
                                border: selectedContainer?.Id === cont.Id ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(148, 163, 184, 0.1)',
                                color: selectedContainer?.Id === cont.Id ? '#c7d2fe' : '#cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <div style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: cont.State === 'running' ? '#34d399' : '#64748b'
                            }} />
                            {cont.Names[0].replace('/', '')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Logs Display */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', background: 'rgba(15, 23, 42, 0.6)' }}>
                {!selectedContainer ? (
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Select a container to view logs</p>
                ) : loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        Loading logs...
                    </div>
                ) : (
                    <pre style={{
                        margin: 0,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: '12px',
                        lineHeight: '1.6',
                        color: '#cbd5e1',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                    }}>
                        {logs || 'No logs available'}
                    </pre>
                )}
            </div>

            {/* Refresh Button */}
            {selectedContainer && (
                <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleCopy}
                        disabled={!logs || logs === 'No logs available' || logs.startsWith('Error') || logs.startsWith('Failed')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: (!logs || logs === 'No logs available') ? 'not-allowed' : 'pointer',
                            background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                            border: copied ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                            color: copied ? '#34d399' : '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: (!logs || logs === 'No logs available') ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy Logs'}
                    </button>
                    <button
                        onClick={() => setLogs('')}
                        disabled={!logs || logs === 'No logs available'}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: (!logs || logs === 'No logs available') ? 'not-allowed' : 'pointer',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#fca5a5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: (!logs || logs === 'No logs available') ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        <Trash2 size={14} />
                        Clear Logs
                    </button>
                    <button
                        onClick={() => fetchLogs(selectedContainer.Id)}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#a5b4fc',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: loading ? 0.5 : 1
                        }}
                    >
                        <RefreshCw size={14} />
                        Refresh Logs
                    </button>
                </div>
            )}
        </div>
    );
}
