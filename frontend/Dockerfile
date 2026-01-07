FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --include=dev

RUN ls -la node_modules/.bin/vite || echo "vite not found in .bin"
RUN npx vite --version

COPY . .

EXPOSE 3000

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]