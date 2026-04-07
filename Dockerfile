# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Ensure public directory exists even if repo doesn't include it
RUN mkdir -p /app/public

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy startup entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Copy package files from builder
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --production

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3050
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8080

# Expose the port (default 3050)
EXPOSE 3050

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3050), (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Generate runtime client env before starting Next.js
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]

# Start the application
CMD ["pnpm", "start"]
