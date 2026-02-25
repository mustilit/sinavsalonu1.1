FROM node:18-slim

WORKDIR /usr/src/app

# Install openssl early so Prisma client generation works in the image
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Use npm install during image build to be more resilient in restricted networks
RUN npm install

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

