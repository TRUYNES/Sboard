# Sboard

A lightweight, glassmorphism-styled dashboard for your Raspberry Pi application services, built with Vite + React + Vanilla CSS.

## Features
- **Glassmorphism Design**: Modern UI with backdrop blur and neon accents.
- **Dynamic Configuration**: Edit `public/config.json` to update services without rebuilding the image.
- **Dual Links**: "Local" (IP-based) and "Public" (Hostname-based) links for each service.
- **Docker Ready**: Includes lightweight Nginx-based Dockerfile and docker-compose setup.

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

## Deployment via Docker Compose

This project is ready to be deployed with Dockge or standard Docker Compose.

### 1. Build and Run

```bash
docker-compose up -d --build
```

The dashboard will be available at `http://<your-pi-ip>:80` (or the port mapped in `docker-compose.yaml`).

### 2. Updating Configuration

The configuration file is located at `public/config.json`.
- In development: Edit `public/config.json` directly.
- In Docker: The file is mounted at `/usr/share/nginx/html/config.json`. You can edit it on the host and refresh the page.

### 3. GitHub Deployment

To push this to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Then on your Dockge/Portainer/Pi:

```bash
git clone <your-repo-url>
cd sboard
docker-compose up -d --build
```
