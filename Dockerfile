# Stage 1: Base image with Bun
FROM oven/bun:1 AS base
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Stage 2: Build the application
FROM base AS builder

# Copy dependencies from previous stage
COPY --from=base /app/node_modules ./node_modules

# Copy source code and configuration files
COPY . .

# Build the SvelteKit application
RUN bun --bun run build

# Stage 3: Production runtime
FROM oven/bun:1-slim AS runner

# Set working directory
WORKDIR /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/data && \
    chown -R bun:bun /app

# Copy package files for production dependencies
COPY --from=builder --chown=bun:bun /app/package.json /app/bun.lock ./

# Install ONLY production dependencies
RUN bun install --frozen-lockfile --production

# Copy built application from builder stage
COPY --from=builder --chown=bun:bun /app/build ./build

# Copy database migration files and
COPY --from=builder --chown=bun:bun /app/drizzle.config.ts ./
COPY --from=builder --chown=bun:bun /app/drizzle ./drizzle
COPY --from=builder --chown=bun:bun /app/migrate.ts ./migrate.ts

# Switch to non-root user
USER bun

# Expose the application port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV DATABASE_URL=/app/data/spendbee.db

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD bun run -e 'fetch("http://localhost:8080/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Start the application
CMD ["bun", "run", "./build/index.js"]
