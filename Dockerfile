# Frontend build stage
FROM node:20.18-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./
COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/eslint.config.js ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html ./
COPY frontend/.env.production ./

# Build frontend for production
RUN npm run build

# Backend build stage
FROM node:20.18-alpine AS backend-builder

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install all dependencies (need devDependencies for build)
RUN echo "=== DEBUG ===" && \
    echo "npm version: $(npm --version)" && \
    echo "node version: $(node --version)" && \
    echo "package.json exists: $(ls -la package.json)" && \
    echo "package-lock.json exists: $(ls -la package-lock.json)" && \
    echo "=== Running npm ci ===" && \
    npm ci --verbose

# Copy backend source code
COPY backend/src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20.18-alpine

WORKDIR /app

# Install psql for database operations (migrations, debugging)
RUN apk add --no-cache postgresql-client

# Copy backend package files and install production dependencies only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy built backend from builder
COPY --from=backend-builder /app/dist ./dist

# Copy migrations SQL files (not compiled by TypeScript)
COPY backend/src/shared/db/migrations ./dist/shared/db/migrations

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start API server
CMD ["node", "dist/api/server.js"]
