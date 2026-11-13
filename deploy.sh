#!/usr/bin/env bash
set -e

# Configuration
SERVER_HOST="${1:-169.58.16.244}"
SERVER_USER="${2:-root}"
SSH_KEY="${HOME}/.ssh/id_rsa_169.58.16.244"
REMOTE_DIR="/opt/titan"

echo "🚀 Deploying Titan Trains to ${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}..."

# 1. Sync source files to remote server
echo "📦 Syncing project files..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" "mkdir -p ${REMOTE_DIR}"
rsync -avz -e "ssh -i ${SSH_KEY}" --exclude 'node_modules' --exclude '.git' --exclude 'dist' ./ "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}/"

# 2. Build and start container on remote server
echo "🐳 Building and starting Docker container on server..."
ssh -i "${SSH_KEY}" "${SERVER_USER}@${SERVER_HOST}" "cd ${REMOTE_DIR} && docker compose up -d --build --remove-orphans"

echo "✅ Titan Trains container is running on 127.0.0.1:3900!"
