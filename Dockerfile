# =============================================================
# Whaticket Community — Single Container Railway Dockerfile
# =============================================================

# ── Stage 1: Build Frontend ──────────────────────────────────
FROM mirror.gcr.io/library/node:20-bookworm-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Backend ───────────────────────────────────
FROM mirror.gcr.io/library/node:20-bookworm-slim AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

# ── Stage 3: Runtime Image ───────────────────────────────────
FROM mirror.gcr.io/library/node:20-bookworm-slim

# Install Google Chrome Stable and FFmpeg for WhatsApp Web.js
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates dumb-init --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub \
       | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
       http://dl.google.com/linux/chrome/deb/ stable main" \
       > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y \
       google-chrome-stable ffmpeg --no-install-recommends --fix-missing \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

# Backend dist, node_modules and config
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./package.json
COPY --from=backend-builder /app/backend/.sequelizerc ./.sequelizerc

# Frontend static build into public/frontend
COPY --from=frontend-builder /app/frontend/build ./public/frontend

# Runtime directories
RUN mkdir -p public .wwebjs_auth .wwebjs_cache

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--", "/docker-entrypoint.sh"]
