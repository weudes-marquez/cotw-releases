# 🔍 Guia de Monitoramento e Diagnóstico - Supabase

## 📊 Como Verificar se o Banco Está Funcionando

### **Método 1: Console do Navegador (Mais Fácil)** 🖥️

1. **Abra o DevTools**
   - Pressione `F12` ou `Ctrl+Shift+I`
   - Vá na aba **Console**

2. **Execute Diagnóstico Completo**
   ```javascript
   await runDiagnostics()
   ```

   **Resultado esperado:**
   ```
   ℹ️ [INFO] Running full diagnostics
   ✅ [SUCCESS] Connection test successful
   ✅ [SUCCESS] User authenticated
   ✅ [SUCCESS] Table user_profiles accessible
   ✅ [SUCCESS] Table grind_sessions accessible
   ✅ [SUCCESS] Table kill_records accessible
   ✅ [SUCCESS] Table session_statistics accessible
   ✅ [SUCCESS] Table rare_fur_statistics accessible
   ℹ️ [INFO] Diagnostics complete
   ```

3. **Testar Conexão Simples**
   ```javascript
   await testSupabaseConnection()
   // Retorna: true (conectado) ou false (erro)
   ```

4. **Ver Logs Completos**
   ```javascript
   supabaseLogger.getLogs()
   // Retorna array com todos os logs
   ```

5. **Baixar Logs**
   ```javascript
   downloadLogs()
   // Baixa arquivo JSON com todos os logs
   ```

---

### **Método 2: Logs Automáticos no Console** 📝

Todas as operações do Supabase são automaticamente logadas:

#### **Exemplo de SELECT:**
```
ℹ️ [INFO] SELECT from grind_sessions (0ms)
✅ [SUCCESS] SELECT from grind_sessions successful (45ms)
  { rowCount: 3 }
```

#### **Exemplo de INSERT:**
```
ℹ️ [INFO] INSERT into kill_records (0ms)
✅ [SUCCESS] INSERT into kill_records successful (120ms)
  { id: "550e8400-e29b-41d4-a716-446655440000" }
```

#### **Exemplo de ERRO:**
```
❌ [ERROR] SELECT from grind_sessions failed (89ms)
  { code: "PGRST116", message: "No rows found" }
```

---

### **Método 3: Componente de Status** ⚡

Use o hook React no seu componente:

```typescript
import { useSupabaseStatus } from '../utils/supabaseLogger';

function MyComponent() {
  const { connected, authenticated, loading, error, refresh } = useSupabaseStatus();

  if (loading) return <div>Verificando conexão...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <p>Conexão: {connected ? '✅' : '❌'}</p>
      <p>Autenticado: {authenticated ? '✅' : '❌'}</p>
      <button onClick={refresh}>Atualizar</button>
    </div>
  );
}
```

---

## 🎯 **Funções Disponíveis**

### **Diagnóstico**

| Função | Descrição | Retorno |
|--------|-----------|---------|
| `runDiagnostics()` | Diagnóstico completo | Objeto com status |
| `testSupabaseConnection()` | Testa conexão | boolean |
| `checkAuthStatus()` | Verifica autenticação | { authenticated, user } |

### **Logging**

| Função | Descrição |
|--------|-----------|
| `supabaseLogger.getLogs()` | Retorna todos os logs |
| `supabaseLogger.clearLogs()` | Limpa logs |
| `supabaseLogger.exportLogs()` | Exporta logs como JSON |
| `downloadLogs()` | Baixa arquivo de logs |

### **Operações com Logging**

Use estas funções em vez das do Supabase direto:

```typescript
import { 
  supabaseSelect, 
  supabaseInsert, 
  supabaseUpdate, 
  supabaseDelete 
} from '../utils/supabaseLogger';

// SELECT
const { data, error } = await supabaseSelect('grind_sessions', {
  eq: { user_id: userId },
  order: { column: 'start_date', ascending: false },
  limit: 10
});

// INSERT
const { data, error } = await supabaseInsert('kill_records', {
  session_id: sessionId,
  user_id: userId,
  kill_number: 1,
  is_diamond: true
});

// UPDATE
const { data, error } = await supabaseUpdate('grind_sessions', sessionId, {
  total_kills: 50
});

// DELETE
const { error } = await supabaseDelete('kill_records', killId);
```

---

## 🔍 **Interpretando os Logs**

### **Níveis de Log**

| Emoji | Nível | Significado |
|-------|-------|-------------|
| ℹ️ | INFO | Operação iniciada |
| ✅ | SUCCESS | Operação bem-sucedida |
| ⚠️ | WARNING | Aviso (não crítico) |
| ❌ | ERROR | Erro na operação |
| 🔍 | DEBUG | Informação de debug |

### **Tempo de Resposta**

```
✅ [SUCCESS] SELECT from grind_sessions successful (45ms)
                                                    ↑
                                            Tempo em milissegundos
```

- **< 100ms**: Excelente ⚡
- **100-500ms**: Bom ✅
- **500-1000ms**: Aceitável ⚠️
- **> 1000ms**: Lento 🐌

---

## 🚨 **Troubleshooting**

### **Problema: "Connection test failed"**

**Possíveis causas:**
1. Variáveis de ambiente não configuradas
2. URL do Supabase incorreta
3. Chave de API inválida
4. Sem conexão com internet

**Solução:**
```javascript
// Verificar variáveis
console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Devem retornar valores válidos, não undefined
```

### **Problema: "Not authenticated"**

**Solução:**
```javascript
// Verificar status de autenticação
await checkAuthStatus();

// Se não autenticado, fazer login novamente
```

### **Problema: "Table access failed"**

**Possíveis causas:**
1. RLS bloqueando acesso
2. Tabela não existe
3. Usuário sem permissão

**Solução:**
```javascript
// Verificar se tabela existe no Supabase Dashboard
// Verificar políticas RLS
// Verificar se usuário está autenticado
```

### **Problema: Operações lentas (> 1000ms)**

**Possíveis causas:**
1. Muitos dados sendo retornados
2. Sem índices nas colunas
3. Conexão lenta

**Solução:**
```javascript
// Adicionar limit às queries
const { data } = await supabaseSelect('grind_sessions', {
  limit: 50 // Limitar resultados
});

// Verificar índices no Supabase Dashboard
```

---

## 📊 **Exemplo de Diagnóstico Completo**

```javascript
// 1. Executar diagnóstico
const results = await runDiagnostics();

console.log('Conexão:', results.connection ? '✅' : '❌');
console.log('Autenticação:', results.authentication ? '✅' : '❌');
console.log('Tabelas:');
Object.entries(results.tables).forEach(([table, accessible]) => {
  console.log(`  ${table}: ${accessible ? '✅' : '❌'}`);
});

// 2. Ver logs detalhados
const logs = supabaseLogger.getLogs();
console.log(`Total de operações: ${logs.length}`);

// 3. Filtrar apenas erros
const errors = logs.filter(log => log.level === 'ERROR');
console.log(`Erros encontrados: ${errors.length}`);
errors.forEach(error => {
  console.error(error.operation, error.details);
});

// 4. Calcular tempo médio de resposta
const avgTime = logs
  .filter(log => log.duration)
  .reduce((sum, log) => sum + (log.duration || 0), 0) / logs.length;
console.log(`Tempo médio: ${avgTime.toFixed(2)}ms`);
```

---

## 🎯 **Checklist de Verificação**

Antes de reportar um problema, verifique:

- [ ] Variáveis de ambiente configuradas (`.env`)
- [ ] Conexão com internet ativa
- [ ] Usuário autenticado
- [ ] Tabelas criadas no Supabase
- [ ] RLS configurado corretamente
- [ ] Logs não mostram erros críticos

---

## 💡 **Dicas**

1. **Mantenha o Console aberto** durante desenvolvimento
2. **Execute diagnóstico** após cada mudança importante
3. **Baixe logs** antes de reportar bugs
4. **Monitore tempo de resposta** para otimizar queries
5. **Limpe logs** periodicamente para melhor performance

---

## 📞 **Comandos Rápidos**

```javascript
// Diagnóstico rápido
await runDiagnostics()

// Ver últimos 10 logs
supabaseLogger.getLogs().slice(-10)

// Contar erros
supabaseLogger.getLogs().filter(l => l.level === 'ERROR').length

// Baixar logs
downloadLogs()

// Limpar logs
supabaseLogger.clearLogs()
```

---

**Tudo pronto para monitorar seu banco de dados! 🚀**
