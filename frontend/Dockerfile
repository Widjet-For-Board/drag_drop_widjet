# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем ВСЕ зависимости (включая dev, они нужны для tsc и vite build)
RUN npm ci

# Копируем код
COPY . .

# Собираем production
RUN npm run build

# Production stage — суперлёгкий сервер (~15-20 MB)
FROM pierrezemb/gostatic:latest
COPY --from=builder /app/dist /srv
ENV GO_STATIC_FALLBACK_FILE=/srv/index.html
EXPOSE 8043
CMD ["-fallback", "/srv/index.html"]