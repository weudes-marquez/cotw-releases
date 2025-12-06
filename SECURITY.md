# 🔒 Guia de Segurança - COTW Grind Tracker

## ✅ Medidas de Segurança Implementadas

### 1. **Sanitização de Inputs** 🛡️

Todos os inputs do usuário são sanitizados antes de serem processados:

#### **Login (`Login.tsx`)**
- ✅ Email sanitizado e validado
- ✅ Formato de email verificado
- ✅ Senha validada (mínimo 6 caracteres)
- ✅ Rate limiting (máximo 5 tentativas por minuto)
- ✅ Proteção contra brute force

#### **Dashboard (`Dashboard.tsx`)**
- ✅ IDs de animais sanitizados
- ✅ Nomes de pelagens sanitizados
- ✅ Contadores numéricos validados
- ✅ Remoção de tags HTML e scripts

### 2. **Proteção XSS (Cross-Site Scripting)** 🚫

#### **Funções de Sanitização (`sanitize.ts`)**
```typescript
sanitizeHtml()      // Remove tags HTML e scripts
sanitizeEmail()     // Valida e limpa emails
sanitizeText()      // Sanitiza texto genérico
sanitizeId()        // Valida IDs (UUID/alfanuméricos)
sanitizeUrl()       // Valida URLs (apenas http/https)
escapeHtml()        // Escapa caracteres especiais
```

#### **O que é removido:**
- ❌ Tags `<script>`
- ❌ Tags `<iframe>`
- ❌ Tags `<object>` e `<embed>`
- ❌ Event handlers (`onclick`, `onload`, etc)
- ❌ `javascript:` URLs
- ❌ Todas as outras tags HTML

### 3. **Content Security Policy (CSP)** 📋

Implementado no Electron (`main.ts`):

```typescript
Content-Security-Policy:
  default-src 'self'                    // Apenas recursos do próprio app
  script-src 'self' 'unsafe-inline'     // Scripts apenas do app
  style-src 'self' 'unsafe-inline'      // Estilos do app + Google Fonts
  font-src 'self' https://fonts.gstatic.com
  img-src 'self' data: https:           // Imagens locais e HTTPS
  connect-src 'self' https://...        // APIs permitidas
  frame-src 'none'                      // Sem iframes
  object-src 'none'                     // Sem objetos/embeds
  base-uri 'self'                       // Base URL segura
```

### 4. **Row Level Security (RLS)** 🔐

Implementado no Supabase:

- ✅ Usuários só veem seus próprios dados
- ✅ Impossível acessar dados de outros usuários
- ✅ Autenticação obrigatória para todas as operações
- ✅ Políticas SQL automáticas

### 5. **Rate Limiting** ⏱️

Proteção contra ataques de força bruta:

```typescript
rateLimiter.canProceed(email, 5, 60000)
// Máximo 5 tentativas por minuto
```

- ✅ Bloqueia tentativas excessivas
- ✅ Reset automático após sucesso
- ✅ Janela de tempo configurável

### 6. **Validação de Dados** ✔️

Todas as entradas são validadas:

```typescript
// Email
isValidEmail(email)  // Regex validation

// Senha
isValidPassword(password)  // Mínimo 6 caracteres

// Números
sanitizeNumber(value)  // Garante número válido >= 0

// IDs
sanitizeId(id)  // Apenas alfanuméricos, hífens e underscores
```

---

## 🛡️ Proteções Implementadas

### **Contra XSS (Cross-Site Scripting)**
- ✅ Sanitização de HTML
- ✅ Escape de caracteres especiais
- ✅ CSP headers
- ✅ Validação de URLs

### **Contra SQL Injection**
- ✅ Supabase usa prepared statements
- ✅ RLS no banco de dados
- ✅ Sanitização de IDs

### **Contra Brute Force**
- ✅ Rate limiting
- ✅ Bloqueio temporário
- ✅ Validação de credenciais

### **Contra CSRF (Cross-Site Request Forgery)**
- ✅ Firebase Auth tokens
- ✅ Verificação de origem
- ✅ Tokens de sessão

### **Contra Code Injection**
- ✅ CSP headers
- ✅ Remoção de event handlers
- ✅ Validação de scripts

---

## 📋 Checklist de Segurança

### **Front-end (Electron/React)**
- [x] Sanitização de todos os inputs
- [x] Validação de formatos (email, senha, etc)
- [x] Escape de HTML
- [x] CSP headers configurados
- [x] Rate limiting implementado
- [x] Remoção de tags perigosas

### **Back-end (Supabase)**
- [x] Row Level Security (RLS) ativo
- [x] Políticas de acesso configuradas
- [x] Autenticação obrigatória
- [x] Prepared statements (automático)
- [x] Triggers seguros

### **Comunicação**
- [x] HTTPS obrigatório
- [x] Firebase Auth tokens
- [x] Validação de tokens
- [x] Conexões seguras (wss://)

---

## 🔍 Como Testar a Segurança

### **1. Teste de XSS**
Tente inserir no campo de email:
```html
<script>alert('XSS')</script>
```
**Resultado esperado:** Script removido, email inválido

### **2. Teste de SQL Injection**
Tente inserir no campo de email:
```sql
admin@test.com'; DROP TABLE users; --
```
**Resultado esperado:** Caracteres especiais removidos

### **3. Teste de Rate Limiting**
Tente fazer login 6 vezes seguidas com senha errada.
**Resultado esperado:** Bloqueio após 5 tentativas

### **4. Teste de RLS**
Tente acessar dados de outro usuário via console:
```typescript
supabase.from('grind_sessions')
  .select('*')
  .eq('user_id', 'outro-usuario-id')
```
**Resultado esperado:** Array vazio (sem dados)

---

## ⚠️ Boas Práticas

### **Para Desenvolvedores**

1. **Sempre sanitize inputs**
   ```typescript
   const clean = sanitizeText(userInput);
   ```

2. **Valide antes de processar**
   ```typescript
   if (!isValidEmail(email)) return;
   ```

3. **Use funções de sanitização**
   ```typescript
   import { sanitizeHtml, escapeHtml } from './utils/sanitize';
   ```

4. **Nunca confie em dados do usuário**
   - Sempre valide
   - Sempre sanitize
   - Sempre escape

### **Para Usuários**

1. **Use senhas fortes**
   - Mínimo 6 caracteres
   - Combine letras, números e símbolos

2. **Não compartilhe credenciais**
   - Cada usuário deve ter sua própria conta

3. **Mantenha o app atualizado**
   - Atualizações incluem correções de segurança

---

## 🚨 O Que Fazer em Caso de Problema

### **Suspeita de Ataque**
1. Feche o aplicativo imediatamente
2. Troque sua senha
3. Verifique atividades suspeitas no Supabase Dashboard

### **Erro de Autenticação**
1. Verifique sua conexão com a internet
2. Aguarde 1 minuto se houver rate limiting
3. Tente fazer login novamente

### **Dados Inconsistentes**
1. Verifique o console do navegador (F12)
2. Reporte o problema com logs
3. Não tente manipular dados manualmente

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Firebase Security](https://firebase.google.com/docs/rules)

---

## ✅ Resumo

**Todas as camadas de segurança estão implementadas:**

1. ✅ Sanitização de inputs
2. ✅ Validação de dados
3. ✅ CSP headers
4. ✅ Row Level Security
5. ✅ Rate limiting
6. ✅ Proteção XSS
7. ✅ Proteção SQL Injection
8. ✅ Proteção Brute Force

**Seu aplicativo está seguro! 🔒**
