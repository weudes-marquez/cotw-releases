# 📥 Como Criar Link de Download do App

Este guia te ensina passo a passo como criar um link de download profissional no GitHub para distribuir seu aplicativo.

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:

- ✅ Repositório criado no GitHub (`grindcounter-win`)
- ✅ Build do app finalizado (`release/win-unpacked/`)
- ✅ Código commitado no repositório

---

## 🎯 Passo a Passo Completo

### 1️⃣ Preparar o ZIP para Distribuição

**No Windows (PowerShell):**

```powershell
# Navegue até a pasta do projeto
cd K:\Desenvolvimento\Antigravity\cotw-always-ontop\CotwElectron

# Entre na pasta release
cd release

# Criar ZIP de todos os arquivos dentro de win-unpacked
Compress-Archive -Path "win-unpacked\*" -DestinationPath "COTW-Grind-Counter-v1.0.0.zip"
```

**Ou manualmente:**
1. Abra a pasta `release/win-unpacked/`
2. Selecione **TODOS** os arquivos e pastas dentro
3. Clique com botão direito → **Enviar para** → **Pasta compactada**
4. Renomeie para: `COTW-Grind-Counter-v1.0.0.zip`

> ⚠️ **IMPORTANTE:** Não compacte a pasta `win-unpacked` inteira! Comprima apenas o **conteúdo** dela.

---

### 2️⃣ Acessar o GitHub

1. Abra seu navegador
2. Vá para: https://github.com/weudes-marquez/grindcounter-win
3. Faça login se necessário

---

### 3️⃣ Criar a Release

1. **No repositório, localize "Releases"** (lado direito da página)

2. **Clique em "Create a new release"** ou **"Draft a new release"**

3. **Preencha os campos:**

   **Tag version:**
   ```
   v1.0.0
   ```
   
   **Target:** 
   ```
   main
   ```
   
   **Release title:**
   ```
   v1.0.0 - Initial Release
   ```

4. **Descrição (copie e cole):**

```markdown
# 🎯 COTW Grind Counter - Primeira Versão

Rastreie seus grinds no theHunter: Call of the Wild com facilidade!

## ✨ Funcionalidades

- ✅ Contador de abates em tempo real
- ✅ Rastreamento de diamantes e great ones
- ✅ Pelagens raras catalogadas
- ✅ Estatísticas completas por animal
- ✅ Atalhos globais (funcionam sobrepondo o jogo):
  - `Ctrl+Shift+=` - Incrementar (+1)
  - `Ctrl+Shift+-` - Decrementar (-1)
  - `Ctrl+Shift+S` - Abrir estatísticas
- ✅ Sincronização automática (Firebase + Supabase)
- ✅ Always-on-top (fica sempre visível)

## 📥 Como Instalar

1. Baixe o arquivo ZIP abaixo
2. Extraia para uma pasta de sua escolha
3. Execute `COTW Pin Planner - Grind Counter.exe`
4. Faça login com sua conta

> **Não requer instalação!** É um aplicativo portátil.

## ⚙️ Requisitos

- **Sistema:** Windows 10/11 (64-bit)
- **RAM:** 4GB mínimo
- **Espaço:** ~500MB
- **Internet:** Necessária para sincronização
- **Conta:** [COTW Pin Planner](https://cotwpinplanner.app)

## 🎮 Uso Rápido

1. Selecione o animal que está grindando
2. Use botões ou atalhos para contar abates
3. Marque diamantes/great ones quando conseguir
4. Veja estatísticas completas no botão de gráfico
5. Encerre a sessão quando terminar

---

**Tamanho:** ~150MB (compactado) | ~450MB (extraído)
```

---

### 4️⃣ Anexar o Arquivo ZIP

1. **Localize a área "Attach binaries by dropping them here"**
2. **Arraste** o arquivo `COTW-Grind-Counter-v1.0.0.zip` para essa área
3. **Ou clique** para selecionar manualmente
4. Aguarde o upload completar (barra de progresso verde)

---

### 5️⃣ Publicar a Release

1. ✅ **Marque** a opção "Set as the latest release"
2. (Opcional) Marque "Create a discussion for this release"
3. **Clique** no botão verde **"Publish release"**

---

## 🎉 Pronto! Link Criado!

Após publicar, você terá **2 tipos de links**:

### 🔗 Link da Página da Release (Recomendado)
```
https://github.com/weudes-marquez/grindcounter-win/releases/latest
```
**Use este** para compartilhar com amigos! Mostra informações e botão de download.

### 📦 Link Direto do Arquivo
```
https://github.com/weudes-marquez/grindcounter-win/releases/download/v1.0.0/COTW-Grind-Counter-v1.0.0.zip
```
Download automático ao clicar (sem página intermediária).

---

## 📤 Como Compartilhar

**Opção 1 - Link Curto (WhatsApp, Discord):**
```
Baixe o COTW Grind Counter aqui:
https://github.com/weudes-marquez/grindcounter-win/releases/latest
```

**Opção 2 - Mensagem Completa:**
```
🎯 COTW Grind Counter - Rastreie seus grinds!

Contador de abates com estatísticas completas para theHunter: Call of the Wild.

✨ Features:
- Contador em tempo real
- Atalhos globais
- Estatísticas detalhadas
- Sincronização automática

📥 Download:
https://github.com/weudes-marquez/grindcounter-win/releases/latest

⚙️ Windows 10/11 | Portátil (não requer instalação)
```

---

## 🔄 Atualizações Futuras

Para lançar versão v1.0.1, v1.1.0, etc:

1. Faça as alterações no código
2. Commit e push para GitHub
3. Faça novo build: `npm run build:win`
4. Crie novo ZIP com novo nome: `COTW-Grind-Counter-v1.0.1.zip`
5. Crie **nova release** com **nova tag** (v1.0.1)
6. Anexe o novo ZIP
7. Escreva changelog do que mudou
8. Publique

O link `/latest` sempre aponta para a versão mais recente automaticamente! 🚀

---

## ❓ Dúvidas Comuns

**P: O repositório precisa ser público?**  
R: Não! Mesmo em repo privado, as releases podem ser públicas.

**P: Posso deletar releases antigas?**  
R: Sim, mas mantenha pelo menos as últimas 2-3 versões.

**P: Quanto espaço tenho para releases?**  
R: Ilimitado no GitHub! Cada arquivo pode ter até 2GB.

**P: Como rastrear quantos downloads?**  
R: Na página da release, abaixo do ZIP mostra contador de downloads.

**P: Posso editar a descrição depois?**  
R: Sim! Clique em "Edit release" na página da release.

---

## 🎯 Checklist Final

Antes de compartilhar, verifique:

- [ ] ZIP foi testado (extrair e executar .exe)
- [ ] Descrição da release está completa
- [ ] Versão está correta (v1.0.0)
- [ ] Marcou "Set as latest release"
- [ ] Links estão funcionando
- [ ] README do repo está atualizado

---

**🎉 Parabéns! Seu app está pronto para distribuição!**

Compartilhe o link e acompanhe os downloads na página da release.
