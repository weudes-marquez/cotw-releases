# 🎯 COTW Grind Tracker - Supabase Database

## 📦 Arquivos Incluídos

Este pacote contém tudo que você precisa para configurar o banco de dados de estatísticas no Supabase:

### 1️⃣ **supabase_migration.sql**
Script SQL completo para criar toda a estrutura do banco de dados.
- 5 tabelas principais
- Índices para performance
- Triggers automáticos
- Row Level Security (RLS)
- Views úteis

### 2️⃣ **MIGRATION_GUIDE.md**
Guia passo-a-passo de como executar a migração no Supabase.

### 3️⃣ **DATABASE_STRUCTURE.md**
Documentação visual da estrutura do banco com diagrama ER.

### 4️⃣ **supabase_queries.sql**
20+ queries SQL prontas para usar:
- Consultas de estatísticas
- Análises avançadas
- Queries para dashboard
- Manutenção

### 5️⃣ **supabase_integration.ts**
Código TypeScript completo para integração:
- Tipos TypeScript
- Funções CRUD
- React Hooks
- Exemplos de uso

---

## 🚀 Quick Start

### Passo 1: Executar Migração
1. Acesse [Supabase Dashboard](https://supabase.com)
2. Vá em **SQL Editor** → **New Query**
3. Cole o conteúdo de `supabase_migration.sql`
4. Clique em **Run**

### Passo 2: Configurar Variáveis de Ambiente
Adicione ao seu `.env`:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

### Passo 3: Instalar Dependência
```bash
npm install @supabase/supabase-js
```

### Passo 4: Integrar no Código
Copie as funções de `supabase_integration.ts` para seu projeto.

---

## 📊 O Que Será Rastreado

### ✅ Por Sessão de Grind
- Total de abates
- Total de diamantes
- Total de Great Ones
- Total de pelagens raras
- Média de abates para cada tipo

### ✅ Por Pelagem Rara
- Quantidade obtida
- Primeira vez obtida
- Última vez obtida

### ✅ Estatísticas Globais
- Total de sessões
- Animais únicos grindados
- Totais acumulados
- Médias gerais

---

## 🔄 Como Funciona

```
Usuário registra abate
         ↓
Triggers automáticos atualizam:
  • session_statistics
  • rare_fur_statistics
  • grind_sessions
         ↓
Estatísticas disponíveis instantaneamente
```

---

## 📋 Estrutura de Tabelas

1. **user_profiles** - Perfis de usuários
2. **grind_sessions** - Sessões de grind por animal
3. **kill_records** - Registro individual de cada abate
4. **session_statistics** - Estatísticas agregadas (auto-calculadas)
5. **rare_fur_statistics** - Detalhamento de pelagens raras

---

## 🔒 Segurança

- ✅ Row Level Security (RLS) habilitado
- ✅ Usuários só veem seus próprios dados
- ✅ Políticas de acesso configuradas
- ✅ Triggers com permissões adequadas

---

## 📚 Documentação Completa

- **MIGRATION_GUIDE.md** - Como executar a migração
- **DATABASE_STRUCTURE.md** - Estrutura visual do banco
- **supabase_queries.sql** - Queries prontas
- **supabase_integration.ts** - Código de integração

---

## 💡 Exemplo de Uso

```typescript
// Criar sessão
const session = await getOrCreateSession(userId, 'whitetail_deer', 'Whitetail Deer');

// Registrar abate
await registerKill(
  session.id,
  userId,
  'whitetail_deer',
  session.total_kills + 1,
  true, // is_diamond
  false, // is_great_one
  'piebald', // fur_type_id
  'Piebald' // fur_type_name
);

// Buscar estatísticas
const stats = await getSessionStatistics(session.id);
console.log(stats);
// {
//   total_kills: 150,
//   total_diamonds: 3,
//   avg_kills_per_diamond: 50.00
// }
```

---

## 🎯 Próximos Passos

1. ✅ Executar migração no Supabase
2. ✅ Configurar variáveis de ambiente
3. ✅ Integrar código TypeScript
4. ✅ Criar tela de estatísticas no app
5. ✅ Testar fluxo completo

---

**Tudo pronto para rastrear seu grind! 🚀**
