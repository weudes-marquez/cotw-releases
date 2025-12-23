/**
 * Admin utility to populate need_zones from Firebase to Supabase
 * Called directly from the UI
 */

import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getNeedZones, getMaps, getSpecies } from './supabase_integration';
import { supabase } from './supabase_client';

interface MigrationProgress {
    totalSpecies: number;
    processedSpecies: number;
    insertedZones: number;
    errors: number;
    currentSpecies: string;
    isComplete: boolean;
}

export async function populateNeedZonesFromFirebase(
    firestore: any,
    onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationProgress> {

    const progress: MigrationProgress = {
        totalSpecies: 0,
        processedSpecies: 0,
        insertedZones: 0,
        errors: 0,
        currentSpecies: '',
        isComplete: false
    };

    try {
        // Step 1: Load Supabase mappings
        const { data: supabaseSpecies, error: speciesError } = await supabase
            .from('species')
            .select('id, name_ptbr');

        if (speciesError) throw speciesError;

        const speciesMap = new Map<string, string>();
        supabaseSpecies.forEach(s => {
            speciesMap.set(s.name_ptbr.toLowerCase(), s.id);
        });

        const { data: supabaseMaps, error: mapsError } = await supabase
            .from('maps')
            .select('id, name');

        if (mapsError) throw mapsError;

        const mapsMap = new Map<string, string>();
        supabaseMaps.forEach(m => {
            mapsMap.set(m.name.toLowerCase(), m.id);
        });

        // Step 2: Read Firebase species
        const speciesCollection = collection(firestore, 'species');
        const speciesDocs = await getDocs(speciesCollection);

        progress.totalSpecies = speciesDocs.size;
        onProgress?.(progress);

        // Step 3: Process each species
        for (const speciesDoc of speciesDocs.docs) {
            const speciesData = speciesDoc.data();
            const namePtBr = speciesData.name?.['pt-BR'];

            if (!namePtBr) {
                progress.processedSpecies++;
                continue;
            }

            const speciesUuid = speciesMap.get(namePtBr.toLowerCase());
            if (!speciesUuid) {
                progress.processedSpecies++;
                continue;
            }

            progress.currentSpecies = namePtBr;
            onProgress?.(progress);

            const needZones = speciesData.needZones;
            if (!needZones || typeof needZones !== 'object') {
                progress.processedSpecies++;
                continue;
            }

            const zoneKeys = Object.keys(needZones).filter(k => !isNaN(Number(k)));

            for (const zoneKey of zoneKeys) {
                const zone = needZones[zoneKey];

                if (!zone || typeof zone !== 'object') continue;

                const { mapId, time, type } = zone;

                if (!time || !type) {
                    progress.errors++;
                    continue;
                }

                const timeParts = time.split('-');
                if (timeParts.length !== 2) {
                    progress.errors++;
                    continue;
                }
                const [startTime, endTime] = timeParts;

                // Resolve map_id
                let mapUuid: string | null = null;
                if (mapId) {
                    try {
                        const mapDocRef = doc(firestore, 'maps', mapId);
                        const mapDocSnap = await getDoc(mapDocRef);

                        if (mapDocSnap.exists()) {
                            const mapName = mapDocSnap.data().name;
                            if (mapName) {
                                mapUuid = mapsMap.get(mapName.toLowerCase()) || null;
                            }
                        }
                    } catch (error) {
                        console.warn('Error fetching map:', error);
                    }
                }

                // Insert into Supabase (keep Portuguese zone types)
                const insertData = {
                    species_id: speciesUuid,
                    map_id: mapUuid,
                    zone_type: type,
                    start_time: startTime.trim(),
                    end_time: endTime.trim()
                };

                console.log('Inserting:', insertData);

                const { error } = await supabase.from('need_zones').insert(insertData);

                if (error) {
                    console.error('Insert error:', error);
                    progress.errors++;
                } else {
                    progress.insertedZones++;
                }

                onProgress?.(progress);
            }

            progress.processedSpecies++;
            onProgress?.(progress);
        }

        progress.isComplete = true;
        progress.currentSpecies = 'Concluído!';
        onProgress?.(progress);

        return progress;

    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    }
}
