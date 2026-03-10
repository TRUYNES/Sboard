import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Docker from 'dockerode';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import si from 'systeminformation';
import { logSystemData, getHistoryData } from './services/historyLogger.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5858;

// Initialize Docker
// Use explicit path by default as auto-discovery can be flaky on macOS Docker Desktop
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock' });

// Verify connection
docker.ping().then(() => {
    console.log('Docker connection established successfully');
}).catch(err => {
    console.error('WARNING: Docker connection failed:', err.message);
    console.error('Make sure Docker Desktop is running.');
});

// Serve Static Files
app.use(express.static(path.join(__dirname, 'dist')));

// Helper: Get Icon
const getIconForContainer = (imageName) => {
    const lower = imageName.toLowerCase();
    if (lower.includes('plex')) return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/plex.png';
    if (lower.includes('pihole')) return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/pi-hole.png';
    if (lower.includes('homeassistant') || lower.includes('home-assistant')) return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/home-assistant.png';
    if (lower.includes('dockge')) return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/dockge.png';
    if (lower.includes('portainer')) return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/portainer.png';
    if (lower.includes('jellyfin')) return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/jellyfin.png';
    if (lower.includes('radarr')) return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/radarr.png';
    if (lower.includes('sonarr')) return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/sonarr.png';
    return 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/png/docker.png';
};

// Helper: Stream Command Output via Socket.IO
const streamCommand = (command, cwd, stackName) => {
    return new Promise((resolve, reject) => {
        io.emit('docker:output', { stack: stackName, type: 'info', data: `> ${command}\n` });

        const proc = spawn(command, { cwd, shell: true });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            const str = data.toString();
            stdout += str;
            io.emit('docker:output', { stack: stackName, type: 'stdout', data: str });
        });

        proc.stderr.on('data', (data) => {
            const str = data.toString();
            stderr += str;
            // docker compose uses stderr for progress bars, so strictly speaking it's not always error
            io.emit('docker:output', { stack: stackName, type: 'stderr', data: str });
        });

        proc.on('close', (code) => {
            if (code === 0) {
                io.emit('docker:output', { stack: stackName, type: 'success', data: `\n[Success] Exited with code 0\n` });
                resolve({ stdout, stderr });
            } else {
                io.emit('docker:output', { stack: stackName, type: 'error', data: `\n[Error] Exited with code ${code}\n` });
                // Resolve locally to allow API to return clean error JSON instead of crashing
                reject({ message: `Command failed with code ${code}`, stderr, stdout });
            }
        });

        proc.on('error', (err) => {
            io.emit('docker:output', { stack: stackName, type: 'error', data: `\n[Fatal] ${err.message}\n` });
            reject(err);
        });
    });
};

// --- STACK MANAGER API ---
const STACKS_DIR = path.join(__dirname, 'stacks');

// Ensure stacks dir exists
if (!fs.existsSync(STACKS_DIR)) {
    fs.mkdirSync(STACKS_DIR);
}

// 1. List Stacks (Supports both single files and folders)
app.get('/api/stacks', (req, res) => {
    try {
        const items = fs.readdirSync(STACKS_DIR);
        const stacks = [];

        for (const item of items) {
            if (item.startsWith('.')) continue; // skip hidden
            const fullPath = path.join(STACKS_DIR, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // Check for standard compose files
                const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
                const yamlName = possibleNames.find(n => fs.existsSync(path.join(fullPath, n)));

                if (yamlName) {
                    stacks.push({
                        name: item, // Use folder name as stack name
                        content: fs.readFileSync(path.join(fullPath, yamlName), 'utf8'),
                        path: path.join(item, yamlName),
                        type: 'git', // Treated as managed folder
                        filename: yamlName
                    });
                }
            } else if (item.endsWith('.yaml') || item.endsWith('.yml')) {
                stacks.push({
                    name: item,
                    content: fs.readFileSync(fullPath, 'utf8'),
                    path: item,
                    type: 'file',
                    filename: item
                });
            }
        }
        res.json(stacks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1.5. Get a specific stack's compose file content
app.get('/api/stacks/:name', (req, res) => {
    try {
        const { name } = req.params;
        const fullPath = path.join(STACKS_DIR, name);

        let content = '';
        let filename = '';

        // Check if it's a directory (Git clone or folder-based stack)
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
            const yamlName = possibleNames.find(n => fs.existsSync(path.join(fullPath, n)));

            if (yamlName) {
                content = fs.readFileSync(path.join(fullPath, yamlName), 'utf8');
                filename = yamlName;
            } else {
                return res.status(404).json({ error: 'Compose file not found in stack folder' });
            }
        } else if (fs.existsSync(fullPath)) {
            // It's a file
            content = fs.readFileSync(fullPath, 'utf8');
            filename = path.basename(fullPath);
        } else if (fs.existsSync(fullPath + '.yaml')) {
            // Try with .yaml extension
            content = fs.readFileSync(fullPath + '.yaml', 'utf8');
            filename = path.basename(fullPath + '.yaml');
        } else {
            return res.status(404).json({ error: 'Stack not found' });
        }

        res.json({
            name,
            content,
            filename
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Save Stack
app.post('/api/stacks', express.json(), (req, res) => {
    try {
        const { name, content, type } = req.body;
        if (!name || !content) return res.status(400).json({ error: 'Name and content required' });

        // If type is git/folder, valid name is the folder name
        // If type is file, name matches filename

        if (type === 'git' || !name.includes('.')) {
            // It's a folder-based stack (or new one we want to be folder-based)
            const folderPath = path.join(STACKS_DIR, name);
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath);
            }
            // Always save as docker-compose.yaml for consistency in folders
            fs.writeFileSync(path.join(folderPath, 'docker-compose.yaml'), content);
        } else {
            // Legacy/Simple file mode
            let filename = name;
            if (!filename.endsWith('.yaml') && !filename.endsWith('.yml')) filename += '.yaml';
            fs.writeFileSync(path.join(STACKS_DIR, filename), content);
        }

        res.json({ success: true, message: 'Stack saved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Deploy Stack (Compose Up)
app.post('/api/deploy', express.json(), async (req, res) => {
    try {
        const { name, path: stackPath } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });

        let targetFile;
        let projectDir;

        // Determine path logic
        const fullPath = path.join(STACKS_DIR, name);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            // It is a folder
            const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
            const yamlName = possibleNames.find(n => fs.existsSync(path.join(fullPath, n)));
            if (!yamlName) return res.status(404).json({ error: 'Compose file not found in folder' });

            targetFile = path.join(fullPath, yamlName);
            projectDir = fullPath;
        } else {
            // It is a file in root stacks dir
            // legacy handle or passed explicit path
            // logic simplification: check if name exists as file
            if (fs.existsSync(fullPath)) {
                targetFile = fullPath;
                projectDir = STACKS_DIR;
            } else {
                // Try adding extension
                if (fs.existsSync(fullPath + '.yaml')) {
                    targetFile = fullPath + '.yaml';
                    projectDir = STACKS_DIR;
                } else {
                    return res.status(404).json({ error: 'Stack not found' });
                }
            }
        }

        const projectName = name.replace(/\.(yaml|yml)$/, ''); // Clean name

        // Determine if we need to use Host Project Path (DooD Fix)
        let command;
        if (process.env.HOST_PROJECT_PATH) {
            // Calculate the path on the host system
            // Current structure: HOST_PATH/stacks/stackName
            let hostStackPath;

            // Check if it's a file or folder based stack relative to stacks dir
            if (path.dirname(targetFile).includes('stacks')) {
                // It's inside stacks dir
                const relativePath = path.relative(STACKS_DIR, projectDir);
                hostStackPath = path.join(process.env.HOST_PROJECT_PATH, 'stacks', relativePath);
            } else {
                // Fallback if somehow outside logs
                hostStackPath = projectDir;
            }

            command = `docker compose -f "${targetFile}" -p "${projectName}" --project-directory "${hostStackPath}" up -d`;
        } else {
            // Standard behavior
            command = `docker compose -f "${targetFile}" -p "${projectName}" up -d`;
        }

        console.log(`Executing: ${command} in ${projectDir} (Host Path: ${process.env.HOST_PROJECT_PATH || 'N/A'})`);

        // Use streaming helper
        const { stdout, stderr } = await streamCommand(command, projectDir, name);

        res.json({ success: true, stdout, stderr });

    } catch (err) {
        console.error('Deploy error:', err);
        res.status(500).json({ error: err.message, stderr: err.stderr });
    }
});

// 4. Stop Stack (Compose Down)
app.post('/api/stop', express.json(), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });

        const projectName = name.replace(/\.(yaml|yml)$/, '');

        // Determine path logic (Reused from Deploy for DooD fix)
        let targetFile;
        let projectDir;
        const fullPath = path.join(STACKS_DIR, name);

        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
            const yamlName = possibleNames.find(n => fs.existsSync(path.join(fullPath, n)));
            if (yamlName) {
                targetFile = path.join(fullPath, yamlName);
                projectDir = fullPath;
            }
        } else if (fs.existsSync(fullPath)) {
            targetFile = fullPath;
            projectDir = STACKS_DIR;
        } else if (fs.existsSync(fullPath + '.yaml')) {
            targetFile = fullPath + '.yaml';
            projectDir = STACKS_DIR;
        }

        // Determine if we need to use Host Project Path (DooD Fix)
        let command;
        if (targetFile && process.env.HOST_PROJECT_PATH) {
            let hostStackPath;
            if (path.dirname(targetFile).includes('stacks')) {
                const relativePath = path.relative(STACKS_DIR, projectDir);
                hostStackPath = path.join(process.env.HOST_PROJECT_PATH, 'stacks', relativePath);
            } else {
                hostStackPath = projectDir;
            }
            command = `docker compose -p "${projectName}" --project-directory "${hostStackPath}" down`;
        } else {
            command = `docker compose -p "${projectName}" down`;
        }

        console.log(`Executing: ${command}`);

        const { stdout, stderr } = await streamCommand(command, projectDir || STACKS_DIR, name);
        res.json({ success: true, stdout, stderr });

    } catch (err) {
        // Enhance graceful error handling for Stop
        // If it exited with code 1 but stderr contains "not found" or similar, it often means already stopped/removed
        if (err.message && err.message.includes('code 1') && err.stderr) {
            const benignErrors = ['not found', 'no such', 'no resource', 'removed', 'warning'];
            const isBenign = benignErrors.some(e => err.stderr.toLowerCase().includes(e));
            if (isBenign) {
                console.log('Stop command failed but error deemed benign (resources likely already gone).');
                return res.json({ success: true, message: 'Stack stopped (resources were missing or already removed)', stderr: err.stderr });
            }
        }
        res.status(500).json({ error: err.message });
    }
});

// 5. Restart Stack
app.post('/api/restart', express.json(), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });

        const projectName = name.replace(/\.(yaml|yml)$/, '');

        // Determine path logic (Reused from Deploy/Stop)
        let targetFile;
        let projectDir;
        const fullPath = path.join(STACKS_DIR, name);

        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
            const yamlName = possibleNames.find(n => fs.existsSync(path.join(fullPath, n)));
            if (yamlName) {
                targetFile = path.join(fullPath, yamlName);
                projectDir = fullPath;
            }
        } else if (fs.existsSync(fullPath)) {
            targetFile = fullPath;
            projectDir = STACKS_DIR;
        } else if (fs.existsSync(fullPath + '.yaml')) {
            targetFile = fullPath + '.yaml';
            projectDir = STACKS_DIR;
        }

        let command;
        if (targetFile && process.env.HOST_PROJECT_PATH) {
            let hostStackPath;
            if (path.dirname(targetFile).includes('stacks')) {
                const relativePath = path.relative(STACKS_DIR, projectDir);
                hostStackPath = path.join(process.env.HOST_PROJECT_PATH, 'stacks', relativePath);
            } else {
                hostStackPath = projectDir;
            }
            command = `docker compose -p "${projectName}" --project-directory "${hostStackPath}" restart`;
        } else {
            command = `docker compose -p "${projectName}" restart`;
        }

        console.log(`Executing Restart: ${command}`);
        const { stdout, stderr } = await streamCommand(command, projectDir || STACKS_DIR, name);
        res.json({ success: true, stdout, stderr });

    } catch (err) {
        console.error('Restart error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6. Update Stack (Git Pull + Image Pull + Up)
app.post('/api/update', express.json(), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });

        const projectName = name.replace(/\.(yaml|yml)$/, '');

        // Determine path logic
        let targetFile;
        let projectDir;
        const fullPath = path.join(STACKS_DIR, name);

        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
            const yamlName = possibleNames.find(n => fs.existsSync(path.join(fullPath, n)));
            if (yamlName) {
                targetFile = path.join(fullPath, yamlName);
                projectDir = fullPath;
            }
        } else if (fs.existsSync(fullPath)) {
            // Single file, cannot update via git easily unless we know the repo dir
            // Just pull images and deploy
            targetFile = fullPath;
            projectDir = STACKS_DIR;
        } else if (fs.existsSync(fullPath + '.yaml')) {
            targetFile = fullPath + '.yaml';
            projectDir = STACKS_DIR;
        }

        const messages = [];

        // 1. Git Pull (if .git exists)
        if (projectDir && fs.existsSync(path.join(projectDir, '.git'))) {
            try {
                const gitRes = await execAsync('git pull', { cwd: projectDir });
                messages.push('Git Pull:\n' + gitRes.stdout);
            } catch (e) {
                messages.push('Git Pull Error: ' + e.message);
            }
        }

        // 2. Docker Compose Pull & Up
        // Use HOST_PROJECT_PATH logic for docker commands
        let upCommand, pullCommand;

        if (targetFile && process.env.HOST_PROJECT_PATH) {
            let hostStackPath;
            if (path.dirname(targetFile).includes('stacks')) {
                const relativePath = path.relative(STACKS_DIR, projectDir);
                hostStackPath = path.join(process.env.HOST_PROJECT_PATH, 'stacks', relativePath);
            } else {
                hostStackPath = projectDir;
            }
            // NOTE: We need -f targetFile for pull if it's not standard, but --project-directory is key
            pullCommand = `docker compose -f "${targetFile}" -p "${projectName}" --project-directory "${hostStackPath}" pull --progress plain`;
            upCommand = `docker compose -f "${targetFile}" -p "${projectName}" --project-directory "${hostStackPath}" up -d`;
        } else {
            pullCommand = `docker compose -f "${targetFile}" -p "${projectName}" pull --progress plain`;
            upCommand = `docker compose -f "${targetFile}" -p "${projectName}" up -d`;
        }

        console.log(`Executing Update: ${pullCommand} && ${upCommand}`);

        io.emit('docker:output', { stack: name, type: 'info', data: '--- UPDATE STARTED ---\n' });

        const pullRes = await streamCommand(pullCommand, projectDir, name);
        messages.push('Images Pulled.');
        io.emit('docker:output', { stack: name, type: 'info', data: '\n--- DEPLOYING ---\n' });

        const upRes = await streamCommand(upCommand, projectDir, name);
        messages.push('Stack Deployed.');

        res.json({ success: true, messages: messages.join('\n') });

    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: err.message, details: err.stderr });
    }
});

// 5. Delete Stack
app.delete('/api/stacks/:name', async (req, res) => {
    try {
        const { name } = req.params;
        if (!name) return res.status(400).json({ error: 'Name required' });

        const fullPath = path.join(STACKS_DIR, name);

        // 1. Try to Stop/Down the stack first
        try {
            const projectName = name.replace(/\.(yaml|yml)$/, '');
            let targetFile;
            let projectDir;

            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
                const yamlName = possibleNames.find(n => fs.existsSync(path.join(fullPath, n)));
                if (yamlName) {
                    targetFile = path.join(fullPath, yamlName);
                    projectDir = fullPath;
                }
            } else if (fs.existsSync(fullPath)) {
                targetFile = fullPath;
                projectDir = STACKS_DIR;
            } else if (fs.existsSync(fullPath + '.yaml')) {
                // If the user provided name without extension but file has it
                targetFile = fullPath + '.yaml';
                projectDir = STACKS_DIR;
            }

            if (targetFile) {
                let command;
                if (process.env.HOST_PROJECT_PATH) {
                    let hostStackPath;
                    if (path.dirname(targetFile).includes('stacks')) {
                        const relativePath = path.relative(STACKS_DIR, projectDir);
                        hostStackPath = path.join(process.env.HOST_PROJECT_PATH, 'stacks', relativePath);
                    } else {
                        hostStackPath = projectDir;
                    }
                    command = `docker compose -p "${projectName}" --project-directory "${hostStackPath}" down`;
                } else {
                    command = `docker compose -p "${projectName}" down`;
                }

                console.log(`Executing pre-delete down: ${command}`);
                await execAsync(command);
            }
        } catch (downErr) {
            console.error('Failed to stop stack before delete (continuing delete anyway):', downErr);
            // We continue to delete the file even if down fails (e.g. maybe stack wasn't running)
            // If it failed with code 1, it's likely fine to proceed.
        }

        // 2. Delete the files
        if (!fs.existsSync(fullPath)) {
            // Try with extension if simple name
            if (fs.existsSync(fullPath + '.yaml')) {
                fs.unlinkSync(fullPath + '.yaml');
                return res.json({ success: true, message: 'Stack stopped and deleted' });
            }
            return res.status(404).json({ error: 'Stack not found' });
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(fullPath);
        }

        res.json({ success: true, message: 'Stack stopped and deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Get .env File
app.get('/api/stacks/:name/env', (req, res) => {
    try {
        const { name } = req.params;
        const fullPath = path.join(STACKS_DIR, name);

        let envPath;
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            envPath = path.join(fullPath, '.env');
        } else {
            // Fallback for file-based stacks (sibling .env)
            // e.g. stacks/my-stack.yaml -> stacks/my-stack.env
            const baseName = name.replace(/\.(yaml|yml)$/, '');
            envPath = path.join(STACKS_DIR, `${baseName}.env`);
        }

        if (fs.existsSync(envPath)) {
            res.json({ content: fs.readFileSync(envPath, 'utf8') });
        } else {
            res.json({ content: '' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Save .env File
app.post('/api/stacks/:name/env', express.json(), (req, res) => {
    try {
        const { name } = req.params;
        const { content } = req.body;

        const fullPath = path.join(STACKS_DIR, name);
        let envPath;

        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            envPath = path.join(fullPath, '.env');
        } else {
            // Try to find compatible file location
            // If stack file doesn't exist yet (new creation flow), we might need to be careful
            // But usually this is called after stack creation
            const baseName = name.replace(/\.(yaml|yml)$/, '');
            envPath = path.join(STACKS_DIR, `${baseName}.env`);
        }

        fs.writeFileSync(envPath, content || '');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Git Clone
app.post('/api/git/clone', express.json(), async (req, res) => {
    try {
        const { repoUrl, stackName } = req.body;
        if (!repoUrl) return res.status(400).json({ error: 'Repo URL required' });

        // Derive Name if not provided
        let name = stackName;
        if (!name) {
            name = repoUrl.split('/').pop().replace('.git', '');
        }

        // Cleanup name
        name = name.replace(/[^a-zA-Z0-9-_]/g, '');
        if (!name) name = 'imported-stack';

        const targetDir = path.join(STACKS_DIR, name);

        if (fs.existsSync(targetDir)) {
            return res.status(409).json({ error: 'Stack with this name already exists' });
        }

        console.log(`Cloning ${repoUrl} to ${targetDir}...`);

        // Clone
        await execAsync(`git clone "${repoUrl}" "${targetDir}"`);

        // Check for compose file
        const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
        const hasCompose = possibleNames.some(n => fs.existsSync(path.join(targetDir, n)));

        res.json({
            success: true,
            message: 'Cloned successfully',
            name,
            hasCompose
        });

    } catch (err) {
        console.error('Git Clone Error:', err);
        res.status(500).json({ error: err.message, stderr: err.stderr });
    }
});


// API: Config endpoint
app.get('/config.json', async (req, res) => {
    try {
        const containers = await docker.listContainers();
        const services = containers.map((container, index) => {
            const name = container.Names[0].replace('/', '');
            const image = container.Image;
            const ports = container.Ports.filter(p => p.PublicPort);
            const port = ports.length > 0 ? ports[0].PublicPort : null;

            return {
                id: container.Id.substring(0, 12),
                name: name.charAt(0).toUpperCase() + name.slice(1),
                hostname: port ? `__HOST__:${port}` : 'No Public Port',
                service: port ? `http://__HOST__:${port}` : '#',
                icon: getIconForContainer(image),
                containerId: container.Id // Expose real ID for logs
            };
        });
        res.json(services);
    } catch (error) {
        console.error('Docker Discovery Failed:', error);
        if (fs.existsSync(path.join(__dirname, 'public', 'config.json'))) {
            res.sendFile(path.join(__dirname, 'public', 'config.json'));
        } else {
            res.json([{ id: 'error', name: 'Docker Error', hostname: 'Check Logs', service: '#', icon: '' }]);
        }
    }
});

// Socket.IO Logic for Logs
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let stream = null;

    socket.on('logs:subscribe', async (containerId) => {
        try {
            const container = docker.getContainer(containerId);

            // Get logs stream
            stream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                tail: 100
            });

            // Stream logs to client
            stream.on('data', (chunk) => {
                socket.emit('logs:data', chunk.toString('utf8'));
            });

            stream.on('end', () => {
                socket.emit('logs:end');
            });

        } catch (error) {
            console.error('Log stream error:', error);
            socket.emit('logs:error', error.message);
        }
    });

    socket.on('logs:unsubscribe', () => {
        if (stream) {
            stream.destroy(); // Stop stream
            stream = null;
        }
    });

    socket.on('disconnect', () => {
        if (stream) {
            stream.destroy();
        }
    });
});

// --- SYSTEM & DOCKER STATS ---

// Map of container ID to its active stats stream to avoid duplicates
const containerStatsStreams = new Map();

// GET aggregated historical data
app.get('/api/system/history', (req, res) => {
    try {
        const range = req.query.range || 'daily';
        const data = getHistoryData(range);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to normalized Docker stats bytes to MB
const bytesToMB = (bytes) => (bytes / (1024 * 1024)).toFixed(2);

io.on('connection', (socket) => {
    // Docker Stats Subscription
    socket.on('stats:subscribe', async () => {
        try {
            const containers = await docker.listContainers();

            // Send initial list of running containers so UI has baseline ID and Names
            const containerMap = containers.map(c => ({
                id: c.Id.substring(0, 12),
                fullId: c.Id,
                name: c.Names[0].replace('/', ''),
                state: c.State
            }));

            socket.emit('stats:init', containerMap);

            // Stream stats for each running container
            containers.forEach(async (containerData) => {
                const container = docker.getContainer(containerData.Id);
                const shortId = containerData.Id.substring(0, 12);

                // Only start a stream if we aren't already tracking it
                if (!containerStatsStreams.has(shortId)) {
                    try {
                        const stream = await container.stats({ stream: true });
                        containerStatsStreams.set(shortId, stream);

                        stream.on('data', (chunk) => {
                            try {
                                const stats = JSON.parse(chunk.toString('utf8'));

                                // Calculate CPU Percent (Normalized by Cores if possible)
                                let cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
                                let systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
                                let cpuPercent = 0.0;

                                if (systemDelta > 0 && cpuDelta > 0) {
                                    cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100.0;
                                }

                                // Calculate Normalized CPU as requested in KI (divided by host cores)
                                // Since online_cpus is usually available in stats.cpu_stats.online_cpus
                                const normalizedCpuPercent = cpuPercent / (stats.cpu_stats.online_cpus || 1);

                                // Calculate RAM Percent
                                const usedMemory = stats.memory_stats?.usage - (stats.memory_stats?.stats?.cache || 0);
                                const availableMemory = stats.memory_stats?.limit;
                                let ramPercent = 0.0;
                                if (availableMemory && usedMemory) {
                                    ramPercent = (usedMemory / availableMemory) * 100.0;
                                }

                                // Calculate Network I/O
                                let rxBytes = 0;
                                let txBytes = 0;
                                if (stats.networks) {
                                    for (const [key, network] of Object.entries(stats.networks)) {
                                        rxBytes += network.rx_bytes;
                                        txBytes += network.tx_bytes;
                                    }
                                }

                                io.emit('stats:update', {
                                    id: shortId,
                                    cpu: normalizedCpuPercent.toFixed(2),
                                    rawCpu: cpuPercent.toFixed(2),
                                    ram: ramPercent.toFixed(1),
                                    ramUsedMB: bytesToMB(usedMemory || 0),
                                    ramTotalGB: (availableMemory / (1024 * 1024 * 1024)).toFixed(1),
                                    netRxMB: bytesToMB(rxBytes),
                                    netTxMB: bytesToMB(txBytes)
                                });

                            } catch (e) {
                                // Ignore parse errors on partial chunks
                            }
                        });

                        stream.on('error', () => {
                            containerStatsStreams.delete(shortId);
                        });

                    } catch (e) {
                        console.error(`Failed to get stats for ${shortId}:`, e);
                    }
                }
            });

        } catch (e) {
            console.error('Docker list error on stats init:', e);
        }
    });
});

// Store historical system data
const SYSTEM_HISTORY_MAX_POINTS = 60; // Assuming 1 point every 3 seconds = 3 mins of history
let systemHistory = [];

// Track peak values
let systemPeaks = {
    cpu: { value: 0, time: null },
    ram: { value: 0, time: null },
    temp: { value: 0, time: null }
};

app.get('/api/system/stats', async (req, res) => {
    try {
        const [cpu, temp, mem, fsSize, networkStats, time] = await Promise.all([
            si.currentLoad(),
            si.cpuTemperature(),
            si.mem(),
            si.fsSize(),
            si.networkStats(),
            si.time()
        ]);

        // Aggregate physical disks (avoid veth, virtual devices)
        const physicalDisks = fsSize.filter(d =>
            d.fs.startsWith('/dev/sd') ||
            d.fs.startsWith('/dev/nvme') ||
            d.fs.startsWith('/dev/mmcblk') ||
            d.fs.startsWith('/dev/disk') ||
            // Fallback for macOS testing local
            d.fs === '/dev/disk3s1s1'
        );

        let totalDisk = 0;
        let usedDisk = 0;

        if (physicalDisks.length > 0) {
            physicalDisks.forEach(d => {
                totalDisk += d.size;
                usedDisk += d.used;
            });
        } else if (fsSize.length > 0) {
            // Fallback if no matching physical drives found
            totalDisk = fsSize[0].size;
            usedDisk = fsSize[0].used;
        }

        const diskPercent = totalDisk > 0 ? ((usedDisk / totalDisk) * 100).toFixed(1) : 0;

        // Fix NaN currentLoad on first tick
        const currentCpu = parseFloat((cpu.currentLoad || 0).toFixed(1));

        // Mock temperature for macOS since si.cpuTemperature() is null without osx-temperature-sensor
        let currentTemp = temp.main;
        if (!currentTemp || currentTemp === 0) {
            if (process.platform === 'darwin') {
                // Generate a random temp between 42 and 48 for preview purposes
                currentTemp = 42 + Math.floor(Math.random() * 6);
            } else {
                currentTemp = 0;
            }
        }

        const currentRamPercent = parseFloat(((mem.active / mem.total) * 100).toFixed(1));

        const now = new Date();
        const timeString = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        // Update peaks
        if (currentCpu > systemPeaks.cpu.value) systemPeaks.cpu = { value: currentCpu, time: timeString };
        if (currentRamPercent > systemPeaks.ram.value) systemPeaks.ram = { value: currentRamPercent, time: timeString };
        if (currentTemp > systemPeaks.temp.value) systemPeaks.temp = { value: currentTemp, time: timeString };

        // Generate history data point
        const historyPoint = {
            time: timeString,
            cpu: currentCpu,
            ram: currentRamPercent,
            temp: currentTemp
        };

        // Maintain array size for Live View (short span)
        systemHistory.push(historyPoint);
        if (systemHistory.length > SYSTEM_HISTORY_MAX_POINTS) {
            systemHistory.shift();
        }

        // Pass to persistent logger for Downsampling
        logSystemData({
            cpu: currentCpu,
            ram: currentRamPercent,
            temp: currentTemp
        });

        res.json({
            current: {
                cpu: {
                    usage: currentCpu,
                },
                temp: {
                    celsius: currentTemp,
                },
                ram: {
                    used: bytesToMB(mem.active),
                    total: bytesToMB(mem.total),
                    percent: currentRamPercent
                },
                disk: {
                    usedGB: (usedDisk / (1024 * 1024 * 1024)).toFixed(2),
                    totalGB: (totalDisk / (1024 * 1024 * 1024)).toFixed(2),
                    freeGB: ((totalDisk - usedDisk) / (1024 * 1024 * 1024)).toFixed(2),
                    percent: diskPercent
                },
                uptime: time.uptime
            },
            history: systemHistory, // The live array for legacy fallback/short term tracking
            peaks: systemPeaks
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DOCKER RESOURCES ENDPOINTS ---

// Get all Docker volumes
app.get('/api/docker/volumes', async (req, res) => {
    try {
        const volumes = await docker.listVolumes();
        res.json(volumes.Volumes || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all Docker images
app.get('/api/docker/images', async (req, res) => {
    try {
        const images = await docker.listImages();
        res.json(images);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get volumes for a specific stack
app.get('/api/stacks/:name/volumes', async (req, res) => {
    try {
        const { name } = req.params;
        const projectName = name.replace(/\.(yaml|yml)$/, '');

        const volumes = await docker.listVolumes();
        const stackVolumes = (volumes.Volumes || []).filter(v =>
            v.Labels && (
                v.Labels['com.docker.compose.project'] === projectName ||
                v.Name.includes(projectName)
            )
        );

        res.json(stackVolumes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get images for a specific stack
app.get('/api/stacks/:name/images', async (req, res) => {
    try {
        const { name } = req.params;
        const fullPath = path.join(STACKS_DIR, name);

        // Read compose file
        let composeContent;
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
            const yamlName = possibleNames.find(n => fs.existsSync(path.join(fullPath, n)));
            if (yamlName) {
                composeContent = fs.readFileSync(path.join(fullPath, yamlName), 'utf8');
            }
        } else if (fs.existsSync(fullPath + '.yaml')) {
            composeContent = fs.readFileSync(fullPath + '.yaml', 'utf8');
        } else if (fs.existsSync(fullPath)) {
            composeContent = fs.readFileSync(fullPath, 'utf8');
        }

        if (!composeContent) {
            return res.status(404).json({ error: 'Stack not found' });
        }

        // Parse YAML and extract images
        const yaml = require('js-yaml');
        const doc = yaml.load(composeContent);
        const imageNames = [];

        if (doc && doc.services) {
            Object.values(doc.services).forEach(service => {
                if (service.image) {
                    imageNames.push(service.image);
                }
            });
        }

        // Get full image details from Docker
        const allImages = await docker.listImages();
        const stackImages = allImages.filter(img => {
            return img.RepoTags && img.RepoTags.some(tag =>
                imageNames.some(name => tag.includes(name) || name.includes(tag.split(':')[0]))
            );
        });

        res.json(stackImages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a volume
app.delete('/api/docker/volumes/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const volume = docker.getVolume(name);
        await volume.remove();
        res.json({ success: true, message: 'Volume removed' });
    } catch (err) {
        console.error('Volume deletion error:', err);

        // Docker error handling - check status code OR message content
        const isConflict = err.statusCode === 409 ||
            (err.message && (err.message.includes('409') || err.message.includes('conflict') || err.message.includes('in use')));

        if (isConflict) {
            // Volume is in use by a container
            return res.status(409).json({
                error: 'Cannot delete volume: It is currently in use by a container. Remove the container first.'
            });
        } else if (err.statusCode === 404) {
            return res.status(404).json({ error: 'Volume not found' });
        }

        res.status(500).json({ error: err.message });
    }
});

// Delete an image
app.delete('/api/docker/images/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const image = docker.getImage(id);
        await image.remove();
        res.json({ success: true, message: 'Image removed' });
    } catch (err) {
        console.error('Image deletion error:', err);

        // Docker error handling - check status code OR message content
        const isConflict = err.statusCode === 409 ||
            (err.message && (err.message.includes('409') || err.message.includes('conflict') || err.message.includes('in use')));

        if (isConflict) {
            // Image is in use by a container
            return res.status(409).json({
                error: 'Cannot delete image: It is currently in use. Remove the container first.'
            });
        } else if (err.statusCode === 404) {
            return res.status(404).json({ error: 'Image not found' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Rename stack (and redeploy to reflect name change)
app.post('/api/stacks/:name/rename', express.json(), async (req, res) => {
    try {
        const { name } = req.params;
        const { newName } = req.body;
        const oldProjectName = name.replace(/\.(yaml|yml)$/, '');
        const newProjectName = newName.replace(/\.(yaml|yml)$/, '');

        const stacksDir = path.join(__dirname, 'stacks');
        const oldPath = path.join(stacksDir, name);

        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ error: 'Stack not found' });
        }

        const isDiroctory = fs.statSync(oldPath).isDirectory();

        // Determine new file/folder name
        let newFileName = newName;
        // Only force extension if it's a file stack and doesn't have it
        if (!isDiroctory && !newName.endsWith('.yaml') && !newName.endsWith('.yml')) {
            newFileName += '.yaml';
        }

        const newPath = path.join(stacksDir, newFileName);

        if (fs.existsSync(newPath)) {
            return res.status(400).json({ error: 'Stack with new name already exists' });
        }

        console.log(`[RENAME] Stopping old stack: ${oldProjectName}`);

        // 1. Stop old stack
        try {
            // Need to determine target file for old stack to stop it correctly? 
            // Usually 'down' only needs project name if resources match, 
            // but relying on file is safer for custom networks etc.
            // For now, simpler 'down' by project name (which we used before) is usually sufficient 
            // if we are in the right directory or have right config. 
            // But let's use the safer generic 'execAsync' we had.
            await execAsync(`docker compose -p "${oldProjectName}" down`);
        } catch (downErr) {
            console.warn(`[RENAME] Warning: Failed to stop old stack (ignoring): ${downErr.message}`);
        }

        // 2. Rename file/folder
        console.log(`[RENAME] Renaming: ${oldPath} -> ${newPath}`);
        fs.renameSync(oldPath, newPath);

        // 3. Start the new stack (Redeploy)
        console.log(`[RENAME] Starting new stack: ${newProjectName}`);

        // Determine correct target file for the new stack
        let targetFile;
        let projectDir;

        if (isDiroctory) {
            const possibleNames = ['docker-compose.yaml', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];
            const yamlName = possibleNames.find(n => fs.existsSync(path.join(newPath, n)));
            if (yamlName) {
                targetFile = path.join(newPath, yamlName);
                projectDir = newPath;
            } else {
                // Fallback if no yaml found inside (shouldn't happen for valid stack)
                console.warn('[RENAME] No compose file found in renamed folder. Cannot redeploy.');
                return res.json({ success: true, message: 'Stack renamed. Warning: Redeploy skipped (no compose file found).' });
            }
        } else {
            targetFile = newPath;
            projectDir = stacksDir;
        }

        let command;
        // Construct Up Command
        if (targetFile && process.env.HOST_PROJECT_PATH) {
            let hostStackPath;
            if (path.dirname(targetFile).includes('stacks')) {
                const relativePath = path.relative(STACKS_DIR, projectDir);
                hostStackPath = path.join(process.env.HOST_PROJECT_PATH, 'stacks', relativePath);
            } else {
                hostStackPath = STACKS_DIR;
            }
            command = `docker compose -f "${targetFile}" -p "${newProjectName}" --project-directory "${hostStackPath}" up -d`;
        } else {
            command = `docker compose -f "${targetFile}" -p "${newProjectName}" up -d`;
        }

        try {
            // Use projectDir as CWD for context
            const upRes = await execAsync(command, { cwd: projectDir });
            console.log('[RENAME] Redeploy output:', upRes.stdout);
            res.json({ success: true, message: 'Stack renamed and redeployed', stdout: upRes.stdout });
        } catch (upErr) {
            console.error('[RENAME] Redeploy failed:', upErr);
            res.json({ success: true, message: 'Stack renamed but redeploy failed. Please start manually.', error: upErr.message });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get containers for a stack
app.get('/api/stacks/:name/containers', async (req, res) => {
    try {
        const { name } = req.params;
        const projectName = name.replace(/\.(yaml|yml)$/, '');

        const containers = await docker.listContainers({ all: true });
        const stackContainers = containers.filter(c =>
            c.Labels && c.Labels['com.docker.compose.project'] === projectName
        );

        res.json(stackContainers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to strip Docker multiplexing headers
function stripDockerHeaders(buffer) {
    if (!Buffer.isBuffer(buffer)) return buffer;

    let logs = '';
    let current = 0;
    while (current < buffer.length) {
        // Each frame has 8 bytes header (STREAM_TYPE, 0, 0, 0, SIZE, SIZE, SIZE, SIZE)
        if (current + 8 > buffer.length) break;

        // Read size from bytes 4-7 (Big Endian)
        const size = buffer.readUInt32BE(current + 4);
        current += 8;

        if (current + size > buffer.length) break;

        // Extract payload
        const payload = buffer.slice(current, current + size);
        logs += payload.toString('utf8');
        current += size;
    }
    return logs;
}

// Get container logs (REST endpoint for quick fetch)
app.get('/api/containers/:id/logs', async (req, res) => {
    try {
        const { id } = req.params;
        const lines = parseInt(req.query.lines) || 100;

        console.log(`[LOGS] Fetching for container: ${id}, lines: ${lines}`);

        const container = docker.getContainer(id);

        const logsBoxed = await container.logs({
            stdout: true,
            stderr: true,
            tail: lines,
            timestamps: true,
            follow: false // Ensure we get a single buffer
        });

        // logsBoxed is a Buffer with multiplexed headers
        const cleanLogs = stripDockerHeaders(logsBoxed);

        console.log(`[LOGS] Success. Raw: ${logsBoxed.length}, Clean: ${cleanLogs.length}`);
        res.send(cleanLogs);
    } catch (err) {
        console.error('[LOGS] ERROR:', err);
        res.status(500).json({ error: err.message });
    }
});


// Stop a specific container
app.post('/api/containers/:id/stop', async (req, res) => {
    try {
        const { id } = req.params;
        const container = docker.getContainer(id);

        // Inspect checks if it exists and status
        const info = await container.inspect();
        if (!info.State.Running) {
            return res.json({ success: true, message: 'Container is already stopped' });
        }

        await container.stop();
        res.json({ success: true, message: 'Container stopped successfully' });
    } catch (err) {
        // 304 means already stopped usually, but we check state above. 
        // 404 if not found.
        if (err.statusCode === 304) {
            return res.json({ success: true, message: 'Container is already stopped' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Start a specific container
app.post('/api/containers/:id/start', async (req, res) => {
    try {
        const { id } = req.params;
        const container = docker.getContainer(id);

        const info = await container.inspect();
        if (info.State.Running) {
            return res.json({ success: true, message: 'Container is already running' });
        }

        await container.start();
        res.json({ success: true, message: 'Container started successfully' });
    } catch (err) {
        if (err.statusCode === 304) {
            return res.json({ success: true, message: 'Container is already running' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Catch-all handler
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO initialized`);
});
