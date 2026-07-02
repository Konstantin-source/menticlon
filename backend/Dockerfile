# Build stage/Production runner
FROM node:18-alpine

# Set Node environment
ENV NODE_ENV=production

WORKDIR /app

# Copy package configuration
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Expose port (default 5000)
EXPOSE 5000

# Start command
CMD ["npm", "start"]
