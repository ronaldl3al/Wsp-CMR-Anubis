#!/bin/bash
set -e

echo "Starting Whaticket Community Railway container..."

# 1. Run database migrations
echo "Running database migrations..."
npx sequelize db:migrate

# 2. Run seeds (will create default users, etc. if they don't exist)
echo "Running database seeds..."
npx sequelize db:seed:all || true # Ignore seed errors if already seeded

# 3. Start the application
echo "Starting application server..."
exec node dist/server.js
