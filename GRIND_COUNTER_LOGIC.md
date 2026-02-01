# Relatório de Lógica do Grind Counter

## Visão Geral

O sistema de contador de abates funciona com duas camadas:
1. **Estado Local (UI)**: Controla o que o usuário vê em tempo real
2. **Banco de Dados**: Persiste os dados permanentemente

---

## Estrutura do Banco de Dados

### Tabelas Principais

| Tabela | Função |
|--------|--------|
| `grind_sessions` | Uma sessão = um "grind" para um animal específico |
| `kill_records` | Cada abate individual com todos os detalhes |
| `session_statistics` | Estatísticas agregadas por sessão |
| `species` | Catálogo de animais |
| `fur_types` | Catálogo de pelagens raras |

### Relacionamentos

```
user_profiles (1) ──► (N) grind_sessions (1) ──► (N) kill_records
                                         │
                                         └──► (1) session_statistics
```

---

## Fluxo: Botões + e -

### Botão + (Incrementar)

1. **UI atualiza imediatamente** (otimista):
   - `sessionKillsMap[animalId]` += 1 (contador local X)
   - `animalTotalKills` += 1 (contador total Y)

2. **Salva no banco**:
   - INSERT em `kill_records`:
     ```sql
     INSERT INTO kill_records (
       session_id, user_id, animal_id, kill_number,
       is_diamond, is_great_one, is_troll,
       fur_type_id, fur_type_name
     ) VALUES (...)
     ```
   - UPDATE em `grind_sessions`:
     ```sql
     UPDATE grind_sessions SET total_kills = ? WHERE id = ?
     ```

### Botão - (Decrementar)

1. **UI atualiza imediatamente**:
   - `sessionKillsMap[animalId]` -= 1
   - `animalTotalKills` -= 1

2. **Remove do banco**:
   - Busca último kill da sessão
   - DELETE em `kill_records`
   - UPDATE em `grind_sessions` com novo total

---

## Fluxo: Botões Especiais

### Diamante

```javascript
registerKill(sessionId, userId, animalId, killNumber, 
  isDiamond: true,      // ✓
  isGreatOne: false,
  furTypeId: null,
  furTypeName: null,
  isTroll: false
)
```

**Salva em**: `kill_records.is_diamond = true`

---

### Great One

```javascript
registerKill(sessionId, userId, animalId, killNumber, 
  isDiamond: false,
  isGreatOne: true,     // ✓
  furTypeId: null,
  furTypeName: null,
  isTroll: false
)
```

**Salva em**: `kill_records.is_great_one = true`

---

### Troll

```javascript
registerKill(sessionId, userId, animalId, killNumber, 
  isDiamond: false,
  isGreatOne: false,
  furTypeId: null,
  furTypeName: null,
  isTroll: true         // ✓
)
```

**Salva em**: `kill_records.is_troll = true`

---

### Pelagem Rara (Rare)

```javascript
registerKill(sessionId, userId, animalId, killNumber, 
  isDiamond: false,
  isGreatOne: false,
  furTypeId: "albino",      // ✓ ID da pelagem
  furTypeName: "Albino",    // ✓ Nome da pelagem
  isTroll: false
)
```

**Salva em**: `kill_records.fur_type_id` e `kill_records.fur_type_name`

---

### Super Raro (Diamond + Rare)

```javascript
registerKill(sessionId, userId, animalId, killNumber, 
  isDiamond: true,          // ✓ É diamante
  isGreatOne: false,
  furTypeId: "piebald",     // ✓ E também tem pelagem rara
  furTypeName: "Piebald",
  isTroll: false
)
```

**Identificação**: `is_diamond = true` AND `fur_type_id IS NOT NULL`

---

## Contadores X/Y

### X (Contador de Sessão)
- **Armazenado**: `grind_sessions.current_session_kills` (banco de dados)
- **Persiste entre reinícios**: SIM ✓
- **Zera quando**: Usuário clica "Encerrar Sessão" ou "Encerrar Grind"

### Y (Contador Total do Grind)
- **Armazenado**: `grind_sessions.total_kills` (banco de dados)
- **Persiste entre reinícios**: SIM ✓
- **Zera quando**: Usuário clica "Encerrar Grind"

---

## Leitura de Estatísticas

### Estatísticas por Animal (Históricas)

```sql
SELECT 
  gs.animal_id,
  gs.animal_name,
  SUM(gs.total_kills) as total_kills,
  SUM(ss.total_diamonds) as total_diamonds,
  SUM(ss.total_great_ones) as total_great_ones,
  SUM(ss.total_rare_furs) as total_rares
FROM grind_sessions gs
LEFT JOIN session_statistics ss ON gs.id = ss.session_id
WHERE gs.user_id = ?
GROUP BY gs.animal_id, gs.animal_name
```

### Super Raros (calculado via query)

```sql
SELECT animal_id, fur_type_name, killed_at, trophy_score
FROM kill_records
WHERE user_id = ?
  AND is_diamond = true
  AND fur_type_id IS NOT NULL
```

---

## Fluxo de Sessão

### Iniciar Grind
1. Verifica se existe sessão ativa para o animal:
   ```sql
   SELECT * FROM grind_sessions 
   WHERE user_id = ? AND animal_id = ? AND is_active = true
   ```
2. Se não existe, cria nova:
   ```sql
   INSERT INTO grind_sessions (user_id, animal_id, animal_name, is_active, total_kills)
   VALUES (?, ?, ?, true, 0)
   ```

### Encerrar Sessão
- **Local**: `sessionKillsMap[animalId] = 0`
- **Banco**: Nenhuma alteração (sessão continua ativa)

### Encerrar Grind
- **Local**: Zera X e Y
- **Banco**: 
  ```sql
  UPDATE grind_sessions SET is_active = false WHERE id = ?
  ```

---

## Geração de User ID

O Firebase UID é convertido para UUID v5:

```javascript
function getSupabaseUserId(firebaseUid) {
  const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
  return uuidv5(firebaseUid, NAMESPACE);
}
```

**Exemplo**: 
- Firebase UID: `abc123XYZ`
- Supabase UUID: `550e8400-e29b-41d4-a716-446655440000`

---

## Resumo de Tabelas por Ação

| Ação | Tabela Alvo | Campos Afetados |
|------|-------------|-----------------|
| Clique + | `kill_records`, `grind_sessions` | INSERT novo kill, UPDATE total_kills |
| Clique - | `kill_records`, `grind_sessions` | DELETE último kill, UPDATE total_kills |
| Diamante | `kill_records` | is_diamond = true |
| Great One | `kill_records` | is_great_one = true |
| Troll | `kill_records` | is_troll = true |
| Pelagem Rara | `kill_records` | fur_type_id, fur_type_name |
| Super Raro | `kill_records` | is_diamond = true, fur_type_id não nulo |
| Iniciar Grind | `grind_sessions` | Nova sessão ou busca existente |
| Encerrar Sessão | Nenhuma | Só zera contador local |
| Encerrar Grind | `grind_sessions` | is_active = false |
