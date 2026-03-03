FROM node:18-slim

WORKDIR /usr/src/app

# ---- Build args (proxy vb.) ----
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG NPM_REGISTRY=https://registry.npmjs.org

# Install openssl early so Prisma client generation works in the image
RUN apt-get update -y \
  && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# NPM network hardening (retry/timeout) + optional proxy propagation
RUN npm config set registry ${NPM_REGISTRY} \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000 \
  && npm config set audit false \
  && npm config set fund false

COPY package*.json ./

# If you have package-lock.json, prefer npm ci
# BuildKit cache mounts speed up and reduce network calls on rebuild
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --include=dev; else npm install; fi

# Copy Prisma schema separately so prisma generate can run after deps are installed
COPY prisma ./prisma
COPY . .

# Generate Prisma client (requires openssl in the image)
RUN npx prisma generate

# Build the application
RUN npm run build

# Copy start script and make executable
COPY docker/app/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production

EXPOSE 3000

CMD ["./start.sh"]