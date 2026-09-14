# ==============================================================================
# Dockerfile de Producción para Chatwoot en Railway
# ==============================================================================
# Basado en la imagen oficial probada y precompilada v4.9.2 de Chatwoot
FROM chatwoot/chatwoot:v4.9.2

USER root

# Copiar script de entrada personalizado para Railway
COPY docker/entrypoints/railway-entrypoint.sh /app/docker/entrypoints/railway-entrypoint.sh
RUN chmod +x /app/docker/entrypoints/railway-entrypoint.sh

# Variables de entorno por defecto para producción
ENV RAILS_ENV=production \
    NODE_ENV=production \
    INSTALLATION_ENV=docker \
    RAILS_SERVE_STATIC_FILES=true \
    RAILS_LOG_TO_STDOUT=true

# Puerto expuesto por defecto (Railway inyecta $PORT en ejecución)
EXPOSE 3000

# Punto de entrada y comando por defecto
ENTRYPOINT ["/app/docker/entrypoints/railway-entrypoint.sh"]
CMD ["bundle", "exec", "rails", "s", "-p", "3000", "-b", "0.0.0.0"]
