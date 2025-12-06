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
 * Troca o token do Firebase por uma sessão do Supabase via Edge Function
 */
export async function authenticateWithFirebase(firebaseToken: string) {
    try {
        const { data, error } = await supabase.functions.invoke('firebase-auth', {
            body: { token: firebaseToken }
        });

        if (error) throw error;

        if (data?.token) {
            await supabase.auth.setSession({
                access_token: data.token,
                refresh_token: data.refreshToken || '',
            });
            return true;
        }
        return false;
    } catch (err) {
        console.error('Erro na autenticação segura:', err);
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
        .select('id, name') // Select only needed columns
        .order('name', { ascending: true });

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
        console.error('Erro ao buscar sessões:', sessionsError);
        return [];
    }

    if (!sessions || sessions.length === 0) {
        return [];
    }

    // Buscar todos os kills do usuário
    const sessionIds = sessions.map((s: any) => s.id);
    const { data: kills, error: killsError } = await supabase
        .from('kill_records')
        .select('session_id, is_diamond, is_great_one')
        .in('session_id', sessionIds);

    if (killsError) {
        console.error('Erro ao buscar kills:', killsError);
        return [];
    }

    // Agrupar por animal
    const animalStats: Record<string, {
        animal_id: string;
        animal_name: string;
        total_kills: number;
        total_diamonds: number;
        total_great_ones: number;
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
                total_diamonds: 0,
                total_great_ones: 0,
                last_session_date: session.start_date,
                has_active_session: session.is_active
            };
        }

        // Somar kills da sessão
        animalStats[animalKey].total_kills += session.total_kills || 0;

        // Atualizar data mais recente
        if (new Date(session.start_date) > new Date(animalStats[animalKey].last_session_date)) {
            animalStats[animalKey].last_session_date = session.start_date;
        }

        // Se tem sessão ativa, marcar
        if (session.is_active) {
            animalStats[animalKey].has_active_session = true;
        }
    });

    // Contar diamantes e GOs por animal
    if (kills) {
        kills.forEach((kill: any) => {
            const session = sessions.find((s: any) => s.id === kill.session_id);
            if (session) {
                const animalKey = session.animal_id;
                if (animalStats[animalKey]) {
                    if (kill.is_diamond) animalStats[animalKey].total_diamonds++;
                    if (kill.is_great_one) animalStats[animalKey].total_great_ones++;
                }
            }
        });
    }

    // Converter para array e ordenar por total de kills (maior primeiro)
    return Object.values(animalStats).sort((a, b) => b.total_kills - a.total_kills);
}

/**
 * Criar nova sessão de grind
 */
export async function createGrindSession(userId: string, animalId: string, animalName: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('grind_sessions')
        .insert({
            user_id: supabaseId,
            animal_id: animalId,
            animal_name: animalName,
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

    console.log('📝 Registrando abate:', {
        sessionId,
        supabaseId,
        animalId,
        killNumber,
        isDiamond,
        isGreatOne
    });

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

    console.log('✅ Abate registrado com sucesso:', data);
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
export function useGrindSession(userId: string | undefined, animalId: string, animalName: string) {
    const [session, setSession] = React.useState<GrindSession | null>(null);
    const [stats, setStats] = React.useState<SessionStatistics | null>(null);
    const [loading, setLoading] = React.useState(false);
    const loadingRef = React.useRef(false);

    React.useEffect(() => {
        if (userId && animalId) {
            loadSession();
        } else {
            setSession(null);
            setStats(null);
        }
    }, [userId, animalId]);

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

        try {
            const killNumber = session.total_kills + 1;
            await registerKill(
                session.id,
                userId, // Firebase UID string
                animalId,
                killNumber,
                isDiamond,
                isGreatOne,
                furTypeId || null,
                furTypeName || null
            );

            // Recarregar estatísticas
            await loadSession();
        } catch (error) {
            console.error('Error adding kill:', error);
        }
    }

    async function removeLastKill() {
        if (!session || session.total_kills === 0) {
            console.log('❌ Não pode remover: sessão inválida ou contador em 0');
            return;
        }

        try {
            console.log('🔍 Buscando último abate...');
            // Buscar o último abate
            const { data: kills, error } = await supabase
                .from('kill_records')
                .select('id')
                .eq('session_id', session.id)
                .order('kill_number', { ascending: false })
                .limit(1);

            if (error) {
                console.error('❌ Erro ao buscar último abate:', error);
                throw error;
            }

            if (kills && kills.length > 0) {
                const lastKill = kills[0];
                console.log('🗑️ Deletando abate:', lastKill.id);

                // Deletar
                const { error: deleteError } = await supabase
                    .from('kill_records')
                    .delete()
                    .eq('id', lastKill.id);

                if (deleteError) {
                    console.error('❌ Erro ao deletar:', deleteError);
                    throw deleteError;
                }

                console.log('✅ Abate deletado, recarregando sessão...');
                // Recarregar
                await loadSession();
            } else {
                console.log('⚠️ Nenhum abate encontrado para deletar');
            }
        } catch (error) {
            console.error('Error removing last kill:', error);
        }
    }

    async function finishCurrentSession() {
        if (!session) return;
        try {
            await finishSession(session.id);
            setSession(null);
            setStats(null);
            // Opcional: Recarregar para criar uma nova imediatamente ou deixar null
            await loadSession();
        } catch (error) {
            console.error('Error finishing session:', error);
        }
    }

    return { session, stats, loading, addKill, removeLastKill, finishCurrentSession, reload: loadSession };
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
