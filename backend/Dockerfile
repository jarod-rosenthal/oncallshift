# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -g 1001 nodejs && adduser -S nodejs -u 1001 -G nodejs
USER nodejs

EXPOSE 3000

CMD ["node", "dist/api/server.js"]
