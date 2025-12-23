-- ============================================================================
-- COTW GRIND TRACKER - SUPABASE DATABASE MIGRATION
-- ============================================================================
-- Este script cria toda a estrutura de banco de dados necessária para
-- registrar estatísticas detalhadas de grind no COTW Tracker
--
-- COMO EXECUTAR:
-- 1. Acesse o Supabase Dashboard
-- 2. Vá em "SQL Editor"
-- 3. Clique em "New Query"
-- 4. Cole todo este arquivo
-- 5. Clique em "Run" (ou pressione Ctrl+Enter)
--
-- IMPORTANTE: Execute este script UMA ÚNICA VEZ
-- ============================================================================

-- ============================================================================
-- STEP 1: EXTENSÕES NECESSÁRIAS
-- ============================================================================

-- Habilitar extensão UUID (caso não esteja habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 2: TABELAS PRINCIPAIS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: user_profiles
-- Descrição: Perfis de usuários (complementa auth.users do Supabase)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Perfis complementares dos usuários';
COMMENT ON COLUMN user_profiles.id IS 'ID do usuário (referência ao auth.users)';
COMMENT ON COLUMN user_profiles.email IS 'Email do usuário';
COMMENT ON COLUMN user_profiles.display_name IS 'Nome de exibição do usuário';

-- ----------------------------------------------------------------------------
-- Tabela: grind_sessions
-- Descrição: Sessões de grind por animal
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grind_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  animal_id TEXT NOT NULL,
  animal_name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_kills INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE grind_sessions IS 'Sessões de grind para cada animal';
COMMENT ON COLUMN grind_sessions.animal_id IS 'ID do animal (do Firestore)';
COMMENT ON COLUMN grind_sessions.animal_name IS 'Nome do animal';
COMMENT ON COLUMN grind_sessions.total_kills IS 'Total de abates nesta sessão';
COMMENT ON COLUMN grind_sessions.is_active IS 'Se a sessão está ativa';

-- ----------------------------------------------------------------------------
-- Tabela: kill_records
-- Descrição: Registro individual de cada abate
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kill_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES grind_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  animal_id TEXT NOT NULL,
  kill_number INTEGER NOT NULL,
  is_diamond BOOLEAN DEFAULT false,
  is_great_one BOOLEAN DEFAULT false,
  fur_type_id TEXT,
  fur_type_name TEXT,
  killed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE kill_records IS 'Registro individual de cada abate';
COMMENT ON COLUMN kill_records.kill_number IS 'Número sequencial do abate na sessão';
COMMENT ON COLUMN kill_records.is_diamond IS 'Se o abate foi um diamante';
COMMENT ON COLUMN kill_records.is_great_one IS 'Se o abate foi um Great One';
COMMENT ON COLUMN kill_records.fur_type_id IS 'ID da pelagem rara (se houver)';
COMMENT ON COLUMN kill_records.fur_type_name IS 'Nome da pelagem rara';

-- ----------------------------------------------------------------------------
-- Tabela: session_statistics
-- Descrição: Estatísticas agregadas por sessão (calculadas automaticamente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID UNIQUE NOT NULL REFERENCES grind_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Contadores
  total_kills INTEGER DEFAULT 0,
  total_diamonds INTEGER DEFAULT 0,
  total_great_ones INTEGER DEFAULT 0,
  total_rare_furs INTEGER DEFAULT 0,
  
  -- Médias (kills necessários para conseguir cada tipo)
  avg_kills_per_diamond DECIMAL(10,2),
  avg_kills_per_great_one DECIMAL(10,2),
  avg_kills_per_rare_fur DECIMAL(10,2),
  
  -- Controle
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE session_statistics IS 'Estatísticas agregadas por sessão (atualizadas automaticamente)';
COMMENT ON COLUMN session_statistics.avg_kills_per_diamond IS 'Média de abates necessários para conseguir um diamante';
COMMENT ON COLUMN session_statistics.avg_kills_per_great_one IS 'Média de abates necessários para conseguir um Great One';
COMMENT ON COLUMN session_statistics.avg_kills_per_rare_fur IS 'Média de abates necessários para conseguir uma pelagem rara';

-- ----------------------------------------------------------------------------
-- Tabela: rare_fur_statistics
-- Descrição: Detalhamento de pelagens raras por sessão
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rare_fur_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES grind_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  fur_type_id TEXT NOT NULL,
  fur_type_name TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  first_obtained_at TIMESTAMP WITH TIME ZONE,
  last_obtained_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(session_id, fur_type_id)
);

COMMENT ON TABLE rare_fur_statistics IS 'Estatísticas detalhadas de pelagens raras por sessão';
COMMENT ON COLUMN rare_fur_statistics.count IS 'Quantidade desta pelagem rara obtida';
COMMENT ON COLUMN rare_fur_statistics.first_obtained_at IS 'Data/hora da primeira obtenção';
COMMENT ON COLUMN rare_fur_statistics.last_obtained_at IS 'Data/hora da última obtenção';

-- ============================================================================
-- STEP 3: ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices para grind_sessions
CREATE INDEX IF NOT EXISTS idx_grind_sessions_user ON grind_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_grind_sessions_animal ON grind_sessions(animal_id);
CREATE INDEX IF NOT EXISTS idx_grind_sessions_active ON grind_sessions(is_active);

-- Índices para kill_records
CREATE INDEX IF NOT EXISTS idx_kill_records_session ON kill_records(session_id);
CREATE INDEX IF NOT EXISTS idx_kill_records_user ON kill_records(user_id);
CREATE INDEX IF NOT EXISTS idx_kill_records_diamond ON kill_records(is_diamond);
CREATE INDEX IF NOT EXISTS idx_kill_records_great_one ON kill_records(is_great_one);
CREATE INDEX IF NOT EXISTS idx_kill_records_fur_type ON kill_records(fur_type_id) WHERE fur_type_id IS NOT NULL;

-- Índices para session_statistics
CREATE INDEX IF NOT EXISTS idx_session_stats_session ON session_statistics(session_id);
CREATE INDEX IF NOT EXISTS idx_session_stats_user ON session_statistics(user_id);

-- Índices para rare_fur_statistics
CREATE INDEX IF NOT EXISTS idx_rare_fur_stats_session ON rare_fur_statistics(session_id);
CREATE INDEX IF NOT EXISTS idx_rare_fur_stats_user ON rare_fur_statistics(user_id);

-- ============================================================================
-- STEP 4: FUNCTIONS E TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: update_session_statistics
-- Descrição: Atualiza estatísticas quando um novo abate é registrado
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_session_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar ou criar registro em session_statistics
  INSERT INTO session_statistics (session_id, user_id, total_kills, total_diamonds, total_great_ones, total_rare_furs)
  VALUES (
    NEW.session_id, 
    NEW.user_id, 
    1,
    CASE WHEN NEW.is_diamond THEN 1 ELSE 0 END,
    CASE WHEN NEW.is_great_one THEN 1 ELSE 0 END,
    CASE WHEN NEW.fur_type_id IS NOT NULL THEN 1 ELSE 0 END
  )
  ON CONFLICT (session_id) DO UPDATE SET
    total_kills = session_statistics.total_kills + 1,
    total_diamonds = session_statistics.total_diamonds + (CASE WHEN NEW.is_diamond THEN 1 ELSE 0 END),
    total_great_ones = session_statistics.total_great_ones + (CASE WHEN NEW.is_great_one THEN 1 ELSE 0 END),
    total_rare_furs = session_statistics.total_rare_furs + (CASE WHEN NEW.fur_type_id IS NOT NULL THEN 1 ELSE 0 END),
    last_updated = NOW();
  
  -- Atualizar total_kills na grind_sessions
  UPDATE grind_sessions 
  SET total_kills = total_kills + 1, updated_at = NOW()
  WHERE id = NEW.session_id;
  
  -- Se for pelagem rara, atualizar rare_fur_statistics
  IF NEW.fur_type_id IS NOT NULL THEN
    INSERT INTO rare_fur_statistics (session_id, user_id, fur_type_id, fur_type_name, count, first_obtained_at, last_obtained_at)
    VALUES (NEW.session_id, NEW.user_id, NEW.fur_type_id, NEW.fur_type_name, 1, NOW(), NOW())
    ON CONFLICT (session_id, fur_type_id) DO UPDATE SET
      count = rare_fur_statistics.count + 1,
      last_obtained_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar estatísticas
DROP TRIGGER IF EXISTS trigger_update_statistics ON kill_records;
CREATE TRIGGER trigger_update_statistics
AFTER INSERT ON kill_records
FOR EACH ROW
EXECUTE FUNCTION update_session_statistics();

-- ----------------------------------------------------------------------------
-- Function: calculate_averages
-- Descrição: Calcula médias automaticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_averages()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular médias
  NEW.avg_kills_per_diamond := CASE 
    WHEN NEW.total_diamonds > 0 THEN ROUND(NEW.total_kills::DECIMAL / NEW.total_diamonds, 2)
    ELSE NULL
  END;
  
  NEW.avg_kills_per_great_one := CASE 
    WHEN NEW.total_great_ones > 0 THEN ROUND(NEW.total_kills::DECIMAL / NEW.total_great_ones, 2)
    ELSE NULL
  END;
  
  NEW.avg_kills_per_rare_fur := CASE 
    WHEN NEW.total_rare_furs > 0 THEN ROUND(NEW.total_kills::DECIMAL / NEW.total_rare_furs, 2)
    ELSE NULL
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular médias
DROP TRIGGER IF EXISTS trigger_calculate_averages ON session_statistics;
CREATE TRIGGER trigger_calculate_averages
BEFORE INSERT OR UPDATE ON session_statistics
FOR EACH ROW
EXECUTE FUNCTION calculate_averages();

-- ----------------------------------------------------------------------------
-- Function: update_updated_at
-- Descrição: Atualiza automaticamente o campo updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para user_profiles
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger para grind_sessions
DROP TRIGGER IF EXISTS trigger_grind_sessions_updated_at ON grind_sessions;
CREATE TRIGGER trigger_grind_sessions_updated_at
BEFORE UPDATE ON grind_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- STEP 5: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE grind_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kill_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rare_fur_statistics ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Políticas para user_profiles
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Políticas para grind_sessions
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own sessions" ON grind_sessions;
CREATE POLICY "Users can view own sessions" ON grind_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON grind_sessions;
CREATE POLICY "Users can insert own sessions" ON grind_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON grind_sessions;
CREATE POLICY "Users can update own sessions" ON grind_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON grind_sessions;
CREATE POLICY "Users can delete own sessions" ON grind_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Políticas para kill_records
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own kills" ON kill_records;
CREATE POLICY "Users can view own kills" ON kill_records
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own kills" ON kill_records;
CREATE POLICY "Users can insert own kills" ON kill_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own kills" ON kill_records;
CREATE POLICY "Users can delete own kills" ON kill_records
  FOR DELETE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Políticas para session_statistics
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own stats" ON session_statistics;
CREATE POLICY "Users can view own stats" ON session_statistics
  FOR SELECT USING (auth.uid() = user_id);

-- Permitir INSERT/UPDATE para triggers (executados como SECURITY DEFINER)
DROP POLICY IF EXISTS "Allow system to manage stats" ON session_statistics;
CREATE POLICY "Allow system to manage stats" ON session_statistics
  FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- Políticas para rare_fur_statistics
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own fur stats" ON rare_fur_statistics;
CREATE POLICY "Users can view own fur stats" ON rare_fur_statistics
  FOR SELECT USING (auth.uid() = user_id);

-- Permitir INSERT/UPDATE para triggers
DROP POLICY IF EXISTS "Allow system to manage fur stats" ON rare_fur_statistics;
CREATE POLICY "Allow system to manage fur stats" ON rare_fur_statistics
  FOR ALL USING (true);

-- ============================================================================
-- STEP 6: VIEWS ÚTEIS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: user_grind_summary
-- Descrição: Resumo geral de grind por usuário
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW user_grind_summary AS
SELECT 
  gs.user_id,
  gs.animal_id,
  gs.animal_name,
  gs.start_date,
  gs.is_active,
  ss.total_kills,
  ss.total_diamonds,
  ss.total_great_ones,
  ss.total_rare_furs,
  ss.avg_kills_per_diamond,
  ss.avg_kills_per_great_one,
  ss.avg_kills_per_rare_fur,
  gs.id as session_id
FROM grind_sessions gs
LEFT JOIN session_statistics ss ON gs.id = ss.session_id
ORDER BY gs.start_date DESC;

COMMENT ON VIEW user_grind_summary IS 'Resumo completo de todas as sessões de grind';

-- ============================================================================
-- FINALIZADO!
-- ============================================================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '📊 Tables created: user_profiles, grind_sessions, kill_records, session_statistics, rare_fur_statistics';
  RAISE NOTICE '🔒 RLS policies enabled for all tables';
  RAISE NOTICE '⚡ Triggers configured for automatic statistics updates';
  RAISE NOTICE '🎯 Ready to track your COTW grind!';
END $$;
