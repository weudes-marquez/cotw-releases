// ============================================================================
// ADDITIONAL FUNCTIONS - Add to end of supabase_integration.ts
// ============================================================================

export async function getActiveSessions(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    const { data, error } = await supabase
        .from('grind_sessions')
        .select('*')
        .eq('user_id', supabaseId)
        .eq('is_active', true);

    if (error) {
        console.error('Error getting active sessions:', error);
        return [];
    }
    return data || [];
}

export async function closeAllActiveSessions(userId: string, animalId: string) {
    const supabaseId = getSupabaseUserId(userId);

    console.log('🗄️ [DB] closeAllActiveSessions - Iniciando...');
    console.log('  User (original):', userId);
    console.log('  User (supabase):', supabaseId);
    console.log('  Animal ID:', animalId);

    const { error, count } = await supabase
        .from('grind_sessions')
        .update({ is_active: false })
        .eq('user_id', supabaseId)
        .eq('animal_id', animalId)
        .eq('is_active', true);

    if (error) {
        console.error('❌ [DB] closeAllActiveSessions - Erro:', error);
        throw error;
    }
    console.log('✅ [DB] closeAllActiveSessions - Sessões fechadas:', count || 'desconhecido');
}

export async function trackUserActivity(userId: string, email: string, appVersion: string, platform: string) {
    const supabaseId = getSupabaseUserId(userId);

    const { error } = await supabase
        .from('app_users')
        .upsert({
            user_id: supabaseId,
            email,
            last_seen_at: new Date().toISOString(),
            app_version: appVersion,
            platform
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Erro ao rastrear atividade do usuário:', error);
    }
}

export async function deleteAllUserStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    await supabase.from('kill_records').delete().eq('user_id', supabaseId);
    await supabase.from('grind_sessions').delete().eq('user_id', supabaseId);
}

export async function getMaps() {
    const { data, error } = await supabase
        .from('maps')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error getting maps:', error);
        return [];
    }
    return data || [];
}

export async function getNeedZones(animalId: string) {
    const { data, error } = await supabase
        .from('need_zones')
        .select('*')
        .eq('animal_id', animalId);

    if (error) {
        console.error('Error getting need zones:', error);
        return [];
    }
    return data || [];
}
