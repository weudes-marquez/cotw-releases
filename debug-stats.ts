
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getSupabaseUserId } from './src/supabase_integration';

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
    console.log('🔍 INICIANDO DIAGNÓSTICO DO BANCO DE DADOS...\n');

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
            console.table(sessions.map(s => ({
                id: s.id.substring(0, 8) + '...',
                user_id: s.user_id.substring(0, 8) + '...',
                animal_name: s.animal_name,
                total_kills: s.total_kills,
                is_active: s.is_active
            })));
        } else {
            console.log('⚠️ Nenhuma sessão encontrada.');
        }
    }

    console.log('\n--- TABELA: kill_records ---');
    // 2. Verificar Kills (kill_records)
    const { data: kills, error: killsError } = await supabase
        .from('kill_records')
        .select('*')
        .limit(20); // Limit to avoid spam

    if (killsError) {
        console.error('❌ Erro ao buscar kills:', killsError);
    } else {
        console.log(`✅ Kills encontrados (amostra 20): ${kills?.length}`);
        if (kills && kills.length > 0) {
            console.table(kills.map(k => ({
                id: k.id.substring(0, 8) + '...',
                session_id: k.session_id.substring(0, 8) + '...',
                kill_number: k.kill_number,
                is_diamond: k.is_diamond
            })));
        } else {
            console.log('⚠️ Nenhum kill encontrado.');
        }
    }

    console.log('\n--- VERIFICAÇÃO DE RELACIONAMENTO ---');
    if (sessions && sessions.length > 0 && kills && kills.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        const orphanedKills = kills.filter(k => !sessionIds.includes(k.session_id));

        if (orphanedKills.length > 0) {
            console.error(`❌ ALERTA: ${orphanedKills.length} kills encontrados sem sessão correspondente!`);
        } else {
            console.log('✅ Todos os kills amostrados pertencem a sessões válidas.');
        }
    }
}

debugDatabase();
