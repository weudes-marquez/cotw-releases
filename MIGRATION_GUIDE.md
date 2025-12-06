# 📊 Guia de Migração - COTW Grind Tracker Database

## 🚀 Como Executar a Migração

### Passo 1: Acessar o Supabase
1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login na sua conta
3. Selecione seu projeto COTW

### Passo 2: Abrir o SQL Editor
1. No menu lateral, clique em **SQL Editor**
2. Clique no botão **New Query**

### Passo 3: Executar a Migração
1. Abra o arquivo `supabase_migration.sql`
2. Copie **TODO** o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (ou pressione `Ctrl+Enter`)

### Passo 4: Verificar Sucesso
Você verá mensagens de sucesso no console:
```
✅ Migration completed successfully!
📊 Tables created: user_profiles, grind_sessions, kill_records, session_statistics, rare_fur_statistics
🔒 RLS policies enabled for all tables
⚡ Triggers configured for automatic statistics updates
🎯 Ready to track your COTW grind!
```

---

## 📋 Estrutura Criada

### Tabelas
1. **user_profiles** - Perfis de usuários
2. **grind_sessions** - Sessões de grind por animal
3. **kill_records** - Registro individual de cada abate
4. **session_statistics** - Estatísticas agregadas (auto-calculadas)
5. **rare_fur_statistics** - Detalhamento de pelagens raras

### Recursos Automáticos
- ✅ **Triggers** que atualizam estatísticas automaticamente
- ✅ **Cálculo de médias** em tempo real
- ✅ **RLS (Row Level Security)** para segurança dos dados
- ✅ **Índices** para performance otimizada

---

## 🔍 Como Funciona

### Fluxo de Dados

```
1. Usuário faz login
   ↓
2. Cria/seleciona uma sessão de grind (grind_sessions)
   ↓
3. A cada abate, registra em kill_records
   ↓
4. Triggers atualizam automaticamente:
   - session_statistics (totais e médias)
   - rare_fur_statistics (se for pelagem rara)
   - grind_sessions (total_kills)
```

### Exemplo de Uso

#### 1. Criar uma sessão de grind
```typescript
const { data: session } = await supabase
  .from('grind_sessions')
  .insert({
    user_id: userId,
    animal_id: 'whitetail_deer',
    animal_name: 'Whitetail Deer'
  })
  .select()
  .single();
```

#### 2. Registrar um abate
```typescript
const { data: kill } = await supabase
  .from('kill_records')
  .insert({
    session_id: sessionId,
    user_id: userId,
    animal_id: 'whitetail_deer',
    kill_number: currentKillCount + 1,
    is_diamond: true,
    is_great_one: false,
    fur_type_id: 'piebald',
    fur_type_name: 'Piebald'
  });
```

#### 3. Buscar estatísticas
```typescript
const { data: stats } = await supabase
  .from('user_grind_summary')
  .select('*')
  .eq('user_id', userId)
  .eq('animal_id', 'whitetail_deer')
  .single();

// Retorna:
// {
//   total_kills: 150,
//   total_diamonds: 3,
//   total_great_ones: 0,
//   total_rare_furs: 5,
//   avg_kills_per_diamond: 50.00,
//   avg_kills_per_rare_fur: 30.00
// }
```

---

## 📊 Queries Úteis

Veja o arquivo `supabase_queries.sql` para queries prontas de:
- Buscar estatísticas de uma sessão
- Listar pelagens raras obtidas
- Histórico completo de grind
- Ranking de animais mais grindados
- E muito mais!

---

## 🔒 Segurança

### RLS (Row Level Security)
Todas as tabelas têm RLS habilitado, garantindo que:
- ✅ Usuários só veem seus próprios dados
- ✅ Usuários só podem inserir/atualizar seus próprios registros
- ✅ Triggers do sistema funcionam normalmente

### Políticas Implementadas
- `Users can view own profile`
- `Users can view own sessions`
- `Users can insert own kills`
- E outras políticas de segurança

---

## ⚠️ Importante

1. **Execute a migração UMA ÚNICA VEZ**
2. **Não delete as tabelas manualmente** (use CASCADE se necessário)
3. **Triggers são automáticos** - não precisa fazer nada manualmente
4. **Estatísticas são calculadas em tempo real** ao inserir kills

---

## 🆘 Troubleshooting

### Erro: "relation already exists"
- A tabela já foi criada antes
- Solução: Ignore ou delete as tabelas antigas primeiro

### Erro: "permission denied"
- Você não tem permissões de admin no projeto
- Solução: Use uma conta com permissões adequadas

### Estatísticas não atualizam
- Verifique se os triggers foram criados
- Execute: `SELECT * FROM pg_trigger WHERE tgname LIKE '%statistics%';`

---

## 📞 Próximos Passos

Após executar a migração:
1. ✅ Integrar com o app Electron
2. ✅ Criar funções TypeScript para interagir com o banco
3. ✅ Implementar tela de estatísticas
4. ✅ Testar fluxo completo

---

**Criado para COTW Grind Tracker** 🎯
