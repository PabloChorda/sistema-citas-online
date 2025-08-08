# frontend/Dockerfile
FROM node:18-alpine
WORKDIR /app

# Copiamos package*.json primero para aprovechar caché en builds futuros
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copiamos el resto del código
COPY . .

# Compilamos el CSS purgado (generará src/index.css dentro de la imagen)
RUN npm run tailwind

EXPOSE 5173
CMD ["npm","run","dev","--","--host"]