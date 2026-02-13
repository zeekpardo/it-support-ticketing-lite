FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy app source
COPY . .

EXPOSE 8080

# Railway injects PORT; app reads process.env.PORT
CMD ["npm", "start"]
