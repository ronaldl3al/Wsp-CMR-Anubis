# Stage 1: Build Flutter Web application
FROM ghcr.io/cirruslabs/flutter:stable AS flutter-builder

WORKDIR /flutter_app
COPY flutter_app/pubspec.yaml ./
RUN flutter pub get

COPY flutter_app/ ./
RUN flutter build web --release

# Stage 2: Build Node.js TypeScript server
FROM node:20-alpine AS server-builder

WORKDIR /server
COPY server/package*.json ./
COPY server/tsconfig.json ./
RUN npm install

COPY server/src/ ./src/
RUN npm run build

# Stage 3: Minimal Production Image
FROM node:20-alpine AS runner

WORKDIR /app

ENV PORT=8080
ENV NODE_ENV=production

# Install only production dependencies
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy compiled backend
COPY --from=server-builder /server/dist ./dist

# Copy compiled Flutter web frontend into public static folder
COPY --from=flutter-builder /flutter_app/build/web ./public

EXPOSE 8080

CMD ["node", "dist/server.js"]
