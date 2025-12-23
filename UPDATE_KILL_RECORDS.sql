-- Adiciona colunas para estatísticas avançadas na tabela kill_records

-- 1. Adicionar coluna is_troll
ALTER TABLE kill_records 
ADD COLUMN IF NOT EXISTS is_troll BOOLEAN DEFAULT FALSE;

-- 2. Adicionar colunas de detalhes (peso, score, dificuldade)
ALTER TABLE kill_records 
ADD COLUMN IF NOT EXISTS weight NUMERIC(10, 3) DEFAULT NULL, -- Peso em kg (ex: 120.500)
ADD COLUMN IF NOT EXISTS trophy_score NUMERIC(10, 2) DEFAULT NULL, -- Score (ex: 250.00)
ADD COLUMN IF NOT EXISTS difficulty_level INTEGER DEFAULT NULL; -- Dificuldade (1-10)

-- 3. Atualizar a view de estatísticas (se necessário) ou criar índices
CREATE INDEX IF NOT EXISTS idx_kill_records_is_troll ON kill_records(is_troll);

COMMENT ON COLUMN kill_records.is_troll IS 'Indica se o animal era um Troll (nível máximo mas sem diamante)';
COMMENT ON COLUMN kill_records.weight IS 'Peso do animal em KG';
COMMENT ON COLUMN kill_records.trophy_score IS 'Pontuação do troféu';
COMMENT ON COLUMN kill_records.difficulty_level IS 'Nível de dificuldade do animal (1-10)';
