#!/bin/bash

# Script para remover arquivo problemático supabaseLogger.ts
# Este arquivo está causando erros de compilação e não é mais necessário

echo "🔍 Procurando arquivos problemáticos..."

# Remover supabaseLogger.ts se existir
if [ -f "src/utils/supabaseLogger.ts" ]; then
    echo "🗑️  Removendo src/utils/supabaseLogger.ts..."
    rm -f "src/utils/supabaseLogger.ts"
    echo "✅ Arquivo removido!"
else
    echo "✅ supabaseLogger.ts não encontrado (OK)"
fi

# Verificar se há outros arquivos Logger
find src -name "*Logger.ts" -o -name "*logger.ts" 2>/dev/null | while read file; do
    echo "⚠️  Encontrado: $file"
    echo "   Execute: rm -f \"$file\" para remover"
done

echo ""
echo "✅ Limpeza concluída!"
echo "📦 Agora execute: npm install --legacy-peer-deps"
echo "🔨 E depois: npm run build:win"
