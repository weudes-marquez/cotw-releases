import { supabase, getSupabaseUserId } from './supabase_client';

/**
 * Buscar estatísticas globais do usuário (todas as sessões combinadas)
 */
export async function getTotalGlobalStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    // Buscar todas as sessões
    const { data: sessions, error: sessionsError } = await supabase
        .from('grind_sessions')
        .select('total_kills')
        .eq('user_id', supabaseId);

    if (sessionsError) {
        console.error('Erro ao buscar sessões globais:', sessionsError);
        return { total_kills: 0, total_diamonds: 0, total_great_ones: 0, total_rares: 0, rare_types: [] };
    }

    // Buscar todos os kills
    const sessionIds = sessions?.map((s: any) => s.id) || [];
    const { data: kills, error: killsError } = await supabase
        .from('kill_records')
        .select('is_diamond, is_great_one, fur_type_id, fur_type_name')
        .in('session_id', sessionIds);

    if (killsError) {
        console.error('Erro ao buscar kills globais:', killsError);
        return { total_kills: 0, total_diamonds: 0, total_great_ones: 0, total_rares: 0, rare_types: [] };
    }

    // Calcular totais
    const total_kills = sessions?.reduce((sum: number, s: any) => sum + (s.total_kills || 0), 0) || 0;
    let total_diamonds = 0;
    let total_great_ones = 0;
    let total_rares = 0;
    const rare_types_set = new Set<string>();

    kills?.forEach((k: any) => {
        if (k.is_diamond) total_diamonds++;
        if (k.is_great_one) total_great_ones++;
        if (k.fur_type_id) {
            total_rares++;
            if (k.fur_type_name) rare_types_set.add(k.fur_type_name);
        }
    });

    return {
        total_kills,
        total_diamonds,
        total_great_ones,
        total_rares,
        rare_types: Array.from(rare_types_set)
    };
}

/**
 * Deletar todas as estatísticas do usuário
 */
export async function deleteAllUserStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    // Deletar kills primeiro (foreign key)
    const { error: killsError } = await supabase
        .from('kill_records')
        .delete()
        .eq('user_id', supabaseId);

    if (killsError) {
        console.error('Erro ao deletar kills:', killsError);
        throw killsError;
    }

    // Deletar sessões
    const { error: sessionsError } = await supabase
        .from('grind_sessions')
        .delete()
        .eq('user_id', supabaseId);

    if (sessionsError) {
        console.error('Erro ao deletar sessões:', sessionsError);
        throw sessionsError;
    }


}
