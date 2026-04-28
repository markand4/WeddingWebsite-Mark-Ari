# Build stage — install only production deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage — minimal image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Cloud Run sets PORT; expose it for documentation
EXPOSE 8080

CMD ["node", "server.js"]
