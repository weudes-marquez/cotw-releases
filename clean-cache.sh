#!/bin/bash

echo "🧹 Limpando TODOS os caches e builds..."

# Para o servidor se estiver rodando
pkill -f "vite" 2>/dev/null || true
pkill -f "electron" 2>/dev/null || true

# Remove node_modules/.vite
echo "Removendo node_modules/.vite..."
rm -rf node_modules/.vite

# Remove dist e dist-electron
echo "Removendo builds antigos..."
rm -rf dist
rm -rf dist-electron

# Remove cache do Vite global
echo "Removendo cache global do Vite..."
rm -rf ~/.vite

# Limpa cache do npm/yarn
echo "Limpando cache do yarn..."
yarn cache clean

echo "✅ Limpeza completa! Agora rode: yarn dev"
