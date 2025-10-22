# backend/Dockerfile
FROM python:3.11-slim

# Evita pyc y asegura logs inmediatos
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# IMPORTANTÍSIMO: que /app esté en el PYTHONPATH para poder importar "backend.*"
ENV PYTHONPATH=/app

# Opcional: te deja usar 'flask' sin --app cada vez
ENV FLASK_APP=backend.wsgi

WORKDIR /app

# Instala deps primero para cachear capas
COPY requirements.txt ./
RUN pip install --no-cache-dir -U pip \
 && pip install --no-cache-dir -r requirements.txt

# Copia el código
COPY . .

# Asegúrate de que tu app escuche en este puerto
EXPOSE 5001

# Arranque por defecto (si tu run.py inicia el servidor)
CMD ["python", "-m", "backend.run"]
