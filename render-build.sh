#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
npm rebuild better-sqlite3

# Install Puppeteer dependencies for Linux (Render)
# This is usually not possible on the free tier via shell, 
# but installing chromium-browser via apt sometimes works if it was a Dockerfile.
# On Render Native Node environment, we rely on the puppeteer's own browser download.

# IMPORTANT: We need to tell Puppeteer where the cache is
# export PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer

# Clear old cache
# rm -rf /opt/render/project/src/.cache/puppeteer

./node_modules/.bin/puppeteer browsers install chrome
