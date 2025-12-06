
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env vars
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugDatabase() {
    console.log('🔍 INICIANDO DIAGNÓSTICO DO BANCO DE DADOS (JS MODE - FOCADO)...\n');

    // 1. Verificar Sessões (grind_sessions)
    console.log('--- TABELA: grind_sessions ---');
    const { data: sessions, error: sessionsError } = await supabase
        .from('grind_sessions')
        .select('*');

    if (sessionsError) {
        console.error('❌ Erro ao buscar sessões:', sessionsError);
    } else {
        console.log(`✅ Total de sessões encontradas: ${sessions?.length}`);
        if (sessions && sessions.length > 0) {
            console.log('Listando sessões (ID | UserID | Animal | Kills | Active):');
            sessions.forEach(s => {
                console.log(`- [${s.id.substring(0, 8)}] User:${s.user_id.substring(0, 8)} | Animal: "${s.animal_name}" | Kills: ${s.total_kills} | Active: ${s.is_active}`);
            });
        } else {
            console.log('⚠️ Nenhuma sessão encontrada.');
        }
    }
}

debugDatabase();
