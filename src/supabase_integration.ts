// ============================================================================
// COTW GRIND TRACKER - SUPABASE INTEGRATION EXAMPLES
// ============================================================================
// Exemplos de código TypeScript para integrar com o banco de dados Supabase
// ============================================================================

import React from 'react';


import { createClient } from '@supabase/supabase-js';

// Type Definitions
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Supabase URL or Anon Key missing in .env');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export interface UserProfile {
    id: string;
    email: string;
    display_name: string;
}

export interface GrindSession {
    id: string;
    user_id: string;
    animal_id: string;
    animal_name: string;
    start_date: string;
    is_active: boolean;
    total_kills: number;
    current_session_kills: number;
}

export interface SessionStatistics {
    session_id: string;
    total_kills: number;
    total_diamonds: number;
    total_great_ones: number;
    total_rare_furs: number;
}

export interface KillRecord {
    id: string;
    session_id: string;
    user_id: string;
    animal_id: string;
    kill_number: number;
    is_diamond: boolean;
    is_great_one: boolean;
    is_troll: boolean;
    fur_type_id: string | null;
    fur_type_name: string | null;
    weight: number | null;
    trophy_score: number | null;
    difficulty_level: number | null;
    killed_at: string;
}

// ... (MapData, NeedZoneData interfaces)
export interface MapData {
    id: string;
    name: string;
    firestore_id?: string;
}

export interface NeedZoneData {
    id: string;
    species_name: string;
    map_id: string;
    map_name?: string;
    zone_type: string;
    start_time: string;
    end_time: string;
}

// ...




/**
 * Buscar sessão ativa para um animal
 */
export async function getActiveSession(userId: string, animalId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('grind_sessions')
        .select('*')
        .eq('user_id', supabaseId)
        .eq('animal_id', animalId)
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        console.error('❌ Erro ao buscar sessão ativa:', error);
        return null;
    }
    return data as GrindSession | null;
}

/**
 * Criar nova sessão de grind
 */
export async function createGrindSession(userId: string, animalId: string, animalName: string) {
    const supabaseId = getSupabaseUserId(userId);

    // 1. Desativar sessões anteriores (safety)
    await supabase
        .from('grind_sessions')
        .update({ is_active: false })
        .eq('user_id', supabaseId)
        .eq('animal_id', animalId)
        .eq('is_active', true);

    // 2. Criar nova sessão
    const { data, error } = await supabase
        .from('grind_sessions')
        .insert({
            user_id: supabaseId,
            animal_id: animalId,
            animal_name: animalName,
            start_date: new Date().toISOString(),
            is_active: true,
            total_kills: 0
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Erro ao criar sessão:', error);
        throw error;
    }
    return data as GrindSession;
}

/**
 * Buscar estatísticas da sessão
 */
export async function getSessionStatistics(sessionId: string) {
    const { data, error } = await supabase
        .from('session_statistics')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

    if (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
    }

    return (data as SessionStatistics) || {
        session_id: sessionId,
        total_kills: 0,
        total_diamonds: 0,
        total_great_ones: 0,
        total_rare_furs: 0
    };
}

/**
 * Buscar lista de abates da sessão
 */
export async function getSessionKills(sessionId: string) {
    const { data, error } = await supabase
        .from('kill_records')
        .select('*')
        .eq('session_id', sessionId)
        .order('kill_number', { ascending: false });

    if (error) {
        console.error('❌ Erro ao buscar abates:', error);
        return [];
    }
    return data as KillRecord[];
}

/**
 * Finalizar sessão atual
 */
export async function finishSession(sessionId: string) {
    const { error } = await supabase
        .from('grind_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

    if (error) {
        console.error('❌ Erro ao finalizar sessão:', error);
        throw error;
    }
    return true;
}


/**
 * Buscar estatísticas globais do usuário
 */
export async function getUserGlobalStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .rpc('get_user_global_stats', { p_user_id: supabaseId });

    if (error) throw error;
    return data;
}

// ... (getSessionRareFurs uses sessionId, fine) ...

/**
 * Buscar todos os diamantes do usuário
 */
export async function getUserDiamonds(userId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('kill_records')
        .select(`
      *,
      grind_sessions!inner(animal_name)
    `)
        .eq('user_id', supabaseId)
        .eq('is_diamond', true)
        .order('killed_at', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Buscar todos os Great Ones do usuário
 */
export async function getUserGreatOnes(userId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('kill_records')
        .select(`
      *,
      grind_sessions!inner(animal_name)
    `)
        .eq('user_id', supabaseId)
        .eq('is_great_one', true)
        .order('killed_at', { ascending: false });

    if (error) throw error;
    return data;
}

/**
 * Buscar ranking de animais mais grindados
 */
export async function getAnimalRanking(userId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('grind_sessions')
        .select('animal_name, total_kills')
        .eq('user_id', supabaseId);

    if (error) throw error;

    // Agregar por animal
    const ranking = data.reduce((acc: any, session: any) => {
        if (!acc[session.animal_name]) {
            acc[session.animal_name] = 0;
        }
        acc[session.animal_name] += session.total_kills;
        return acc;
    }, {});

    return Object.entries(ranking)
        .map(([animal, kills]) => ({ animal, kills }))
        .sort((a: any, b: any) => b.kills - a.kills);
}

// ... (exampleCompleteFlow needs update but is unused, skipping for brevity) ...

/**
 * Registrar um novo abate (Direct Insert)
 * Lógica simples e direta: Insert no histórico + Update no contador
 */
export async function registerKill(
    sessionId: string,
    userId: string,
    animalId: string,
    killData: any
) {
    const supabaseId = getSupabaseUserId(userId);

    try {
        // 1. Busca total atual para garantir sequência correta
        const { data: session } = await supabase
            .from('grind_sessions')
            .select('total_kills, current_session_kills')
            .eq('id', sessionId)
            .single();

        const currentTotal = session?.total_kills || 0;
        const currentSessionKills = session?.current_session_kills || 0;

        // 2. Insere o registro do abate
        const { error: insertError } = await supabase
            .from('kill_records')
            .insert({
                session_id: sessionId,
                user_id: supabaseId,
                animal_id: animalId,
                kill_number: currentTotal + 1,
                is_diamond: killData.isDiamond,
                is_great_one: killData.isGreatOne,
                is_troll: killData.isTroll,
                fur_type_id: killData.furTypeId,
                fur_type_name: killData.furTypeName,
                weight: killData.weight,
                trophy_score: killData.trophyScore,
                difficulty_level: killData.difficultyLevel,
                killed_at: new Date().toISOString()
            });

        if (insertError) throw insertError;

        // 3. Atualiza os contadores da sessão
        const { error: updateError } = await supabase
            .from('grind_sessions')
            .update({
                total_kills: currentTotal + 1,
                current_session_kills: currentSessionKills + 1
            })
            .eq('id', sessionId);

        if (updateError) throw updateError;

        return true;
    } catch (error) {
        console.error('❌ Erro ao registrar abate:', error);
        throw error;
    }
}

/**
 * Hook React para usar no Dashboard
 * Versão Simplificada: Sem filas, sem debounce complexo. Apenas chama o banco.
 * O controle de "cliques rápidos" deve ser feito na UI (desabilitando o botão).
 */
export function useGrindSession(userId: string | undefined, animalId: string, animalName: string, shouldCreate: boolean = false) {
    const [session, setSession] = React.useState<GrindSession | null>(null);
    const [stats, setStats] = React.useState<SessionStatistics | null>(null);
    const [loading, setLoading] = React.useState(false);
    const loadingRef = React.useRef(false);

    React.useEffect(() => {
        setSession(null);
        setStats(null);
        if (userId && animalId) {
            loadSession();
        }
    }, [userId, animalId, shouldCreate]);

    async function loadSession() {
        if (!userId || !animalId || loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        try {
            let activeSession = await getActiveSession(userId, animalId);
            if (!activeSession && shouldCreate) {
                activeSession = await createGrindSession(userId, animalId, animalName);
            }
            if (activeSession) {
                setSession(activeSession);
                const sessionStats = await getSessionStatistics(activeSession.id);
                setStats(sessionStats);
            } else {
                setSession(null);
                setStats(null);
            }
        } catch (error) {
            console.error('Error loading session:', error);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }

    async function addKill(
        isDiamond = false,
        isGreatOne = false,
        furTypeId?: string,
        furTypeName?: string,
        isTroll = false,
        weight: number | null = null,
        trophyScore: number | null = null,
        difficultyLevel: number | null = null
    ) {
        if (!session || !userId) return;

        // Optimistic Update para feedback instantâneo
        setSession(prev => prev ? {
            ...prev,
            total_kills: prev.total_kills + 1,
            current_session_kills: (prev.current_session_kills || 0) + 1
        } : null);

        if (stats) {
            setStats({
                ...stats,
                total_kills: stats.total_kills + 1,
                total_diamonds: isDiamond ? stats.total_diamonds + 1 : stats.total_diamonds,
                total_great_ones: isGreatOne ? stats.total_great_ones + 1 : stats.total_great_ones,
                total_rare_furs: (furTypeId && furTypeName) ? stats.total_rare_furs + 1 : stats.total_rare_furs,
            });
        }

        try {
            // Chamada direta ao banco
            await registerKill(session.id, userId, animalId, {
                isDiamond, isGreatOne, furTypeId, furTypeName, isTroll, weight, trophyScore, difficultyLevel
            });
        } catch (error) {
            console.error('Erro ao salvar abate:', error);
            // Em caso de erro, recarrega a sessão para corrigir os números
            loadSession();
        }
    }

    async function removeLastKill() {
        if (!session) return;

        // Optimistic Update
        setSession(prev => prev ? {
            ...prev,
            total_kills: Math.max(0, prev.total_kills - 1),
            current_session_kills: Math.max(0, (prev.current_session_kills || 0) - 1)
        } : null);

        if (stats) {
            setStats(prev => prev ? { ...prev, total_kills: Math.max(0, prev.total_kills - 1) } : null);
        }

        try {
            // Lógica de remoção direta (busca último e deleta)
            const { data: lastRecord } = await supabase
                .from('kill_records')
                .select('id')
                .eq('session_id', session.id)
                .order('kill_number', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastRecord) {
                await supabase.from('kill_records').delete().eq('id', lastRecord.id);
            }

            // Decrementa contador
            const { data: curr } = await supabase.from('grind_sessions').select('total_kills, current_session_kills').eq('id', session.id).single();
            if (curr) {
                await supabase.from('grind_sessions').update({
                    total_kills: Math.max(0, curr.total_kills - 1),
                    current_session_kills: Math.max(0, curr.current_session_kills - 1)
                }).eq('id', session.id);
            }

        } catch (error) {
            console.error('Erro ao remover abate:', error);
            loadSession();
        }
    }

    async function finishCurrentSession() {
        if (!session) return;
        try {
            await finishSession(session.id);
            setSession(null);
            setStats(null);
        } catch (error) {
            console.error('Error finishing session:', error);
        }
    }

    return { session, stats, loading, addKill, removeLastKill, finishCurrentSession, reload: loadSession };
}

// ============================================================================
// USER TRACKING - Rastrear atividade do usuário
// ============================================================================
export async function trackUserActivity(userId: string, email: string, appVersion: string = '1.0.0') {
    const supabaseId = getSupabaseUserId(userId);
    // const platform = window.navigator.platform; // Platform not in user_profiles schema

    const { error } = await supabase
        .from('user_profiles')
        .upsert({
            id: supabaseId,
            email: email,
            updated_at: new Date().toISOString(),
            // app_version: appVersion, // Not in schema
            // platform: platform // Not in schema
        }, { onConflict: 'id' });

    if (error) {
        console.error('Erro ao rastrear atividade do usuário:', error);
    }
}

// ============================================================================
// GET ACTIVE SESSIONS - Buscar todas as sessões ativas (não finalizadas)
// ============================================================================
export async function getActiveSessions(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    // Buscar todas as sessões ativas do usuário
    const { data: sessions, error: sessionsError } = await supabase
        .from('grind_sessions')
        .select('id, animal_id, animal_name, start_date, total_kills')
        .eq('user_id', supabaseId)
        .eq('is_active', true)
        .order('start_date', { ascending: false });

    if (sessionsError) {
        console.error('Erro ao buscar sessões ativas:', sessionsError);
        return [];
    }

    if (!sessions || sessions.length === 0) {
        return [];
    }

    // Buscar estatísticas de cada sessão ativa
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: sessionStats, error: statsError } = await supabase
        .from('session_statistics')
        .select('session_id, total_kills, total_diamonds, total_great_ones, total_rare_furs')
        .in('session_id', sessionIds);

    if (statsError) {
        console.error('Erro ao buscar estatísticas das sessões:', statsError);
        return [];
    }

    // Combinar sessões com suas estatísticas
    const activeSessions = sessions.map((session: any) => {
        const stats = sessionStats?.find((s: any) => s.session_id === session.id) || {
            total_kills: 0,
            total_diamonds: 0,
            total_great_ones: 0,
            total_rare_furs: 0
        };

        return {
            session_id: session.id,
            animal_id: session.animal_id,
            animal_name: session.animal_name,
            start_date: session.start_date,
            total_kills: stats.total_kills || 0,
            total_diamonds: stats.total_diamonds || 0,
            total_great_ones: stats.total_great_ones || 0,
            total_rare_furs: stats.total_rare_furs || 0
        };
    });

    return activeSessions;
}

// ============================================================================
// MIGRATION & NEED ZONES
// ============================================================================

/**
 * Buscar todos os mapas
 */
export async function getMaps() {
    const { data, error } = await supabase
        .from('maps')
        .select('*')
        .order('name', { ascending: true });

    if (error) throw error;
    return data as MapData[];
}

/**
 * Buscar Need Zones por espécie (usando species_id)
 */
export async function getNeedZones(speciesName: string) {
    console.log('🔎 getNeedZones called with species:', speciesName);

    // Primeiro, buscar o ID da espécie pelo nome
    const { data: speciesData, error: speciesError } = await supabase
        .from('species')
        .select('id')
        .eq('name_ptbr', speciesName)
        .single();

    if (speciesError || !speciesData) {
        console.error('❌ Species not found:', speciesName, speciesError);
        return [];
    }

    console.log('✅ Found species ID:', speciesData.id);

    // Join com maps para pegar o nome do mapa
    const { data, error } = await supabase
        .from('need_zones')
        .select(`
            *,
            maps (
                name
            )
        `)
        .eq('species_id', speciesData.id);

    console.log('📊 Query result:', { data, error, count: data?.length });

    if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
    }

    // Flatten data for easier consumption
    const result = data.map((zone: any) => ({
        ...zone,
        map_name: zone.maps?.name || 'Unknown Map'
    })) as NeedZoneData[];

    console.log('✅ Returning zones:', result.length);
    return result;
}

/**
 * Criar um mapa (usado na migração)
 */
export async function createMap(name: string, firestoreId?: string) {
    // Check if exists first to avoid duplicates during multiple migration runs
    const { data: existing } = await supabase
        .from('maps')
        .select('id')
        .eq('name', name)
        .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
        .from('maps')
        .insert({ name, firestore_id: firestoreId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Criar uma Need Zone (usado na migração)
 */
export async function createNeedZone(
    speciesName: string,
    mapId: string,
    zoneType: string,
    startTime: string,
    endTime: string
) {
    // Check for duplicates (optional but good for idempotency)
    const { data: existing } = await supabase
        .from('need_zones')
        .select('id')
        .eq('species_name', speciesName)
        .eq('map_id', mapId)
        .eq('zone_type', zoneType)
        .eq('start_time', startTime)
        .eq('end_time', endTime)
        .maybeSingle();

    if (existing) return existing;

    const { data, error } = await supabase
        .from('need_zones')
        .insert({
            species_name: speciesName,
            map_id: mapId,
            zone_type: zoneType,
            start_time: startTime,
            end_time: endTime
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ============================================================================
// NOTAS DE IMPLEMENTAÇÃO
// ============================================================================

/*
IMPORTANTE:

1. Adicione ao .env:
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima
   // REMOVIDO: Service Role Key não deve ser usada no cliente por motivos de segurança.
   // A autenticação deve ser feita via troca de tokens (Edge Function) ou RLS configurado.

2. Instale a dependência:
   npm install @supabase/supabase-js

3. Os triggers no banco atualizam automaticamente:
   - session_statistics
   - rare_fur_statistics
   - grind_sessions.total_kills

4. Todas as queries respeitam RLS (Row Level Security)

5. Use try/catch para tratar erros adequadamente

6. As estatísticas são calculadas automaticamente pelos triggers
*/

// ============================================================================
// FUNÇÕES RESTAURADAS (Missing Functions)
// ============================================================================

// Removido import 'uuid' para evitar problemas de compatibilidade
// import { v5 as uuidv5 } from 'uuid';

// --- SHA-1 Implementation (Sync) ---
function sha1(bytes: number[]): number[] {
    const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
    const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

    // Pre-processing
    const newBytes = [...bytes, 0x80];
    while (newBytes.length % 64 !== 56) {
        newBytes.push(0);
    }
    const lenBits = bytes.length * 8;
    newBytes.push(0, 0, 0, 0);
    newBytes.push((lenBits >>> 24) & 0xff);
    newBytes.push((lenBits >>> 16) & 0xff);
    newBytes.push((lenBits >>> 8) & 0xff);
    newBytes.push(lenBits & 0xff);

    for (let i = 0; i < newBytes.length; i += 64) {
        const w = new Array(80);
        for (let j = 0; j < 16; j++) {
            w[j] = (newBytes[i + j * 4] << 24) | (newBytes[i + j * 4 + 1] << 16) | (newBytes[i + j * 4 + 2] << 8) | (newBytes[i + j * 4 + 3]);
        }
        for (let j = 16; j < 80; j++) {
            const t = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
            w[j] = (t << 1) | (t >>> 31);
        }

        let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4];

        for (let j = 0; j < 80; j++) {
            let f, k;
            if (j < 20) { f = (b & c) | (~b & d); k = K[0]; }
            else if (j < 40) { f = b ^ c ^ d; k = K[1]; }
            else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = K[2]; }
            else { f = b ^ c ^ d; k = K[3]; }

            const temp = ((a << 5) | (a >>> 27)) + f + e + k + w[j];
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp | 0;
        }

        H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0;
    }

    const result: number[] = [];
    for (let i = 0; i < 5; i++) {
        result.push((H[i] >>> 24) & 0xff);
        result.push((H[i] >>> 16) & 0xff);
        result.push((H[i] >>> 8) & 0xff);
        result.push(H[i] & 0xff);
    }
    return result;
}

// --- UUID v5 Implementation ---
function uuidv5(name: string, namespace: string): string {
    const namespaceHex = namespace.replace(/-/g, '');
    const namespaceBytes: number[] = [];
    for (let i = 0; i < 32; i += 2) {
        namespaceBytes.push(parseInt(namespaceHex.substr(i, 2), 16));
    }

    const nameStr = unescape(encodeURIComponent(name));
    const nameBytes: number[] = [];
    for (let i = 0; i < nameStr.length; i++) {
        nameBytes.push(nameStr.charCodeAt(i));
    }

    const inputBytes = [...namespaceBytes, ...nameBytes];
    const hashBytes = sha1(inputBytes);

    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;

    const hex = hashBytes.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

/**
 * Gera um UUID determinístico a partir do ID do Firebase
 */
function getSupabaseUserId(userId: string): string {
    // Namespace URL padrão
    const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

    // Log para debug
    const generatedId = uuidv5(userId, NAMESPACE);
    console.log(`🔐 ID Generation: Input=${userId} -> Output=${generatedId}`);

    return generatedId;
}

/**
 * Autenticar com Supabase (sessão anônima)
 * Firebase Auth já verifica se o usuário é cadastrado.
 * Usamos sessão anônima no Supabase porque o RLS filtra por user_id (UUID derivado do Firebase).
 */
export async function authenticateWithFirebase(_token: string) {
    try {
        // First check if already authenticated
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
            console.log('✅ Supabase session already exists');
            return true;
        }

        // Use anonymous sign-in (user must have "Allow anonymous sign-ins" enabled in Supabase)
        const { error } = await supabase.auth.signInAnonymously();

        if (error) {
            console.error('❌ Erro na autenticação Supabase:', error);
            return false;
        }
        console.log('✅ Supabase anonymous auth successful');
        return true;
    } catch (err) {
        console.error('❌ Exceção na autenticação:', err);
        return false;
    }
}

/**
 * Criar ou atualizar perfil do usuário
 */
export async function upsertUserProfile(id: string, email: string, displayName: string) {
    const supabaseId = getSupabaseUserId(id);

    try {
        const { error } = await supabase
            .from('user_profiles')
            .upsert({
                id: supabaseId,
                email: email,
                display_name: displayName,
                updated_at: new Date().toISOString(),
            });

        if (error) {
            console.error('❌ Erro ao atualizar perfil:', error);
        }
    } catch (err) {
        console.error('❌ Exceção ao atualizar perfil:', err);
    }
}

/**
 * Buscar tipos de pelagem (Fur Types)
 */
export async function getFurTypes() {
    try {
        const { data, error } = await supabase
            .from('fur_types')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('❌ Erro ao buscar fur types:', err);
        return [];
    }
}

/**
 * Buscar todas as espécies
 */
export async function getSpecies() {
    try {
        const { data, error } = await supabase
            .from('species')
            .select('*')
            .order('name_ptbr', { ascending: true });

        if (error) throw error;
        return data;
    } catch (err) {
        console.error('❌ Erro ao buscar espécies:', err);
        return [];
    }
}

/**
 * Buscar estatísticas históricas do usuário (Agregado por animal)
 */
export async function getUserHistoricalStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    try {
        // Busca sessões com estatísticas para compilar histórico completo
        const { data: sessions, error } = await supabase
            .from('grind_sessions')
            .select(`
                animal_id, 
                animal_name, 
                total_kills, 
                start_date, 
                is_active,
                session_statistics ( total_kills, total_diamonds, total_great_ones, total_rare_furs )
            `)
            .eq('user_id', supabaseId);

        if (error) throw error;

        // Busca Super Rares separadamente (Diamond + Rare Fur)
        const { data: superRareKills, error: srError } = await supabase
            .from('kill_records')
            .select('animal_id, fur_type_name, killed_at, trophy_score')
            .eq('user_id', supabaseId)
            .eq('is_diamond', true)
            .not('fur_type_id', 'is', null);

        if (srError) console.error('Erro ao buscar Super Rares:', srError);

        // Agrega por animal_id
        const statsMap: Record<string, any> = {};

        sessions?.forEach(session => {
            const animalId = session.animal_id;
            // Fallback para nome se não vier
            const animalName = session.animal_name || 'Desconhecido';

            if (!statsMap[animalId]) {
                statsMap[animalId] = {
                    animal_id: animalId,
                    animal_name: animalName,
                    total_kills: 0,
                    total_sessions: 0,
                    total_diamonds: 0,
                    total_great_ones: 0,
                    total_rares: 0,
                    super_rares: 0,
                    super_rare_list: [], // List of specific kills
                    last_session_date: session.start_date,
                    has_active_session: false
                };
            }

            const entry = statsMap[animalId];

            // Soma estatísticas
            const stats = session.session_statistics;
            let statsTotalKills = 0;

            if (stats) {
                const statsArray = Array.isArray(stats) ? stats : [stats];
                statsArray.forEach((s: any) => {
                    statsTotalKills += (s.total_kills || 0);
                    entry.total_diamonds += (s.total_diamonds || 0);
                    entry.total_great_ones += (s.total_great_ones || 0);
                    entry.total_rares += (s.total_rare_furs || 0);
                });
            }

            // Usa o maior valor entre a sessão e as estatísticas para evitar dados desatualizados
            // Isso corrige o bug onde grind_sessions.total_kills está atrasado em relação ao session_statistics
            const sessionKills = Math.max(session.total_kills || 0, statsTotalKills);
            entry.total_kills += sessionKills;

            entry.total_sessions += 1;

            // Atualiza data mais recente
            if (new Date(session.start_date) > new Date(entry.last_session_date)) {
                entry.last_session_date = session.start_date;
            }

            // Verifica se tem sessão ativa
            if (session.is_active) {
                entry.has_active_session = true;
            }
        });

        // Adiciona contagem e lista de Super Rares
        superRareKills?.forEach((sr: any) => {
            if (statsMap[sr.animal_id]) {
                statsMap[sr.animal_id].super_rares += 1;
                statsMap[sr.animal_id].super_rare_list.push({
                    fur_type: sr.fur_type_name,
                    date: sr.killed_at,
                    score: sr.trophy_score
                });
            }
        });

        // Formata para array e ordena por total de kills
        return Object.values(statsMap).sort((a: any, b: any) => b.total_kills - a.total_kills);

    } catch (err) {
        console.error('❌ Erro ao buscar estatísticas históricas:', err);
        return [];
    }
}

/**
 * Deletar todas as estatísticas do usuário (Reset Global)
 */
export async function deleteAllUserStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    try {
        // 1. Deleta estatísticas de sessão (tabela dependente)
        // Precisamos buscar os IDs das sessões primeiro para deletar as estatísticas
        const { data: sessions } = await supabase
            .from('grind_sessions')
            .select('id')
            .eq('user_id', supabaseId);

        if (sessions && sessions.length > 0) {
            const sessionIds = sessions.map(s => s.id);
            const { error: statsError } = await supabase
                .from('session_statistics')
                .delete()
                .in('session_id', sessionIds);

            if (statsError) console.error('Erro ao deletar session_statistics (pode não existir):', statsError);
        }

        // 2. Deleta registros de abate (FK constraint)
        const { error: killError } = await supabase
            .from('kill_records')
            .delete()
            .eq('user_id', supabaseId);

        if (killError) throw killError;

        // 3. Deleta sessões
        const { error: sessionError } = await supabase
            .from('grind_sessions')
            .delete()
            .eq('user_id', supabaseId);

        if (sessionError) throw sessionError;

        return true;
    } catch (err) {
        console.error('❌ Erro ao deletar estatísticas:', err);
        throw err;
    }
}
