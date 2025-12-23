import { Dexie, type Table } from 'dexie';
import type { GrindSession, KillRecord, SessionStatistics } from './types';

// Estendemos as interfaces para incluir o status de sincronização local
export interface LocalGrindSession extends GrindSession {
    sync_status: 'synced' | 'pending' | 'error';
    last_synced_at?: string;
}

export interface LocalKillRecord extends KillRecord {
    sync_status: 'synced' | 'pending' | 'error';
    last_synced_at?: string;
}

// O banco de dados local
export class CotwLocalDB extends Dexie {
    grind_sessions!: Table<LocalGrindSession>;
    kill_records!: Table<LocalKillRecord>;
    session_statistics!: Table<SessionStatistics>; // Cache das estatísticas calculadas pelo Supabase

    constructor() {
        super('CotwGrindTrackerDB');

        // Definimos o esquema das tabelas
        // O Dexie usa uma sintaxe simplificada: '++id' para auto-incremento, 'coluna' para indexar
        this.version(1).stores({
            grind_sessions: 'id, user_id, animal_id, is_active, sync_status',
            kill_records: 'id, session_id, user_id, animal_id, sync_status, killed_at',
            session_statistics: 'session_id'
        });
    }
}

export const db = new CotwLocalDB();

/**
 * Helper para marcar um registro como pendente de sincronização
 */
export async function markAsPending(table: 'grind_sessions' | 'kill_records', id: string) {
    if (table === 'grind_sessions') {
        await db.grind_sessions.update(id, { sync_status: 'pending' });
    } else {
        await db.kill_records.update(id, { sync_status: 'pending' });
    }
}

/**
 * Helper para marcar como sincronizado
 */
export async function markAsSynced(table: 'grind_sessions' | 'kill_records', id: string) {
    if (table === 'grind_sessions') {
        await db.grind_sessions.update(id, { sync_status: 'synced', last_synced_at: new Date().toISOString() });
    } else {
        await db.kill_records.update(id, { sync_status: 'synced', last_synced_at: new Date().toISOString() });
    }
}
