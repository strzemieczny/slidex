# --- ETAP 1: Budowanie NestJS ---
FROM node:20-alpine AS builder

WORKDIR /app

ENV NODE_TLS_REJECT_UNAUTHORIZED=0

COPY package*.json ./
RUN npm config set strict-ssl false && npm install

COPY . .

# Generowanie klienta Prisma przed buildem NestJS
RUN npx prisma generate || true

RUN npm run build

# --- ETAP 2: Uruchomienie Produkcyjne ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

COPY package*.json ./
RUN npm config set strict-ssl false && npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

# Skrypt uruchamiający – znajduje main.js bez względu na to, czy trafił do dist/ czy dist/src/
CMD ["sh", "-c", "if [ -f dist/src/main.js ]; then node dist/src/main.js; else node dist/main.js; fi"]
