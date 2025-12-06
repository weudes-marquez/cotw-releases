# 🚀 Setup Rápido - COTW Grind Tracker

## ⚡ Passos para Rodar o Aplicativo

### 1. **Copiar arquivo de configuração**

**Windows PowerShell:**
```powershell
cd CotwElectron
Copy-Item .env.example .env
```

**Windows CMD:**
```cmd
cd CotwElectron
copy .env.example .env
```

**Manualmente (qualquer SO):**
1. Vá na pasta `CotwElectron`
2. Copie `.env.example`
3. Cole e renomeie para `.env`

### 2. **Instalar dependências**
```bash
npm install
```

### 3. **Rodar em desenvolvimento**
```bash
npm run dev
```

## 🎯 Já Configurado

✅ **Firebase** - Autenticação e animais  
✅ **Supabase** - Configurado e pronto (URL e chave já no `.env.example`)  
✅ **Sanitização** - Proteção XSS ativa  
✅ **CSP Headers** - Segurança configurada

## 📊 Para Usar Estatísticas (Opcional)

1. **Execute a migração do banco**
   - Abra [Supabase Dashboard](https://supabase.com)
   - Vá em **SQL Editor**
   - Cole o conteúdo de `supabase_migration.sql`
   - Clique em **Run**

2. **Instale o pacote Supabase**
   ```bash
   npm install @supabase/supabase-js
   ```

3. **Pronto!** O sistema de estatísticas estará ativo

---

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Build executável Windows
npm run build:win

# Criar ZIP
npm run zip
```

---

## ✅ Checklist de Primeira Execução

- [ ] Copiar `.env.example` para `.env`
- [ ] Executar `npm install`
- [ ] Executar `npm run dev`
- [ ] Fazer login no app
- [ ] Testar contador

## 🆘 Problemas Comuns

**Tela azul/branca?**
- Verifique se o `.env` existe
- Execute `npm install` novamente
- Limpe cache: `rm -rf node_modules .vite dist-electron`

**Erro de autenticação?**
- Verifique credenciais no `.env`
- Verifique conexão com internet

---

**Tudo pronto para usar! 🎯**
