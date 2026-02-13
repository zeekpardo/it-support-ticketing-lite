FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

# Prisma engines require OpenSSL at runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

EXPOSE 8080

# Railway injects PORT; app reads process.env.PORT
CMD ["npm", "start"]
