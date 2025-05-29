# Usa una imagen oficial de Python
FROM python:3.11-slim

# Establece el directorio de trabajo en el contenedor
WORKDIR /app

# Copia el archivo de dependencias
COPY requirements.txt .

# Instala las dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto del código del proyecto
COPY . .

# Expone el puerto de Flask (interno)
EXPOSE 5000

# Comando por defecto (se puede sobrescribir en docker-compose.yml)
CMD ["flask", "run", "--host=0.0.0.0", "--port=5000"]
