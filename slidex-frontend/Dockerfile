# --- ETAP 1: Budowanie aplikacji Vite ---
FROM node:20-alpine AS builder

WORKDIR /app

# Wyłączenie rygorystycznej weryfikacji SSL w sieciach korporacyjnych
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

COPY package*.json ./
# Używamy npm install z opcją ignorowania błędów sieciowych certyfikatów
RUN npm config set strict-ssl false && npm install

COPY . .
RUN npm run build

# --- ETAP 2: Serwowanie plików przez Nginx ---
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]