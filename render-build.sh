#!/usr/bin/env bash
# exit on error
set -o errexit

# Limpiar cache de node_modules
rm -rf node_modules

# Instalar dependencias
npm install

# Rebuild better-sqlite3 específicamente para Linux
npm rebuild better-sqlite3 --build-from-source

# Instalar Chrome para Puppeteer
./node_modules/.bin/puppeteer browsers install chrome

echo "✅ Build completado exitosamente"
