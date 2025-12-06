const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
// Using the project ID from your config
admin.initializeApp({
    projectId: 'cotw-pin-planner'
});

const db = admin.firestore();

async function exportSpeciesToSQL() {
    try {
        console.log('🔥 Fetching species from Firestore (Admin SDK)...');

        const snapshot = await db.collection('species').get();

        const species = [];
        snapshot.forEach((doc) => {
            species.push({
                id: doc.id,
                name: doc.data().name || ''
            });
        });

        console.log(`✅ Found ${species.length} species`);

        // Sort by name
        species.sort((a, b) => a.name.localeCompare(b.name));

        // Save JSON
        fs.writeFileSync('firebase-species-export.json', JSON.stringify(species, null, 2));
        console.log('✅ Saved JSON to firebase-species-export.json');

        // Generate SQL
        let sql = '-- Species exported from Firebase Firestore\n';
        sql += `-- Total: ${species.length} animals\n`;
        sql += `-- Exported: ${new Date().toISOString()}\n\n`;
        sql += 'INSERT INTO species (id, name) VALUES\n';

        const values = species.map((s, idx) => {
            const id = s.id.replace(/'/g, "''");
            const name = s.name.replace(/'/g, "''");
            const comma = idx < species.length - 1 ? ',' : ';';
            return `('${id}', '${name}')${comma}`;
        });

        sql += values.join('\n');
        sql += '\n\n-- Verify\nSELECT COUNT(*) as total FROM species;\nSELECT * FROM species ORDER BY name LIMIT 10;';

        fs.writeFileSync('firebase-species-insert.sql', sql);
        console.log('✅ Saved SQL to firebase-species-insert.sql');

        console.log('\n📊 First 10 species:');
        species.slice(0, 10).forEach(s => {
            console.log(`  ${s.id} → ${s.name}`);
        });

        console.log('\n✅ Done! Files created:');
        console.log('  - firebase-species-export.json');
        console.log('  - firebase-species-insert.sql');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

exportSpeciesToSQL();
