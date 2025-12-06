/**
 * Script para corrigir species_name na tabela need_zones
 * Converte IDs (slugs) para nomes legíveis em pt-BR
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixNeedZonesSpeciesNames() {
    console.log('🔧 Iniciando correção da tabela need_zones...\n');

    // 1. Buscar todas as espécies
    const { data: species, error: speciesError } = await supabase
        .from('species')
        .select('id, name_ptbr, name_enus');

    if (speciesError) {
        console.error('❌ Erro ao buscar species:', speciesError);
        return;
    }

    console.log(`📋 Encontradas ${species.length} espécies\n`);

    // 2. Criar mapa de conversão (id → nome pt-BR)
    const idToNameMap = new Map();
    species.forEach(s => {
        // Normalizar o ID para slug (mesmo formato que está no need_zones)
        const slug = s.name_ptbr
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        idToNameMap.set(slug, s.name_ptbr);
        console.log(`  ${slug} → ${s.name_ptbr}`);
    });

    console.log('\n🔄 Atualizando need_zones...\n');

    // 3. Para cada entrada no mapa, atualizar need_zones
    let updated = 0;
    let errors = 0;

    for (const [oldName, newName] of idToNameMap.entries()) {
        const { error } = await supabase
            .from('need_zones')
            .update({ species_name: newName })
            .eq('species_name', oldName);

        if (error) {
            console.error(`❌ Erro ao atualizar ${oldName}:`, error);
            errors++;
        } else {
            console.log(`✅ ${oldName} → ${newName}`);
            updated++;
        }
    }

    console.log(`\n🎉 Concluído!`);
    console.log(`   Atualizados: ${updated}`);
    console.log(`   Erros: ${errors}`);
}

fixNeedZonesSpeciesNames().catch(console.error);
