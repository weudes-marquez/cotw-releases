/**
 * Script to populate need_zones from Firebase to Supabase
 * Handles the complex nested structure with proper FK resolution
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Load .env from current directory
config({ path: resolve(process.cwd(), '.env') });

// Debug: Check if env vars are loaded
console.log('🔍 Checking environment variables...');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('VITE_SUPABASE_SERVICE_ROLE_KEY:', process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? '✅ Loaded' : '❌ Missing');
console.log('VITE_FIREBASE_API_KEY:', process.env.VITE_FIREBASE_API_KEY ? '✅ Loaded' : '❌ Missing');

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n❌ Missing required environment variables!');
    console.error('Make sure you have a .env file with:');
    console.error('  - VITE_SUPABASE_URL');
    console.error('  - VITE_SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Firebase config from .env
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY!,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.VITE_FIREBASE_APP_ID!
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// Supabase config - REQUIRES SERVICE_ROLE_KEY!
const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function populateNeedZones() {
    console.log('🚀 Starting need_zones population from Firebase to Supabase\n');

    // Step 1: Build Supabase species mapping (name_ptbr -> UUID)
    console.log('📋 Loading Supabase species...');
    const { data: supabaseSpecies, error: speciesError } = await supabase
        .from('species')
        .select('id, name_ptbr');

    if (speciesError) {
        console.error('❌ Error loading Supabase species:', speciesError);
        return;
    }

    const speciesMap = new Map<string, string>();
    supabaseSpecies.forEach(s => {
        speciesMap.set(s.name_ptbr.toLowerCase(), s.id);
    });
    console.log(`✅ Loaded ${speciesMap.size} species from Supabase\n`);

    // Step 2: Build Supabase maps mapping (name -> UUID)
    console.log('🗺️  Loading Supabase maps...');
    const { data: supabaseMaps, error: mapsError } = await supabase
        .from('maps')
        .select('id, name');

    if (mapsError) {
        console.error('❌ Error loading Supabase maps:', mapsError);
        return;
    }

    const mapsMap = new Map<string, string>();
    supabaseMaps.forEach(m => {
        mapsMap.set(m.name.toLowerCase(), m.id);
    });
    console.log(`✅ Loaded ${mapsMap.size} maps from Supabase\n`);

    // Step 3: Read Firebase species collection
    console.log('🔥 Reading Firebase species collection...');
    const speciesCollection = collection(firestore, 'species');
    const speciesDocs = await getDocs(speciesCollection);
    console.log(`✅ Found ${speciesDocs.size} species documents in Firebase\n`);

    // Step 4: Process each species
    let totalInserted = 0;
    let totalErrors = 0;
    let skippedSpecies = 0;

    for (const speciesDoc of speciesDocs.docs) {
        const speciesData = speciesDoc.data();
        const speciesFirebaseId = speciesDoc.id;

        // Get pt-BR name
        const namePtBr = speciesData.name?.['pt-BR'];
        if (!namePtBr) {
            console.warn(`⚠️  Species ${speciesFirebaseId} has no pt-BR name, skipping`);
            skippedSpecies++;
            continue;
        }

        // Get Supabase species UUID
        const speciesUuid = speciesMap.get(namePtBr.toLowerCase());
        if (!speciesUuid) {
            console.warn(`⚠️  Species "${namePtBr}" not found in Supabase, skipping`);
            skippedSpecies++;
            continue;
        }

        console.log(`\n🦌 Processing: ${namePtBr} (${speciesFirebaseId})`);

        // Get needZones object
        const needZones = speciesData.needZones;
        if (!needZones || typeof needZones !== 'object') {
            console.log(`   No need zones found`);
            continue;
        }

        // Process each zone (0, 1, 2, ...)
        const zoneKeys = Object.keys(needZones).filter(k => !isNaN(Number(k)));
        console.log(`   Found ${zoneKeys.length} zones`);

        for (const zoneKey of zoneKeys) {
            const zone = needZones[zoneKey];

            if (!zone || typeof zone !== 'object') {
                console.warn(`   ⚠️  Zone ${zoneKey} is invalid, skipping`);
                continue;
            }

            const { mapId, time, type } = zone;

            // Validate required fields
            if (!time || !type) {
                console.warn(`   ⚠️  Zone ${zoneKey} missing time or type, skipping`);
                totalErrors++;
                continue;
            }

            // Split time into start_time and end_time
            const timeParts = time.split('-');
            if (timeParts.length !== 2) {
                console.warn(`   ⚠️  Zone ${zoneKey} has invalid time format: ${time}`);
                totalErrors++;
                continue;
            }
            const [startTime, endTime] = timeParts;

            // Resolve map_id (if exists)
            let mapUuid: string | null = null;
            if (mapId) {
                try {
                    // Get map name from Firebase
                    const mapDocRef = doc(firestore, 'maps', mapId);
                    const mapDocSnap = await getDoc(mapDocRef);

                    if (mapDocSnap.exists()) {
                        const mapName = mapDocSnap.data().name;
                        if (mapName) {
                            mapUuid = mapsMap.get(mapName.toLowerCase()) || null;
                            if (!mapUuid) {
                                console.warn(`   ⚠️  Map "${mapName}" not found in Supabase`);
                            }
                        }
                    } else {
                        console.warn(`   ⚠️  Map ${mapId} not found in Firebase`);
                    }
                } catch (error) {
                    console.warn(`   ⚠️  Error fetching map ${mapId}:`, error);
                }
            }

            // Insert into Supabase
            const { error } = await supabase.from('need_zones').insert({
                species_id: speciesUuid,
                map_id: mapUuid,
                zone_type: type,
                start_time: startTime.trim(),
                end_time: endTime.trim()
            });

            if (error) {
                console.error(`   ❌ Error inserting zone ${zoneKey}:`, error.message);
                totalErrors++;
            } else {
                totalInserted++;
                console.log(`   ✅ Zone ${zoneKey}: ${type} ${startTime}-${endTime} ${mapUuid ? '(mapped)' : '(no map)'}`);
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Migration Complete!');
    console.log(`   ✅ Inserted: ${totalInserted} zones`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log(`   ⚠️  Skipped species: ${skippedSpecies}`);
    console.log('='.repeat(50));
}

// Run the migration
populateNeedZones()
    .then(() => {
        console.log('\n✅ Script finished successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    });
