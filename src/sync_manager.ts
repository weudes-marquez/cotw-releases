import { supabase, getSupabaseUserId } from './supabase_client';
import { db } from './db_local';
import type { LocalGrindSession, LocalKillRecord } from './db_local';

class SyncManager {
    private isSyncing = false;
    private userId: string | null = null;

    setUserId(id: string | undefined) {
        this.userId = id ? getSupabaseUserId(id) : null;
    }

    /**
     * Sincroniza todos os dados pendentes locais para o Supabase (PUSH)
     */
    async pushPendingChanges() {
        if (this.isSyncing || !this.userId) return;
        this.isSyncing = true;

        try {
            // 1. Sincronizar Sessões Pendentes
            const pendingSessions = await db.grind_sessions
                .where('sync_status')
                .equals('pending')
                .toArray();

            for (const session of pendingSessions) {
                const { error } = await supabase
                    .from('grind_sessions')
                    .upsert({
                        id: session.id,
                        user_id: session.user_id,
                        animal_id: session.animal_id,
                        animal_name: session.animal_name,
                        start_date: session.start_date,
                        is_active: session.is_active,
                        // Removido total_kills e current_session_kills para evitar conflito com triggers do servidor
                        updated_at: new Date().toISOString()
                    });

                if (error) {
                    console.error('❌ Erro ao sincronizar sessão:', session.id, error);
                } else {
                    console.log('✅ Sessão sincronizada:', { id: session.id, kills: session.total_kills });
                    await db.grind_sessions.update(session.id, {
                        sync_status: 'synced',
                        last_synced_at: new Date().toISOString()
                    });
                }
            }

            // 2. Sincronizar Abates Pendentes
            const pendingKills = await db.kill_records
                .where('sync_status')
                .equals('pending')
                .toArray();

            for (const kill of pendingKills) {
                const { error } = await supabase
                    .from('kill_records')
                    .upsert({
                        id: kill.id,
                        session_id: kill.session_id,
                        user_id: kill.user_id,
                        animal_id: kill.animal_id,
                        kill_number: kill.kill_number,
                        is_diamond: kill.is_diamond,
                        is_great_one: kill.is_great_one,
                        is_troll: kill.is_troll,
                        fur_type_id: kill.fur_type_id,
                        fur_type_name: kill.fur_type_name,
                        weight: kill.weight,
                        trophy_score: kill.trophy_score,
                        difficulty_level: kill.difficulty_level,
                        killed_at: kill.killed_at
                    });

                if (!error) {
                    await db.kill_records.update(kill.id, {
                        sync_status: 'synced',
                        last_synced_at: new Date().toISOString()
                    });
                }
            }

            console.log('✅ Sincronização (Push) concluída com sucesso');
        } catch (error) {
            console.error('❌ Erro durante a sincronização (Push):', error);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Baixa os dados mais recentes do Supabase para o banco local (PULL)
     */
    async pullLatestData() {
        if (!this.userId) return;

        try {
            // 1. Puxar Sessões Ativas
            const { data: sessions } = await supabase
                .from('grind_sessions')
                .select('*')
                .eq('user_id', this.userId)
                .eq('is_active', true);

            if (sessions) {
                for (const s of sessions) {
                    // Atualiza apenas se o servidor tiver dados mais recentes E não tivermos mudanças pendentes locais
                    const localSession = await db.grind_sessions.get(s.id);

                    // Se temos mudanças pendentes locais, IGNORAMOS o servidor por enquanto para não voltar o contador
                    if (localSession && localSession.sync_status === 'pending') {
                        continue;
                    }

                    if (!localSession || localSession.total_kills !== s.total_kills) {
                        await db.grind_sessions.put({
                            ...s,
                            sync_status: 'synced',
                            last_synced_at: new Date().toISOString()
                        });
                    }
                }
            }

            // 2. Puxar Estatísticas
            if (sessions && sessions.length > 0) {
                const sessionIds = sessions.map(s => s.id);
                const { data: stats } = await supabase
                    .from('session_statistics')
                    .select('*')
                    .in('session_id', sessionIds);

                if (stats) {
                    for (const st of stats) {
                        await db.session_statistics.put(st);
                    }
                }
            }

            console.log('✅ Sincronização (Pull) concluída com sucesso');
        } catch (error) {
            console.error('❌ Erro durante a sincronização (Pull):', error);
        }
    }

    /**
     * Inicia o monitoramento de mudanças para sincronização automática
     */
    startAutoSync(intervalMs = 30000) {
        // Tenta sincronizar imediatamente
        this.pushPendingChanges();

        // Configura o intervalo de "batimento cardíaco"
        setInterval(() => {
            this.pushPendingChanges();
        }, intervalMs);
    }
}

export const syncManager = new SyncManager();
