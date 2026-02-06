#!/usr/bin/env bash
# exit on error
set -o errexit

echo "🚀 Iniciando construcción optimizada..."

# Usar npm install es más seguro si hay desincronización de lockfile
npm install

# Instalar Chrome solo si no está en caché (esto ahorra mucho tiempo)
if [ ! -d "$PUPPETEER_CACHE_DIR" ]; then
  echo "📥 Instalando Chrome por primera vez..."
  npx puppeteer browsers install chrome
else
  echo "✅ Chrome ya está en caché, saltando instalación."
fi

# Rebuild rápido
npm rebuild better-sqlite3 --build-from-source

echo "✅ Build completado exitosamente"
