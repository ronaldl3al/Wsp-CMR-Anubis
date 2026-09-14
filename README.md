# Chatwoot CRM + WhatsApp Evolution API (Anubis Store)

Este repositorio contiene la plataforma oficial **Chatwoot v4.9.2** configurada y optimizada para su despliegue en **Railway**, con integración nativa directa a **Evolution API** (`ANUBIS STORE`) para atención omnicanal de WhatsApp Business multiagente.

---

## 🚀 Arquitectura y Componentes

```
┌────────────────────────────────────────────────────────┐
│                   WhatsApp Network                     │
└──────────────────────────┬─────────────────────────────┘
                           │ Webhooks & Mensajes
┌──────────────────────────▼─────────────────────────────┐
│       Evolution API v2.3.7 (Railway)                   │
│       Instancia: ANUBIS STORE                          │
└──────────────────────────┬─────────────────────────────┘
                           │ /chatwoot/set & API
┌──────────────────────────▼─────────────────────────────┐
│       Chatwoot Web + Sidekiq (Railway Container)       │
│       - Rails 7 + ActionCable (WebSockets)             │
│       - Bandeja Multiagente, Contactos y Etiquetas     │
│       - Respuestas Rápidas y Notas de Conversación     │
└────────────┬─────────────────────────────┬─────────────┘
             │                             │
┌────────────▼──────────────┐ ┌────────────▼─────────────┐
│  PostgreSQL 16 + pgvector │ │       Redis Alpine       │
│  (Base de Datos Railway)  │ │  (Colas & Realtime Pub)  │
└───────────────────────────┘ └──────────────────────────┘
```

---

## 📦 Despliegue en Railway

### 1. Requisitos Previos en tu Proyecto de Railway
Chatwoot requiere dos servicios auxiliares (disponibles con 1 clic en Railway):
1. **PostgreSQL**: Añadir servicio -> Database -> Add PostgreSQL (con soporte para extensiones).
2. **Redis**: Añadir servicio -> Database -> Add Redis.

### 2. Variables de Entorno en el Servicio de Chatwoot
Configura las siguientes variables en la pestaña **Variables** de tu servicio en Railway (ver `.env.railway.example`):

| Variable | Valor / Descripción |
| :--- | :--- |
| `RAILS_ENV` | `production` |
| `SECRET_KEY_BASE` | Una cadena hexadecimal aleatoria de 64 caracteres |
| `FRONTEND_URL` | La URL de Railway de este servicio (ej. `https://wsp-cmr-anubis-production.up.railway.app`) |
| `ENABLE_ACCOUNT_SIGNUP` | `true` (para registrar el primer usuario admin) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (enlace automático a PostgreSQL) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (enlace automático a Redis) |
| `RUN_SIDEKIQ` | `true` (ejecuta el worker en segundo plano dentro del mismo contenedor) |

---

## 🔗 Vinculación con Evolution API (`ANUBIS STORE`)

Una vez que Chatwoot esté en línea:
1. Accede a tu URL de Chatwoot y completa el registro del administrador inicial.
2. Ve a **Perfil (esquina inferior izquierda) -> Configuración de Perfil**.
3. Baja hasta la sección **Tokens de Acceso** y copia tu Token de API.
4. Ejecuta el script de vinculación automática:
   ```bash
   node scripts/setup_evolution_chatwoot.js
   ```
   El script creará automáticamente la bandeja `ANUBIS STORE` en Chatwoot, configurará el webhook de salida y comenzará a sincronizar tus chats y contactos de WhatsApp.

---

## 🛡️ Control de Versiones y Despliegue
- **Regla Estricta**: No realizar `git push origin main` hasta que la base de datos PostgreSQL y Redis estén listas y confirmadas en Railway para evitar errores de despliegue en frío.
