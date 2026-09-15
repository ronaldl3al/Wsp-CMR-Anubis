# Stage 1: Build Frontend (React + Vite)
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client ./
RUN npm run build

# Stage 2: Build and Run Backend (Node.js + Express)
FROM node:20-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy server source and compile TypeScript
COPY server ./server
RUN cd server && npm run build

# Copy compiled frontend from client-builder
COPY --from=client-builder /app/client/dist /app/client/dist

# Expose port (dynamic on Railway)
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Start unified server
CMD ["node", "server/dist/server.js"]
