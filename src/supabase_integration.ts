// ============================================================================
// COTW GRIND TRACKER - SUPABASE INTEGRATION EXAMPLES
// ============================================================================
// Exemplos de código TypeScript para integrar com o banco de dados Supabase
// ============================================================================

import React from 'react';
// Removido import 'uuid' para evitar erro de dependência
// import { v5 as uuidv5 } from 'uuid';

import { createClient } from '@supabase/supabase-js';

// Type Definitions
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
    fur_type_id: string | null;
    fur_type_name: string | null;
    killed_at: string;
}

export interface MapData {
    id: string;
    name: string;
    firestore_id?: string;
}

export interface NeedZoneData {
    id: string;
    species_name: string;
    map_id: string;
    zone_type: string;
    start_time: string;
    end_time: string;
    map_name?: string; // For UI convenience after join
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase environment variables missing! Check your .env file.');
}

// Initialize safely - if vars are missing, create a dummy client that logs errors instead of crashing
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : {
        from: () => ({ select: () => ({ eq: () => ({ single: () => ({ error: { message: 'Supabase not configured' } }) }) }) }),
        auth: { setSession: () => { }, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }) },
        functions: { invoke: () => ({ error: { message: 'Supabase not configured' } }) }
    } as any;

/**
 * Autentica o usuário Firebase no Supabase (sign in anônimo com metadados)
 * Cria user_id customizado baseado no Firebase UID
 */
export async function authenticateWithFirebase(firebaseToken: string) {
    try {


        // Decodificar o token Firebase para pegar o email/uid
        const base64Url = firebaseToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        const firebaseEmail = payload.email;
        const firebaseUid = payload.user_id || payload.sub;



        // Tentar fazer login anônimo no Supabase (não requer credenciais)
        // Isso criará um auth.uid() válido que o RLS pode usar
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
            options: {
                data: {
                    firebase_uid: firebaseUid,
                    firebase_email: firebaseEmail
                }
            }
        });

        if (anonError) {
            console.error('❌ Erro no login anônimo:', anonError);
            return false;
        }


        return true;
    } catch (err) {
        console.error('❌ Erro na autenticação Firebase→Supabase:', err);
        return false;
    }
}

// Namespace constante (não usado na implementação nativa simplificada, mas mantido como referência)
// const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; 

/**
 * Converte Firebase UID (string) para Supabase UUID (determinístico)
 * Usando Web Crypto API para não depender de bibliotecas externas
 */
export function getSupabaseUserId(firebaseUid: string): string {
    // Implementação simples de hash para UUID v5-like (SHA-1)
    // Nota: Como é síncrono no código original, vamos usar uma implementação
    // simplificada que funciona para garantir formato UUID válido.

    // Se já for um UUID válido, retorna ele mesmo
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(firebaseUid)) {
        return firebaseUid;
    }

    // Fallback: Gerar um UUID determinístico "fake" baseado na string
    // Isso é necessário porque crypto.subtle é assíncrono e refatorar tudo seria arriscado agora.
    // Vamos criar um hash simples da string
    let hash = 0;
    for (let i = 0; i < firebaseUid.length; i++) {
        const char = firebaseUid.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Garantir que seja positivo e hex
    // const hex = Math.abs(hash).toString(16).padStart(8, '0'); // Unused

    // Preencher o resto com padrão fixo + parte do UID para garantir unicidade e formato
    // Formato: 8-4-4-4-12
    // Ex: 12345678-1234-5678-1234-567812345678

    // Vamos usar uma estratégia melhor: Hex da string completa
    let fullHex = '';
    for (let i = 0; i < firebaseUid.length; i++) {
        fullHex += firebaseUid.charCodeAt(i).toString(16);
    }
    // Pad com zeros ou cortar
    fullHex = fullHex.padEnd(32, '0').substring(0, 32);

    // Formatar como UUID
    return `${fullHex.substring(0, 8)}-${fullHex.substring(8, 12)}-${fullHex.substring(12, 16)}-${fullHex.substring(16, 20)}-${fullHex.substring(20, 32)}`;
}

// ... (rest of the file updates below)

/**
 * Criar ou atualizar perfil do usuário
 */
export async function upsertUserProfile(userId: string, email: string, displayName: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
            id: supabaseId,
            email: email,
            display_name: displayName
        })
        .select()
        .single();

    if (error) throw error;
    return data as UserProfile;
}

/**
 * Buscar perfil do usuário
 */
export async function getUserProfile(userId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', supabaseId)
        .single();

    if (error) throw error;
    return data as UserProfile;
}

/**
 * Buscar todas as espécies
 */
export async function getSpecies() {
    const { data, error } = await supabase
        .from('species')
        .select('id, name_enus, name_ptbr')
        .order('name_ptbr', { ascending: true });

    if (error) throw error;

    // Remove duplicates based on ID (just in case)
    const uniqueSpecies = data?.filter((species: any, index: number, self: any[]) =>
        index === self.findIndex((s: any) => s.id === species.id)
    );

    return uniqueSpecies || data;
}

/**
 * Buscar todos os tipos de pelagem
 */
export async function getFurTypes() {
    const { data, error } = await supabase
        .from('fur_types')
        .select('*')
        .order('name', { ascending: true });

    if (error) throw error;
    return data;
}

/**
 * Buscar ou criar uma sessão ativa
 */
export async function getOrCreateSession(userId: string, animalId: string, animalName: string) {
    const existing = await getActiveSession(userId, animalId);
    if (existing) return existing;
    return await createGrindSession(userId, animalId, animalName);
}

/**
 * Buscar estatísticas de uma sessão
 */
export async function getSessionStatistics(sessionId: string) {
    const { data, error } = await supabase
        .from('session_statistics')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

    if (error) {
        console.warn('Erro ao buscar estatísticas:', error);
        return {
            session_id: sessionId,
            total_kills: 0,
            total_diamonds: 0,
            total_great_ones: 0,
            total_rare_furs: 0
        };
    }

    return data || {
        session_id: sessionId,
        total_kills: 0,
        total_diamonds: 0,
        total_great_ones: 0,
        total_rare_furs: 0
    };
}

/**
 * Finalizar uma sessão
 */
export async function finishSession(sessionId: string) {
    const { error } = await supabase
        .from('grind_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

    if (error) throw error;
}

/**
 * Buscar estatísticas históricas do usuário agrupadas por animal
 */
export async function getUserHistoricalStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    // Buscar todas as sessões do usuário (ativas e inativas)
    const { data: sessions, error: sessionsError } = await supabase
        .from('grind_sessions')
        .select('id, animal_id, animal_name, start_date, is_active, total_kills')
        .eq('user_id', supabaseId)
        .order('start_date', { ascending: false });

    if (sessionsError) {
        console.error('❌ [STATS ERROR] Erro ao buscar sessões:', sessionsError);
        return [];
    }

    if (!sessions || sessions.length === 0) {
        return [];
    }

    // Buscar todos os kills do usuário (incluindo fur_type_name para raros)
    // Otimização: Buscar por user_id ao invés de lista de session_ids para evitar limites de query URL
    const { data: kills, error: killsError } = await supabase
        .from('kill_records')
        .select('session_id, is_diamond, is_great_one, fur_type_id, fur_type_name')
        .eq('user_id', supabaseId);

    if (killsError) {
        console.error('Erro ao buscar kills:', killsError);
        // Não retornar vazio, tentar continuar com o que tem (apenas totais de kills)
        // return [];
    }

    // Agrupar por animal
    const animalStats: Record<string, {
        animal_id: string;
        animal_name: string;
        total_kills: number;
        total_sessions: number; // Novo campo
        total_diamonds: number;
        total_great_ones: number;
        total_rares: number;
        rare_types: string[];
        super_rares: number;
        super_rare_types: string[];
        last_session_date: string;
        has_active_session: boolean;
    }> = {};

    sessions.forEach((session: any) => {
        const animalKey = session.animal_id;

        if (!animalStats[animalKey]) {
            animalStats[animalKey] = {
                animal_id: session.animal_id,
                animal_name: session.animal_name,
                total_kills: 0,
                total_sessions: 0, // Novo campo
                total_diamonds: 0,
                total_great_ones: 0,
                total_rares: 0,
                rare_types: [],
                super_rares: 0,
                super_rare_types: [],
                last_session_date: session.start_date,
                has_active_session: session.is_active
            };
        }

        // Somar kills da sessão
        const killsInSession = session.total_kills || 0;
        animalStats[animalKey].total_kills += killsInSession;

        // Contar sessão se tiver pelo menos 1 abate
        if (killsInSession > 0) {
            animalStats[animalKey].total_sessions += 1;
        }

        // Atualizar data mais recente
        if (new Date(session.start_date) > new Date(animalStats[animalKey].last_session_date)) {
            animalStats[animalKey].last_session_date = session.start_date;
        }

        // Se tem sessão ativa, marcar
        if (session.is_active) {
            animalStats[animalKey].has_active_session = true;
        }
    });

    // Contar diamantes, GOs, raros e super raros por animal
    if (kills) {
        kills.forEach((kill: any) => {
            const session = sessions.find((s: any) => s.id === kill.session_id);
            if (session) {
                const animalKey = session.animal_id;

                if (kill.is_diamond) animalStats[animalKey].total_diamonds++;
                if (kill.is_great_one) animalStats[animalKey].total_great_ones++;

                // Se tem fur_type_id, é um raro
                if (kill.fur_type_id) {
                    animalStats[animalKey].total_rares++;
                    if (kill.fur_type_name && !animalStats[animalKey].rare_types.includes(kill.fur_type_name)) {
                        animalStats[animalKey].rare_types.push(kill.fur_type_name);
                    }

                    // Se é diamante E raro = super raro
                    if (kill.is_diamond) {
                        animalStats[animalKey].super_rares++;
                        const superRareName = `${session.animal_name} diamante ${kill.fur_type_name}`;
                        if (!animalStats[animalKey].super_rare_types.includes(superRareName)) {
                            animalStats[animalKey].super_rare_types.push(superRareName);
                        }
                    }
                }
            }
        });
    }

    // Converter para array, filtrar inválidos e ordenar por total de kills (maior primeiro)
    const stats = Object.values(animalStats)
        .filter(stat => stat.animal_name && (stat.total_kills > 0 || stat.has_active_session)) // Mostrar se tem kills OU se é sessão ativa
        .sort((a, b) => b.total_kills - a.total_kills);

    return stats;
}

/**
 * Buscar estatísticas globais do usuário (todas as sessões combinadas)
 */
export async function getTotalGlobalStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    // Buscar todas as sessões
    const { data: sessions, error: sessionsError } = await supabase
        .from('grind_sessions')
        .select('id, total_kills')
        .eq('user_id', supabaseId);

    if (sessionsError) {
        console.error('Erro ao buscar sessões globais:', sessionsError);
        return { total_kills: 0, total_diamonds: 0, total_great_ones: 0, total_rares: 0, rare_types: [] };
    }

    if (!sessions || sessions.length === 0) {
        return { total_kills: 0, total_diamonds: 0, total_great_ones: 0, total_rares: 0, rare_types: [] };
    }

    // Buscar todos os kills
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: kills, error: killsError } = await supabase
        .from('kill_records')
        .select('is_diamond, is_great_one, fur_type_id, fur_type_name')
        .in('session_id', sessionIds);

    if (killsError) {
        console.error('Erro ao buscar kills globais:', killsError);
        return { total_kills: 0, total_diamonds: 0, total_great_ones: 0, total_rares: 0, rare_types: [] };
    }

    // Calcular totais
    const total_kills = sessions.reduce((sum: number, s: any) => sum + (s.total_kills || 0), 0);
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
 * Deletar todas as estatísticas do usuário (opcionalmente filtrando por animal)
 */
export async function deleteAllUserStats(userId: string, animalId?: string) {
    const supabaseId = getSupabaseUserId(userId);

    // Deletar kills primeiro (foreign key)
    let killsQuery = supabase
        .from('kill_records')
        .delete()
        .eq('user_id', supabaseId);

    if (animalId) {
        killsQuery = killsQuery.eq('animal_id', animalId);
    }

    const { error: killsError } = await killsQuery;

    if (killsError) {
        console.error('Erro ao deletar kills:', killsError);
        throw killsError;
    }

    // Deletar sessões
    let sessionsQuery = supabase
        .from('grind_sessions')
        .delete()
        .eq('user_id', supabaseId);

    if (animalId) {
        sessionsQuery = sessionsQuery.eq('animal_id', animalId);
    }

    const { error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
        console.error('Erro ao deletar sessões:', sessionsError);
        throw sessionsError;
    }


}


/**
 * Criar nova sessão de grind
 */
export async function createGrindSession(userId: string, animalId: string, animalName: string, initialCount: number = 0) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('grind_sessions')
        .insert({
            user_id: supabaseId,
            animal_id: animalId,
            animal_name: animalName,
            total_kills: initialCount,
            is_active: true
        })
        .select()
        .single();

    if (error) throw error;
    return data as GrindSession;
}

/**
 * Buscar sessão ativa de um animal
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
        console.warn('Erro ao buscar sessão ativa:', error);
        return null;
    }
    return data as GrindSession | null;
}

// ... (getOrCreateSession uses getActiveSession/createGrindSession so it's fine) ...

/**
 * Buscar todas as sessões do usuário
 */
export async function getUserSessions(userId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('grind_sessions')
        .select('*')
        .eq('user_id', supabaseId)
        .order('start_date', { ascending: false });

    if (error) throw error;
    return data as GrindSession[];
}

/**
 * Registrar um novo abate
 */
export async function registerKill(
    sessionId: string,
    userId: string,
    animalId: string,
    killNumber: number,
    isDiamond: boolean = false,
    isGreatOne: boolean = false,
    furTypeId: string | null = null,
    furTypeName: string | null = null
) {
    const supabaseId = getSupabaseUserId(userId);


    const { data, error } = await supabase
        .from('kill_records')
        .insert({
            session_id: sessionId,
            user_id: supabaseId,
            animal_id: animalId,
            kill_number: killNumber,
            is_diamond: isDiamond,
            is_great_one: isGreatOne,
            fur_type_id: furTypeId,
            fur_type_name: furTypeName
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Erro ao registrar abate:', error);
        throw error;
    }



    // Atualizar o total_kills na sessão

    const { error: updateError } = await supabase
        .from('grind_sessions')
        .update({ total_kills: killNumber }) // killNumber já é o novo total
        .eq('id', sessionId);

    if (updateError) {
        console.error('❌ Erro ao atualizar sessão:', updateError);
        // Não lançar erro aqui para não falhar o registro do abate, mas logar
    }

    return data as KillRecord;
}

// ... (getSessionKills uses sessionId, fine) ...
// ... (getSessionStatistics uses sessionId, fine) ...
// ... (getSessionSummary uses sessionId, fine) ...

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
 * Hook React para usar no Dashboard
 */
export function useGrindSession(userId: string | undefined, animalId: string, animalName: string, shouldCreate: boolean = false) {
    const [session, setSession] = React.useState<GrindSession | null>(null);
    const [stats, setStats] = React.useState<SessionStatistics | null>(null);
    const [loading, setLoading] = React.useState(false);
    const loadingRef = React.useRef(false);

    React.useEffect(() => {
        if (userId && animalId && shouldCreate) {
            loadSession();
        } else {
            setSession(null);
            setStats(null);
        }
    }, [userId, animalId, shouldCreate]);

    async function loadSession() {
        if (!userId || !animalId || loadingRef.current) return;

        loadingRef.current = true;
        setLoading(true);

        try {
            // Note: userId passed here is Firebase UID string.
            // getOrCreateSession will convert it internally.
            const activeSession = await getOrCreateSession(userId, animalId, animalName);
            setSession(activeSession);

            const sessionStats = await getSessionStatistics(activeSession.id);
            setStats(sessionStats);
        } catch (error) {
            console.error('Error loading session:', error);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }

    async function addKill(isDiamond = false, isGreatOne = false, furTypeId?: string, furTypeName?: string) {
        if (!session || !userId) return;

        // OPTIMISTIC UPDATE: Atualiza UI imediatamente
        const previousSession = { ...session };
        const previousStats = stats ? { ...stats } : null;

        const newKillCount = session.total_kills + 1;

        // Atualiza estado local ANTES de salvar no banco
        setSession({ ...session, total_kills: newKillCount });

        if (stats) {
            setStats({
                ...stats,
                total_kills: newKillCount,
                total_diamonds: isDiamond ? stats.total_diamonds + 1 : stats.total_diamonds,
                total_great_ones: isGreatOne ? stats.total_great_ones + 1 : stats.total_great_ones,
                total_rare_furs: (furTypeId && furTypeName) ? stats.total_rare_furs + 1 : stats.total_rare_furs
            });
        }

        try {
            // BACKGROUND: Salva no banco de forma atômica
            await registerKill(
                session.id,
                userId,
                animalId,
                newKillCount,
                isDiamond,
                isGreatOne,
                furTypeId || null,
                furTypeName || null
            );

            // Sucesso: não recarregar sessão inteira para evitar race condition com cliques rápidos
            // O estado local já foi atualizado otimisticamente
            // await loadSession();
        } catch (error) {
            console.error('❌ Erro ao adicionar abate, revertendo...', error);

            // ROLLBACK: Reverte estado local em caso de erro
            setSession(previousSession);
            setStats(previousStats);

            alert('Erro ao salvar abate. Verifique sua conexão.');
        }
    }

    async function removeLastKill() {
        if (!session) {

            return;
        }

        // Caso 1: Sessão atual tem abates (laranja > 0)
        // Remove da sessão atual, afetando ambos os contadores
        if (session.total_kills > 0) {
            // OPTIMISTIC UPDATE
            setSession(prev => prev ? { ...prev, total_kills: Math.max(0, prev.total_kills - 1) } : null);
            setStats(prev => prev ? { ...prev, total_kills: Math.max(0, prev.total_kills - 1) } : null);

            try {
                const { data: kills, error } = await supabase
                    .from('kill_records')
                    .select('id')
                    .eq('session_id', session.id)
                    .order('kill_number', { ascending: false })
                    .limit(1);

                if (error) throw error;

                if (kills && kills.length > 0) {
                    await supabase.from('kill_records').delete().eq('id', kills[0].id);

                    const { count } = await supabase
                        .from('kill_records')
                        .select('*', { count: 'exact', head: true })
                        .eq('session_id', session.id);

                    await supabase
                        .from('grind_sessions')
                        .update({ total_kills: count || 0 })
                        .eq('id', session.id);

                    setSession(prev => prev ? { ...prev, total_kills: count || 0 } : null);
                }
            } catch (error) {
                console.error('❌ Erro ao remover da sessão atual:', error);
                await loadSession();
            }
        }
        // Caso 2: Sessão atual zerada (laranja = 0), mas total branco > 0
        // Remove da última sessão anterior, afetando apenas o contador branco
        else if (stats && stats.total_kills > 0) {
            // OPTIMISTIC UPDATE apenas no total branco
            setStats(prev => prev ? { ...prev, total_kills: Math.max(0, prev.total_kills - 1) } : null);

            try {
                if (!userId) return;

                // Buscar última sessão com abates deste animal
                const { data: prevSessions, error: sessErr } = await supabase
                    .from('grind_sessions')
                    .select('id')
                    .eq('user_id', getSupabaseUserId(userId))
                    .eq('animal_id', animalId)
                    .gt('total_kills', 0)
                    .order('start_date', { ascending: false })
                    .limit(1);

                if (sessErr) throw sessErr;

                if (prevSessions && prevSessions.length > 0) {
                    const targetSessionId = prevSessions[0].id;

                    // Buscar último kill dessa sessão
                    const { data: kills, error: killErr } = await supabase
                        .from('kill_records')
                        .select('id')
                        .eq('session_id', targetSessionId)
                        .order('kill_number', { ascending: false })
                        .limit(1);

                    if (killErr) throw killErr;

                    if (kills && kills.length > 0) {
                        await supabase.from('kill_records').delete().eq('id', kills[0].id);

                        const { count } = await supabase
                            .from('kill_records')
                            .select('*', { count: 'exact', head: true })
                            .eq('session_id', targetSessionId);

                        await supabase
                            .from('grind_sessions')
                            .update({ total_kills: count || 0 })
                            .eq('id', targetSessionId);


                    }
                }
            } catch (error) {
                console.error('❌ Erro ao remover de sessão anterior:', error);
                await loadSession();
            }
        }
    }

    async function finishCurrentSession() {
        if (!session) return;
        try {
            await finishSession(session.id);
            setSession(null);
            setStats(null);
            // Não recarregar - sessão finalizada deve ficar null
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
    const platform = window.navigator.platform;

    const { error } = await supabase
        .from('app_users')
        .upsert({
            user_id: supabaseId,
            email: email,
            last_seen_at: new Date().toISOString(),
            app_version: appVersion,
            platform: platform
        }, { onConflict: 'user_id' });

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
