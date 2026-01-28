#!/usr/bin/env bash
# exit on error
set -o errexit

# Instalar dependencias
npm install

# Instalar Chrome para Puppeteer (Crucial para el Scraper)
npx puppeteer browsers install chrome

# Rebuild better-sqlite3 para el entorno Linux de Render
npm rebuild better-sqlite3 --build-from-source

echo "✅ Build completado exitosamente"
