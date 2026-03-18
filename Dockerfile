# ──────────────────────────────────────────
# Stage 1: builder
# ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ──────────────────────────────────────────
# Stage 2: runner
# ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install claude CLI (provides the `claude` binary) and verify it's on PATH
RUN npm install -g @anthropic-ai/claude-code && which claude

# Copy standalone Next.js build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma artifacts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy libsql client (production runtime dependency for Prisma v7 SQLite adapter)
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql

# Create data directory and claude credentials mount point
RUN mkdir -p /data/tmp /root/.claude

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000 3100

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"]
