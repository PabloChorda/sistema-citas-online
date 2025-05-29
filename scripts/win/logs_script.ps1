# Crear carpeta de logs si no existe
if (-Not (Test-Path -Path "./logs")) {
    New-Item -ItemType Directory -Path "./logs"
}

# Guardar logs de cada contenedor
docker logs flask_backend         > .\logs\flask_backend.log
docker logs pgadmin_container     > .\logs\pgadmin_container.log
docker logs postgres_citas_db     > .\logs\postgres_citas_db.log

Write-Host "✅ Logs exportados en la carpeta 'logs\'"
