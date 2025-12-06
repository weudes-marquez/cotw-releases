# Como Configurar o Ícone Personalizado

## Passo a Passo:

1. **Copie o ícone:**
   - Copie: `K:\Desenvolvimento\firebase-apps\cotw-pin-planner\logo\icon-256x256.png`
   - Cole em: `CotwElectron\build\icon.png`
   
   ⚠️ **Importante:** Renomeie de `icon-256x256.png` para `icon.png`

2. **Estrutura de pastas deve ficar assim:**
   ```
   CotwElectron/
   ├── build/
   │   └── icon.png  ← Seu ícone aqui
   ├── src/
   ├── package.json
   └── ...
   ```

3. **Pronto!** O Electron Builder vai automaticamente:
   - Gerar `.ico` para Windows
   - Gerar `.icns` para macOS
   - Usar `.png` para Linux

## Para testar o app compilado:

```bash
cd CotwElectron
yarn build:win
```

O executável final estará em `CotwElectron/release/` com seu ícone personalizado!

## Observações:

- O `package.json` já está configurado para usar `build/icon.png`
- Você só precisa copiar o arquivo para a pasta `build`
- Se quiser um ícone maior/melhor qualidade, use 512x512 ou 1024x1024 pixels
