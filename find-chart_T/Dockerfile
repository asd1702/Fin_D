# Base image
FROM node:22-alpine

# Working directory
WORKDIR /app

# Install system dependencies (OpenSSL required for Prisma)
RUN apk add --no-cache openssl

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (including devDependencies for ts-node)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client (Needs dummy URL for build)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Expose port
EXPOSE 8080

# Run the server directly with ts-node to avoid dotenv-cli dependency on .env file existence
CMD ["npx", "ts-node", "src/server.ts"]
