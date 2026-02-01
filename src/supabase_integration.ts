// ============================================================================
// COTW GRIND TRACKER - SUPABASE INTEGRATION
// ============================================================================
// Gerenciamento de persistência de dados e sincronização com Supabase
// ============================================================================

import React from 'react';
import { supabase, getSupabaseUserId } from './supabase_client';
import { db } from './db_local';
import { syncManager } from './sync_manager';
import type { UserProfile, GrindSession, SessionStatistics, KillRecord, MapData, NeedZoneData } from './types';

// Supabase client and helpers are now imported from ./supabase_client

/**
 * Autenticação anônima com Supabase
 */
export async function authenticateWithFirebase(_token: string) {
    try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) return true;
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('❌ Erro na autenticação Supabase:', err);
        return false;
    }
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

export async function getActiveSession(userId: string, animalId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('grind_sessions')
        .select('*')
        .eq('user_id', supabaseId)
        .eq('animal_id', animalId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('❌ Erro ao buscar sessão ativa:', error);
        return null;
    }
    return data as GrindSession | null;
}

export async function createGrindSession(userId: string, animalId: string, animalName: string) {
    if (!animalId || animalId === 'undefined' || !animalName) {
        throw new Error('Dados do animal inválidos para criação de sessão');
    }
    const supabaseId = getSupabaseUserId(userId);
    const { data, error } = await supabase
        .from('grind_sessions')
        .insert({
            user_id: supabaseId,
            animal_id: animalId,
            animal_name: animalName,
            start_date: new Date().toISOString(),
            is_active: true,
            total_kills: 0,
            current_session_kills: 0
        })
        .select()
        .single();

    if (error) throw error;
    return data as GrindSession;
}

export async function getSessionStatistics(sessionId: string): Promise<SessionStatistics> {
    const { data, error } = await supabase
        .from('session_statistics')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

    if (error) console.error('❌ Erro ao buscar estatísticas:', error);

    return (data as SessionStatistics) || {
        session_id: sessionId,
        total_kills: 0,
        total_diamonds: 0,
        total_great_ones: 0,
        total_rare_furs: 0,
        total_trolls: 0
    };
}

export async function getSessionKills(sessionId: string) {
    const { data, error } = await supabase
        .from('kill_records')
        .select('*')
        .eq('session_id', sessionId)
        .order('kill_number', { ascending: false });

    if (error) throw error;
    return data as KillRecord[];
}

export async function finishGrindOrSession(sessionId: string, clearStats: boolean = false) {
    const updateData = clearStats
        ? { is_active: false, updated_at: new Date().toISOString() }
        : { current_session_kills: 0, updated_at: new Date().toISOString() };

    const { error } = await supabase
        .from('grind_sessions')
        .update(updateData)
        .eq('id', sessionId);

    if (error) throw error;
    return true;
}

export async function registerKill(sessionId: string, userId: string, animalId: string, animalName: string, killData: any) {
    const supabaseId = getSupabaseUserId(userId);
    try {
        const isDiamond = killData.isDiamond || false;
        const isGreatOne = killData.isGreatOne || false;
        const isTroll = killData.isTroll || false;
        const furTypeId = killData.furTypeId || null;

        let query = supabase
            .from('kill_records')
            .select('id, kill_number')
            .eq('session_id', sessionId)
            .eq('is_diamond', isDiamond)
            .eq('is_great_one', isGreatOne)
            .eq('is_troll', isTroll);

        if (furTypeId === null) query = query.is('fur_type_id', null);
        else query = query.eq('fur_type_id', furTypeId);

        const { data: existingRecord } = await query.maybeSingle();

        if (existingRecord) {
            const { error: updateError } = await supabase
                .from('kill_records')
                .update({
                    kill_number: (existingRecord.kill_number || 0) + 1,
                    weight: killData.weight || null,
                    trophy_score: killData.trophyScore || null,
                    difficulty_level: killData.difficultyLevel || null,
                    killed_at: new Date().toISOString()
                })
                .eq('id', existingRecord.id);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('kill_records')
                .insert({
                    session_id: sessionId,
                    user_id: supabaseId,
                    animal_id: animalId,
                    kill_number: 1,
                    is_diamond: isDiamond,
                    is_great_one: isGreatOne,
                    is_troll: isTroll,
                    fur_type_id: furTypeId,
                    fur_type_name: killData.furTypeName || null,
                    weight: killData.weight || null,
                    trophy_score: killData.trophyScore || null,
                    difficulty_level: killData.difficultyLevel || null,
                    killed_at: new Date().toISOString()
                });
            if (insertError) throw insertError;
        }
        return true;
    } catch (error) {
        console.error('❌ Erro ao registrar abate:', error);
        throw error;
    }
}

// ============================================================================
// HOOKS
// ============================================================================

export function useGrindSession(
    userId: string | undefined,
    animalId: string,
    animalName: string,
    shouldCreate: boolean = false,
    preferredSessionId?: string | null
) {
    const [session, setSession] = React.useState<GrindSession | null>(null);
    const [stats, setStats] = React.useState<SessionStatistics | null>(null);
    const [globalTotal, setGlobalTotal] = React.useState(0);
    const [loading, setLoading] = React.useState(false);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const loadingRef = React.useRef(false);
    const lastAnimalIdRef = React.useRef<string | null>(null);

    const loadSession = React.useCallback(async () => {
        if (!userId || !animalId || animalId === 'undefined') return;

        // Proteção contra race conditions: marcamos qual animal estamos tentando carregar agora
        const loadingAnimalId = animalId;
        setLoading(true);

        // Inicializa o SyncManager com o ID do usuário
        syncManager.setUserId(userId);

        try {
            // 1. Tenta carregar do Banco Local primeiro (Instantâneo)
            let activeSession = preferredSessionId
                ? await db.grind_sessions.get(preferredSessionId)
                : await db.grind_sessions
                    .where('user_id').equals(getSupabaseUserId(userId))
                    .and(s => s.animal_id === animalId && s.is_active)
                    .first();

            // 2. Se não tem local, tenta buscar no Supabase (Fallback)
            if (!activeSession) {
                activeSession = preferredSessionId
                    ? (await supabase.from('grind_sessions').select('*').eq('id', preferredSessionId).single()).data
                    : await getActiveSession(userId, animalId);

                // Se achou no Supabase, salva no local para cache
                if (activeSession) {
                    await db.grind_sessions.put({
                        ...activeSession,
                        sync_status: 'synced'
                    });
                }
            }

            // CRÍTICO: Se o animalId mudou enquanto esperávamos o banco/rede, abortamos
            if (loadingAnimalId !== animalId) return;

            // 3. Se ainda não tem e deve criar, cria localmente primeiro
            if (!activeSession && shouldCreate && animalName) {
                const newId = crypto.randomUUID();
                activeSession = {
                    id: newId,
                    user_id: getSupabaseUserId(userId),
                    animal_id: animalId,
                    animal_name: animalName,
                    start_date: new Date().toISOString(),
                    is_active: true,
                    total_kills: 0,
                    current_session_kills: 0,
                    sync_status: 'pending'
                };

                await db.grind_sessions.add(activeSession);

                syncManager.pushPendingChanges();
            }

            if (activeSession && loadingAnimalId === animalId) {
                setSession(activeSession);

                const localStats = await db.session_statistics.get(activeSession.id);
                if (localStats) {
                    setStats(localStats);
                } else {
                    const remoteStats = await getSessionStatistics(activeSession.id);
                    if (loadingAnimalId === animalId) {
                        setStats(remoteStats);
                        await db.session_statistics.put(remoteStats);
                    }
                }

                const allLocal = await db.grind_sessions
                    .where('user_id').equals(getSupabaseUserId(userId))
                    .and(s => s.animal_id === animalId && s.is_active) // Soma apenas sessões ATIVAS
                    .toArray();

                const total = allLocal.reduce((sum, s) => sum + (s.total_kills || 0), 0);
                if (loadingAnimalId === animalId) {
                    setGlobalTotal(total);
                }
            }

            syncManager.pullLatestData();

        } catch (error) {
            console.error('❌ Erro em loadSession:', error);
        } finally {
            if (loadingAnimalId === animalId) {
                setLoading(false);
            }
        }
    }, [userId, animalId, shouldCreate, animalName, preferredSessionId]);

    // Reset imediato ao trocar de animal (Render-time reset)
    const effectiveSession = (session && session.animal_id === animalId) ? session : null;
    const effectiveStats = (session && session.animal_id === animalId) ? stats : null;
    const effectiveGlobalTotal = (session && session.animal_id === animalId) ? globalTotal : 0;

    React.useEffect(() => {
        if (lastAnimalIdRef.current !== animalId) {
            setSession(null);
            setStats(null);
            setGlobalTotal(0);
            lastAnimalIdRef.current = animalId;
        }
        if (userId && animalId && animalId !== 'undefined') loadSession();
    }, [userId, animalId, shouldCreate, preferredSessionId, loadSession]);

    async function addKill(isDiamond = false, isGreatOne = false, furTypeId?: string, furTypeName?: string, isTroll = false, weight: number | null = null, trophyScore: number | null = null, difficultyLevel: number | null = null) {
        if (!effectiveSession || !userId) return;

        // SEGURANÇA: Garante que não estamos adicionando abate em um animal diferente do selecionado
        if (effectiveSession.animal_id !== animalId) {
            console.error('❌ TENTATIVA DE ABATE EM ANIMAL ERRADO:', { sessionAnimal: effectiveSession.animal_id, selectedAnimal: animalId });
            return;
        }

        const supabaseUserId = getSupabaseUserId(userId);

        // 1. Tenta encontrar um registro local existente para agrupar (Hybrid Counter)
        const allKills = await db.kill_records.where('session_id').equals(effectiveSession.id).toArray();
        const existingKill = allKills.find(k =>
            k.is_diamond === isDiamond &&
            k.is_great_one === isGreatOne &&
            k.is_troll === isTroll &&
            (k.fur_type_id === (furTypeId || null))
        );

        if (existingKill) {
            await db.kill_records.update(existingKill.id, {
                kill_number: (existingKill.kill_number || 0) + 1,
                weight: weight || existingKill.weight,
                trophy_score: trophyScore || existingKill.trophy_score,
                difficulty_level: difficultyLevel || existingKill.difficulty_level,
                killed_at: new Date().toISOString(),
                sync_status: 'pending'
            });
        } else {
            const killId = crypto.randomUUID();
            await db.kill_records.add({
                id: killId,
                session_id: effectiveSession.id,
                user_id: supabaseUserId,
                animal_id: animalId,
                kill_number: 1,
                is_diamond: isDiamond,
                is_great_one: isGreatOne,
                is_troll: isTroll,
                fur_type_id: furTypeId || null,
                fur_type_name: furTypeName || null,
                weight,
                trophy_score: trophyScore,
                difficulty_level: difficultyLevel,
                killed_at: new Date().toISOString(),
                sync_status: 'pending'
            });
        }

        const updatedSession = {
            ...effectiveSession,
            current_session_kills: (effectiveSession.current_session_kills || 0) + 1,
            total_kills: (effectiveSession.total_kills || 0) + 1
        };
        await db.grind_sessions.update(effectiveSession.id, {
            ...updatedSession,
            sync_status: 'pending'
        });

        setSession(updatedSession);
        setGlobalTotal(prev => prev + 1);
        // REMOVIDO: syncManager.pushPendingChanges(); -> Agora o SyncManager roda em intervalo (batching)
    }

    async function removeLastKill() {
        if (!effectiveSession || !userId) return;

        const lastKill = await db.kill_records
            .where('session_id').equals(effectiveSession.id)
            .toArray()
            .then(kills => kills.sort((a, b) => b.killed_at.localeCompare(a.killed_at))[0]);

        if (lastKill) {
            if (lastKill.kill_number > 1) {
                await db.kill_records.update(lastKill.id, {
                    kill_number: lastKill.kill_number - 1,
                    sync_status: 'pending'
                });
            } else {
                await db.kill_records.delete(lastKill.id);
            }

            const updatedSession = {
                ...effectiveSession,
                current_session_kills: Math.max(0, (effectiveSession.current_session_kills || 0) - 1),
                total_kills: Math.max(0, (effectiveSession.total_kills || 0) - 1)
            };
            await db.grind_sessions.update(effectiveSession.id, {
                ...updatedSession,
                sync_status: 'pending'
            });

            setSession(updatedSession);
            setGlobalTotal(prev => Math.max(0, prev - 1));
            // REMOVIDO: syncManager.pushPendingChanges(); -> Batching
        }
    }

    async function finishCurrentSession(clearStats = false) {
        if (!effectiveSession) return;
        try {
            // 1. Atualiza no Supabase
            await finishGrindOrSession(effectiveSession.id, clearStats);

            // 2. Atualiza no Local
            if (clearStats) {
                // Se está finalizando o grind, removemos a sessão ativa local
                await db.grind_sessions.update(effectiveSession.id, { is_active: false, sync_status: 'synced' });
                // Removemos os abates desta sessão localmente para limpar o cache
                await db.kill_records.where('session_id').equals(effectiveSession.id).delete();
                setSession(null);
                setStats(null);
            } else {
                // Se está apenas resetando a sessão (contador laranja), zeramos localmente
                await db.grind_sessions.update(effectiveSession.id, { current_session_kills: 0, sync_status: 'synced' });
                setSession(prev => prev ? { ...prev, current_session_kills: 0 } : null);
            }

            // Não chamamos pushPendingChanges aqui porque já fizemos o update direto no Supabase
            // via finishGrindOrSession para garantir a ordem das operações.
        } catch (error) {
            console.error('Error finishing session:', error);
        }
    }

    return {
        session: effectiveSession,
        stats: effectiveStats,
        globalTotal: effectiveGlobalTotal,
        loading,
        isSyncing,
        addKill,
        removeLastKill,
        finishCurrentSession,
        reload: loadSession
    };
}

// ============================================================================
// ADDITIONAL EXPORTS
// ============================================================================

export async function trackUserActivity(userId: string, email: string) {
    const supabaseId = getSupabaseUserId(userId);
    await supabase.from('user_profiles').upsert({ id: supabaseId, email: email, updated_at: new Date().toISOString() }, { onConflict: 'id' });
}

export async function getActiveSessions(userId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data: sessions } = await supabase.from('grind_sessions').select('*').eq('user_id', supabaseId).eq('is_active', true).order('start_date', { ascending: false });
    if (!sessions) return [];
    const { data: stats } = await supabase.from('session_statistics').select('*').in('session_id', sessions.map(s => s.id));
    const { data: rareKills } = await supabase.from('kill_records').select('session_id, fur_type_name').in('session_id', sessions.map(s => s.id)).not('fur_type_id', 'is', null);
    const { data: trollKills } = await supabase.from('kill_records').select('session_id').in('session_id', sessions.map(s => s.id)).eq('is_troll', true);

    return sessions.map(s => ({
        ...s,
        session_id: s.id,
        total_diamonds: stats?.find(st => st.session_id === s.id)?.total_diamonds || 0,
        total_great_ones: stats?.find(st => st.session_id === s.id)?.total_great_ones || 0,
        total_rare_furs: stats?.find(st => st.session_id === s.id)?.total_rare_furs || 0,
        total_trolls: trollKills?.filter(tk => tk.session_id === s.id).length || 0,
        rare_furs: rareKills?.filter(rk => rk.session_id === s.id).map(rk => rk.fur_type_name) || []
    }));
}

export async function getMaps() {
    const { data } = await supabase.from('maps').select('*').order('name', { ascending: true });
    return data || [];
}

export async function getNeedZones(speciesName: string) {
    const { data: species } = await supabase.from('species').select('id').eq('name_ptbr', speciesName).single();
    if (!species) return [];
    const { data } = await supabase.from('need_zones').select('*, maps(name)').eq('species_id', species.id);
    return data?.map(z => ({ ...z, map_name: z.maps?.name || 'Unknown' })) || [];
}

export async function createMap(name: string, firestoreId?: string) {
    const { data: existing } = await supabase.from('maps').select('id').eq('name', name).maybeSingle();
    if (existing) return existing;
    const { data } = await supabase.from('maps').insert({ name, firestore_id: firestoreId }).select().single();
    return data;
}

export async function createNeedZone(speciesName: string, mapId: string, zoneType: string, startTime: string, endTime: string) {
    const { data: existing } = await supabase.from('need_zones').select('id').eq('species_name', speciesName).eq('map_id', mapId).eq('zone_type', zoneType).eq('start_time', startTime).eq('end_time', endTime).maybeSingle();
    if (existing) return existing;
    const { data } = await supabase.from('need_zones').insert({ species_name: speciesName, map_id: mapId, zone_type: zoneType, start_time: startTime, end_time: endTime }).select().single();
    return data;
}

export async function getSpecies() {
    const { data } = await supabase.from('species').select('*').order('name_ptbr', { ascending: true });
    return data || [];
}

export async function getUserHistoricalStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data: sessions } = await supabase.from('grind_sessions').select('*, session_statistics(*)').eq('user_id', supabaseId);
    // Buscar TODOS os abates que possuem pelagem (Raros e Super Raros)
    const { data: allRares } = await supabase.from('kill_records').select('*').eq('user_id', supabaseId).not('fur_type_id', 'is', null);
    // Buscar TODOS os abates que são Trolls
    const { data: allTrolls } = await supabase.from('kill_records').select('*').eq('user_id', supabaseId).eq('is_troll', true);

    const statsMap: Record<string, any> = {};
    sessions?.forEach(s => {
        if (!statsMap[s.animal_id]) statsMap[s.animal_id] = {
            animal_id: s.animal_id,
            animal_name: s.animal_name,
            total_kills: 0,
            total_diamonds: 0,
            total_great_ones: 0,
            total_rares: 0,
            total_trolls: 0,
            super_rares: 0,
            super_rare_list: [],
            last_session_date: s.start_date,
            has_active_session: false,
            total_sessions: 0
        };
        const entry = statsMap[s.animal_id];
        // Conta TODOS os Grinds (Ativos e Finalizados)
        entry.total_sessions++;
        const st = s.session_statistics;
        entry.total_kills += Math.max(s.total_kills || 0, st?.total_kills || 0);
        entry.total_diamonds += st?.total_diamonds || 0;
        entry.total_great_ones += st?.total_great_ones || 0;
        entry.total_rares += st?.total_rare_furs || 0;
        if (new Date(s.start_date) > new Date(entry.last_session_date)) entry.last_session_date = s.start_date;
        if (s.is_active) entry.has_active_session = true;
    });

    allRares?.forEach(sr => {
        if (statsMap[sr.animal_id]) {
            const entry = statsMap[sr.animal_id];
            if (sr.is_diamond) {
                // É um Super Raro
                entry.super_rares++;
                entry.super_rare_list.push({
                    fur_type: sr.fur_type_name,
                    date: sr.killed_at,
                    score: sr.trophy_score
                });
            } else {
                // É um Raro comum
                if (!entry.rare_types) entry.rare_types = [];
                if (sr.fur_type_name && !entry.rare_types.includes(sr.fur_type_name)) {
                    entry.rare_types.push(sr.fur_type_name);
                }
            }
        }
    });
    allTrolls?.forEach(t => {
        if (statsMap[t.animal_id]) {
            statsMap[t.animal_id].total_trolls++;
        }
    });
    return Object.values(statsMap).sort((a: any, b: any) => b.total_kills - a.total_kills);
}

export async function deleteAllUserStats(userId: string) {
    const supabaseId = getSupabaseUserId(userId);

    // 1. Deletar no Supabase
    const { data: sessions } = await supabase.from('grind_sessions').select('id').eq('user_id', supabaseId);
    if (sessions?.length) {
        const sessionIds = sessions.map(s => s.id);
        await supabase.from('session_statistics').delete().in('session_id', sessionIds);
        await supabase.from('kill_records').delete().in('session_id', sessionIds);
        await supabase.from('grind_sessions').delete().in('id', sessionIds);
    }

    // 2. Deletar no Banco Local (Dexie)
    await db.kill_records.where('user_id').equals(supabaseId).delete();
    await db.grind_sessions.where('user_id').equals(supabaseId).delete();
    await db.session_statistics.clear(); // Limpa cache de estatísticas

    return true;
}

export async function getAnimalGlobalStats(userId: string, animalId: string) {
    const supabaseId = getSupabaseUserId(userId);
    const { data } = await supabase.from('grind_sessions').select('total_kills').eq('user_id', supabaseId).eq('animal_id', animalId);
    return { totalKills: data?.reduce((sum, s) => sum + (s.total_kills || 0), 0) || 0, totalGrinds: data?.length || 0 };
}

export async function getFurTypes() {
    const { data } = await supabase.from('fur_types').select('*').order('name', { ascending: true });
    return data || [];
}

export async function upsertUserProfile(id: string, email: string, displayName: string) {
    const supabaseId = getSupabaseUserId(id);
    await supabase.from('user_profiles').upsert({ id: supabaseId, email, display_name: displayName, updated_at: new Date().toISOString() });
}
