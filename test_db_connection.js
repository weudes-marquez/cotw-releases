import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Configurar dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '.env');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Variáveis de ambiente faltando.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- SHA-1 Implementation (Sync) ---
function sha1(bytes) {
    const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
    const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

    // Pre-processing
    // Append 0x80
    const newBytes = [...bytes, 0x80];

    // Append 0s until length = 448 mod 512 (56 mod 64)
    while (newBytes.length % 64 !== 56) {
        newBytes.push(0);
    }

    // Append length in bits (64-bit integer)
    const lenBits = bytes.length * 8;
    // We only handle 32-bit length for simplicity here (files < 500MB)
    newBytes.push(0, 0, 0, 0); // High 32 bits
    newBytes.push((lenBits >>> 24) & 0xff);
    newBytes.push((lenBits >>> 16) & 0xff);
    newBytes.push((lenBits >>> 8) & 0xff);
    newBytes.push(lenBits & 0xff);

    // Process chunks
    for (let i = 0; i < newBytes.length; i += 64) {
        const w = new Array(80);
        for (let j = 0; j < 16; j++) {
            w[j] = (newBytes[i + j * 4] << 24) | (newBytes[i + j * 4 + 1] << 16) | (newBytes[i + j * 4 + 2] << 8) | (newBytes[i + j * 4 + 3]);
        }
        for (let j = 16; j < 80; j++) {
            const t = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
            w[j] = (t << 1) | (t >>> 31);
        }

        let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4];

        for (let j = 0; j < 80; j++) {
            let f, k;
            if (j < 20) {
                f = (b & c) | (~b & d);
                k = K[0];
            } else if (j < 40) {
                f = b ^ c ^ d;
                k = K[1];
            } else if (j < 60) {
                f = (b & c) | (b & d) | (c & d);
                k = K[2];
            } else {
                f = b ^ c ^ d;
                k = K[3];
            }

            const temp = ((a << 5) | (a >>> 27)) + f + e + k + w[j];
            e = d;
            d = c;
            c = (b << 30) | (b >>> 2);
            b = a;
            a = temp | 0;
        }

        H[0] = (H[0] + a) | 0;
        H[1] = (H[1] + b) | 0;
        H[2] = (H[2] + c) | 0;
        H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0;
    }

    // Output 20 bytes
    const result = [];
    for (let i = 0; i < 5; i++) {
        result.push((H[i] >>> 24) & 0xff);
        result.push((H[i] >>> 16) & 0xff);
        result.push((H[i] >>> 8) & 0xff);
        result.push(H[i] & 0xff);
    }
    return result;
}

// --- UUID v5 Implementation ---
function uuidv5(name, namespace) {
    // 1. Parse Namespace UUID (remove dashes, convert to bytes)
    const namespaceHex = namespace.replace(/-/g, '');
    const namespaceBytes = [];
    for (let i = 0; i < 32; i += 2) {
        namespaceBytes.push(parseInt(namespaceHex.substr(i, 2), 16));
    }

    // 2. Convert Name to UTF-8 Bytes
    const nameStr = unescape(encodeURIComponent(name));
    const nameBytes = [];
    for (let i = 0; i < nameStr.length; i++) {
        nameBytes.push(nameStr.charCodeAt(i));
    }

    // 3. Concatenate: Namespace + Name
    const inputBytes = [...namespaceBytes, ...nameBytes];

    // 4. SHA-1 Hash
    const hashBytes = sha1(inputBytes);

    // 5. Format as UUID v5
    // Set version to 5 (0x50) at byte 6
    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
    // Set variant to 1 (0x80) at byte 8
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;

    // 6. Convert to Hex String
    const hex = hashBytes.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');

    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

function getSupabaseUserId(userId) {
    const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
    const generatedId = uuidv5(userId, NAMESPACE);
    console.log(`🔐 ID Gerado para '${userId}': ${generatedId}`);
    return generatedId;
}

async function testConnection() {
    try {
        console.log('\n--- TESTE 1: Conexão Básica ---');
        const { data: species, error: speciesError } = await supabase.from('species').select('count', { count: 'exact', head: true });

        if (speciesError) {
            console.error('❌ Falha na conexão:', speciesError.message);
            return;
        }
        console.log('✅ Conexão estabelecida! Espécies encontradas:', species);

        console.log('\n--- TESTE 2: Geração de ID e Inserção ---');
        const testFirebaseId = 'TEST_USER_123';
        const supabaseId = getSupabaseUserId(testFirebaseId);

        // Tentar buscar sessões existentes
        const { data: sessions, error: readError } = await supabase
            .from('grind_sessions')
            .select('*')
            .eq('user_id', supabaseId);

        if (readError) {
            console.error('❌ Erro ao ler sessões:', readError.message);
        } else {
            console.log(`✅ Sessões encontradas para este usuário: ${sessions.length}`);
        }

        console.log('\n--- TESTE 3: Inserção de Sessão de Teste ---');
        const { data: animal } = await supabase.from('species').select('id, name_ptbr').limit(1).single();

        if (!animal) {
            console.error('❌ Nenhum animal encontrado para teste.');
            return;
        }

        const newSession = {
            user_id: supabaseId,
            animal_id: animal.id,
            animal_name: animal.name_ptbr,
            start_date: new Date().toISOString(),
            is_active: true,
            total_kills: 0
        };

        const { data: sessionData, error: insertError } = await supabase
            .from('grind_sessions')
            .insert(newSession)
            .select()
            .single();

        if (insertError) {
            console.error('❌ Erro ao criar sessão:', insertError.message);
            console.error('Detalhes:', insertError);
        } else {
            console.log('✅ Sessão criada com sucesso:', sessionData.id);

            console.log('🧹 Limpando dados de teste...');
            await supabase.from('grind_sessions').delete().eq('id', sessionData.id);
            console.log('✅ Dados limpos.');
        }

    } catch (err) {
        console.error('❌ Exceção não tratada:', err);
    }
}

testConnection();
