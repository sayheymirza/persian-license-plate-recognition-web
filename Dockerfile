# Use Node.js LTS version as the base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm i --force

# Copy project files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Expose port 4000
EXPOSE 4000

# Set environment variable for the port
ENV PORT=4000

# Start the server
CMD ["npm", "run", "serve:ssr:plpr-web"]
