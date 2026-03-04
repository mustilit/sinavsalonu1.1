# ---- Stage 1: Builder ----
FROM node:18-slim AS builder

WORKDIR /usr/src/app

# Build args (proxy / registry)
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG NPM_REGISTRY=https://registry.npmjs.org

# System deps (openssl + CA) for Prisma and HTTPS
RUN apt-get update -y \
  && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# NPM network hardening (default registry when empty)
# Ayrıca olası bozuk proxy ayarlarından kaçınmak için
# HTTP(S)_PROXY değişkenlerini bu imaj içinde temizliyoruz.
RUN npm config delete registry || true \
  && npm config set registry https://registry.npmjs.org/ \
  && npm config delete proxy || true \
  && npm config delete https-proxy || true \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000 \
  && npm config set audit false \
  && npm config set fund false

# Ensure no proxy env during npm install (avoids ERR_INVALID_URL from host)
COPY package*.json ./

# NPM proxy ayarlarını tamamen kapat
RUN npm config delete proxy || true \
  && npm config delete https-proxy || true \
  && npm config set proxy null \
  && npm config set https-proxy null

# Install all deps (including dev) for build
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then npm ci --include=dev; else npm install; fi

COPY prisma ./prisma
COPY . .

# Build script already runs `prisma generate`
RUN npm run build

# ---- Stage 2: Runtime ----
FROM node:18-slim

WORKDIR /usr/src/app

# System deps for runtime
RUN apt-get update -y \
  && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Reuse proxy / registry config in runtime (default registry when empty)
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm config delete registry || true \
  && npm config set registry https://registry.npmjs.org/ \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000 \
  && npm config set audit false \
  && npm config set fund false

COPY package*.json ./

# Production dependencies:
# Bazı ortamlarda npm ci sırasında ERR_INVALID_URL
# hatası oluştuğu için, runtime imajında ikinci kez
# npm kurulumunu atlıyoruz ve builder'dan kopyalıyoruz.
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Prisma schema + generate client for runtime
COPY --from=builder /usr/src/app/prisma ./prisma
RUN npx prisma generate

# Copy compiled application and start script
COPY --from=builder /usr/src/app/dist ./dist
COPY docker/app/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production

# Non-root user for better security
RUN useradd -m appuser
USER appuser

EXPOSE 3000

CMD ["./start.sh"]