# 📦 Como Publicar uma Release no GitHub

## Passo a Passo:

### 1. Fazer o Build

```bash
cd CotwElectron
npm run build:win
```

Isso gera: `release/win-unpacked/`

### 2. Criar ZIP para Distribuição

```bash
# Windows (PowerShell)
Compress-Archive -Path "release\win-unpacked\*" -DestinationPath "COTW-Grind-Counter-v1.0.0.zip"

# Ou comprima manualmente a pasta win-unpacked
```

### 3. Publicar no GitHub

1. **Ir para Releases:**
   - No GitHub, vá para o repo
   - Clique em "Releases" (lado direito)
   - Clique "Create a new release"

2. **Criar Tag:**
   - Tag version: `v1.0.0`
   - Target: `main`
   - Release title: `v1.0.0 - Initial Release`

3. **Adicionar Descrição:**
   ```markdown
   ## 🎯 Features
   - ✅ Kill counter with statistics
   - ✅ Track diamonds, great ones, and rare furs
   - ✅ Global hotkeys support
   - ✅ Always-on-top mode
   
   ## 📥 Installation
   1. Download the ZIP file below
   2. Extract to a folder
   3. Run "COTW Pin Planner - Grind Counter.exe"
   
   ## ⚙️ Requirements
   - Windows 10/11
   - Internet connection for sync
   ```

4. **Anexar ZIP:**
   - Arraste o ZIP para "Attach binaries"
   - Ou clique para selecionar

5. **Publicar:**
   - Marque "Set as the latest release"
   - Clique "Publish release"

### 4. Link de Download

Após publicar, o link será:
```
https://github.com/SEU-USUARIO/REPO-NAME/releases/download/v1.0.0/COTW-Grind-Counter-v1.0.0.zip
```

Ou o link genérico para última versão:
```
https://github.com/SEU-USUARIO/REPO-NAME/releases/latest
```

## 🔄 Próximas Versões

Para versões futuras (v1.0.1, v1.1.0, etc.):

1. Faça o build
2. Crie nova Release com nova tag
3. Anexe novo ZIP
4. Marque "Set as latest release"

## 💡 Dicas:

- Use **versionamento semântico**: v1.0.0 (major.minor.patch)
- Sempre escreva **changelog** (o que mudou)
- Teste o ZIP antes de publicar
- Mantenha releases antigas para histórico
