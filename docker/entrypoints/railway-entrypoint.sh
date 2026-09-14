#!/bin/sh
set -e

echo "=== INICIANDO CHATWOOT EN RAILWAY ==="

# 1. Limpieza de procesos y cachés previos
rm -rf /app/tmp/pids/server.pid
rm -rf /app/tmp/cache/*

# 2. Parseo inteligente de DATABASE_URL si está presente (Railway Postgres Plugin)
if [ -n "$DATABASE_URL" ]; then
  echo "Parseando parámetros desde DATABASE_URL..."
  eval $(ruby -ruri -e '
    begin
      uri = URI(ENV["DATABASE_URL"])
      db = uri.path ? uri.path.sub("/", "") : ""
      puts "export POSTGRES_HOST=\"#{uri.host}\""
      puts "export POSTGRES_PORT=\"#{uri.port || 5432}\""
      puts "export POSTGRES_USERNAME=\"#{uri.user}\""
      puts "export POSTGRES_PASSWORD=\"#{uri.password}\""
      puts "export POSTGRES_DATABASE=\"#{db}\""
      puts "export PGPASSWORD=\"#{uri.password}\""
    rescue => e
      warn "Error parseando DATABASE_URL: #{e.message}"
    end
  ')
fi

if [ -n "$POSTGRES_PASSWORD" ]; then
  export PGPASSWORD="$POSTGRES_PASSWORD"
fi

# 3. Esperar disponibilidad de PostgreSQL
if [ -n "$POSTGRES_HOST" ]; then
  echo "Esperando conexión a PostgreSQL en $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
  until pg_isready -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USERNAME:-postgres}"; do
    sleep 2
  done
  echo "PostgreSQL listo para aceptar conexiones."
fi

# 4. Migraciones y preparación de base de datos
if [ "$SKIP_DB_PREPARE" != "true" ]; then
  echo "Ejecutando preparación de base de datos (db:chatwoot_prepare)..."
  bundle exec rails db:chatwoot_prepare || echo "db:chatwoot_prepare completado o omitido."
fi

# 5. Configuración de IP Lookup
echo "Configurando ip_lookup..."
bundle exec rails ip_lookup:setup || true

# 6. Modo Combinado (Web + Sidekiq Worker)
# Si RUN_SIDEKIQ no es "false" y el comando es el servidor web, arrancar Sidekiq en segundo plano
if [ "$RUN_SIDEKIQ" != "false" ] && [ "$1" = "bundle" ] && [ "$2" = "exec" ] && [ "$3" = "rails" ]; then
  echo "Iniciando worker Sidekiq en segundo plano..."
  bundle exec sidekiq -C config/sidekiq.yml &
fi

echo "Iniciando proceso principal: $@"
exec "$@"
