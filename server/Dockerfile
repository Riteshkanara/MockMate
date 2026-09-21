# ─── Stage 1: Install dependencies ───────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files first for layer caching
# If only code changes, npm install is skipped
COPY package*.json ./

RUN npm ci --omit=dev

# ─── Stage 2: Run the app ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only production node_modules from Stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Expose the port Express runs on
EXPOSE 5000

# Health check — Docker monitors this every 30s
# Auto-restarts container if server goes down
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Start command
CMD ["node", "index.js"]