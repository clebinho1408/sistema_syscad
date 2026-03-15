# ========================
# Stage 1: Build
# ========================
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ========================
# Stage 2: Production
# ========================
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install Tesseract OCR with Portuguese and English language packs
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create uploads directory
RUN mkdir -p uploads && chmod 755 uploads

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
