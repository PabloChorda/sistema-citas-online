# Imagen base
FROM node:18-alpine

# Crear carpeta de trabajo
WORKDIR /app

# Copiar dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar todo lo demás
COPY . .

# Exponer el puerto en el que Vite sirve la app
EXPOSE 5173

# Comando por defecto
CMD ["npm", "run", "dev", "--", "--host"]
