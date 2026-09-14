#!/bin/sh
set -e

echo "=== INICIANDO CHATWOOT EN RAILWAY ==="

# 1. Limpieza preventiva de locks y sockets previos
rm -rf /app/tmp/pids/server.pid
rm -rf /app/tmp/cache/*

# 2. Resolución de variables de base de datos de Railway
DATABASE_URL="${DATABASE_URL:-$DATABASE_PRIVATE_URL}"
DATABASE_URL="${DATABASE_URL:-$POSTGRES_URL}"
DATABASE_URL="${DATABASE_URL:-$POSTGRES_PRIVATE_URL}"
REDIS_URL="${REDIS_URL:-$REDIS_PRIVATE_URL}"

export DATABASE_URL
export REDIS_URL

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

# 3. Fallbacks defensivos para variables críticas
if [ -z "$SECRET_KEY_BASE" ]; then
  echo "Generando SECRET_KEY_BASE seguro..."
  export SECRET_KEY_BASE=$(ruby -rsecurerandom -e 'puts SecureRandom.hex(64)')
fi

if [ -z "$FRONTEND_URL" ]; then
  export FRONTEND_URL="https://wsp-cmr-anubis-production.up.railway.app"
fi

if [ -z "$ENABLE_ACCOUNT_SIGNUP" ]; then
  export ENABLE_ACCOUNT_SIGNUP="true"
fi

# 4. Esperar a PostgreSQL
if [ -n "$POSTGRES_HOST" ]; then
  echo "Esperando conexión a PostgreSQL en $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
  until pg_isready -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USERNAME:-postgres}"; do
    sleep 2
  done
  echo "PostgreSQL listo."
fi

# 5. Migraciones y preparación de esquema
if [ "$SKIP_DB_PREPARE" != "true" ]; then
  echo "Ejecutando db:chatwoot_prepare..."
  bundle exec rails db:chatwoot_prepare || echo "db:chatwoot_prepare finalizado."
fi

# 6. Configuración de ip_lookup
echo "Configurando ip_lookup..."
bundle exec rails ip_lookup:setup || true

# 7. Sidekiq en modo combinado
if [ "$RUN_SIDEKIQ" != "false" ]; then
  echo "Iniciando worker Sidekiq en segundo plano..."
  bundle exec sidekiq -C config/sidekiq.yml &
fi

# 8. Arrancar servidor web respetando el puerto $PORT de Railway
APP_PORT="${PORT:-3000}"
echo "Iniciando Rails server en el puerto $APP_PORT..."
exec bundle exec rails s -p "$APP_PORT" -b 0.0.0.0
