/**
 * Script to populate need_zones from Firebase
 * Properly maps Firebase data to Supabase with correct FKs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Firebase config
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

// Supabase config
const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function populateNeedZones() {
    console.log(' Starting need_zones population...\n');

    // Step 1: Get species mapping (Firebase ID -> Supabase UUID)
    console.log(' Loading species mapping...');
    const { data: speciesData, error: speciesError } = await supabase
        .from('species')
        .select('id, name_ptbr, name_enus');

    if (speciesError) {
        console.error(' Error loading species:', speciesError);
        return;
    }

    const speciesMap = new Map<string, string>();
    speciesData.forEach(s => {
        // Map both pt-BR and en-US names to UUID
        speciesMap.set(s.name_ptbr.toLowerCase(), s.id);
        speciesMap.set(s.name_enus.toLowerCase(), s.id);
    });
    console.log( Loaded  species mappings\n);

    // Step 2: Get maps mapping (Firebase name -> Supabase UUID)
    console.log('  Loading maps mapping...');
    const { data: mapsData, error: mapsError } = await supabase
        .from('maps')
        .select('id, name');

    if (mapsError) {
        console.error(' Error loading maps:', mapsError);
        return;
    }

    const mapsMap = new Map<string, string>();
    mapsData.forEach(m => {
        mapsMap.set(m.name.toLowerCase(), m.id);
    });
    console.log( Loaded  maps mappings\n);

    // Step 3: Read need zones from Firebase
    console.log(' Reading need_zones from Firebase...');
    const needZonesRef = collection(firestore, 'need_zones');
    const snapshot = await getDocs(needZonesRef);
    console.log( Found  documents\n);

    // Step 4: Transform and insert into Supabase
    console.log(' Inserting into Supabase...');
    let inserted = 0;
    let errors = 0;
    const batchSize = 100;
    let batch: any[] = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Get species_id from mapping
        const speciesKey = (data.species_name || doc.id).toLowerCase();
        const species_id = speciesMap.get(speciesKey);

        if (!species_id) {
            console.warn(  Species not found: );
            errors++;
            continue;
        }

        // Get map_id from mapping (if exists)
        const map_id = data.map_name ? mapsMap.get(data.map_name.toLowerCase()) : null;

        // Add to batch
        batch.push({
            species_id,
            map_id,
            zone_type: data.zone_type || data.type,
            start_time: data.start_time,
            end_time: data.end_time
        });

        // Insert batch when full
        if (batch.length >= batchSize) {
            const { error } = await supabase.from('need_zones').insert(batch);
            if (error) {
                console.error(' Batch insert error:', error);
                errors += batch.length;
            } else {
                inserted += batch.length;
                console.log( Inserted  zones...);
            }
            batch = [];
        }
    }

    // Insert remaining
    if (batch.length > 0) {
        const { error } = await supabase.from('need_zones').insert(batch);
        if (error) {
            console.error(' Final batch error:', error);
            errors += batch.length;
        } else {
            inserted += batch.length;
        }
    }

    console.log('\n Done!');
    console.log(   Inserted: );
    console.log(   Errors: );
}

populateNeedZones().catch(console.error);
