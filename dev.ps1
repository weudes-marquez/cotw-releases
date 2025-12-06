# dev.ps1
Write-Host "Limpando caches do Electron..." -ForegroundColor Cyan

# Apaga só os caches (nunca o node_modules inteiro)
@("node_modules\.cache", "dist", ".vite", ".webpack", "build") | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item $_ -Recurse -Force
        Write-Host "  ✓ Apagado: $_" -ForegroundColor Green
    }
}

Write-Host "`nIniciando o app sem nenhum cache..." -ForegroundColor Cyan

# As flags que realmente matam o problema de mudanças não aparecerem
electron . --no-cache --disable-http-cache --aggressive-cache-discard --disable-features=OutOfBlinkCors

Write-Host "`nPronto! Fechando em 3 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 3