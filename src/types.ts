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
    total_trolls: number;
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

// Dummy export to ensure the file is not empty after transpilation
export const TYPES_VERSION = '1.0.0';
