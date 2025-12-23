import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Supabase URL or Anon Key missing in .env');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Implementação simplificada de SHA-1 para UUID v5
 */
function sha1(bytes: number[]): number[] {
    const K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];
    const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

    const newBytes = [...bytes, 0x80];
    while (newBytes.length % 64 !== 56) newBytes.push(0);
    const lenBits = bytes.length * 8;
    newBytes.push(0, 0, 0, 0);
    newBytes.push((lenBits >>> 24) & 0xff);
    newBytes.push((lenBits >>> 16) & 0xff);
    newBytes.push((lenBits >>> 8) & 0xff);
    newBytes.push(lenBits & 0xff);

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
            if (j < 20) { f = (b & c) | (~b & d); k = K[0]; }
            else if (j < 40) { f = b ^ c ^ d; k = K[1]; }
            else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = K[2]; }
            else { f = b ^ c ^ d; k = K[3]; }
            const temp = ((a << 5) | (a >>> 27)) + f + e + k + w[j];
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp | 0;
        }
        H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0;
    }
    const result: number[] = [];
    for (let i = 0; i < 5; i++) {
        result.push((H[i] >>> 24) & 0xff, (H[i] >>> 16) & 0xff, (H[i] >>> 8) & 0xff, H[i] & 0xff);
    }
    return result;
}

/**
 * Gera um UUID v5 determinístico
 */
function uuidv5(name: string, namespace: string): string {
    const namespaceHex = namespace.replace(/-/g, '');
    const namespaceBytes: number[] = [];
    for (let i = 0; i < 32; i += 2) namespaceBytes.push(parseInt(namespaceHex.substr(i, 2), 16));
    const nameStr = unescape(encodeURIComponent(name));
    const nameBytes: number[] = [];
    for (let i = 0; i < nameStr.length; i++) nameBytes.push(nameStr.charCodeAt(i));
    const hashBytes = sha1([...namespaceBytes, ...nameBytes]);
    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;
    const hex = hashBytes.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

/**
 * Converte ID do Firebase em UUID do Supabase
 */
export function getSupabaseUserId(userId: string): string {
    const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
    return userId.length === 36 ? userId : uuidv5(userId, NAMESPACE);
}
