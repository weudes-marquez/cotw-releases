// src/app/api/grind-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';
import { adminAuth, initError } from '@/lib/firebase-admin';
import crypto from 'crypto';

// ============================================================================
// LÓGICA DE GERAÇÃO DE ID (Idêntica ao Electron App)
// ============================================================================
// O app Electron usa UUID v5 (SHA-1) determinístico baseado no ID do Firebase.
// Precisamos replicar EXATAMENTE a mesma lógica aqui para que o Next.js
// encontre os MESMOS dados que o Electron salvou.

function sha1(bytes: number[]): number[] {
    // Implementação simplificada usando o módulo crypto do Node.js
    // Já que estamos no servidor (Next.js API Route), podemos usar 'crypto' nativo.
    const buffer = Buffer.from(bytes);
    const hash = crypto.createHash('sha1').update(buffer).digest();
    return Array.from(hash);
}

function uuidv5(name: string, namespace: string): string {
    const namespaceHex = namespace.replace(/-/g, '');
    const namespaceBytes: number[] = [];
    for (let i = 0; i < 32; i += 2) {
        namespaceBytes.push(parseInt(namespaceHex.substr(i, 2), 16));
    }

    // Node.js trata strings como UTF-8 por padrão, mas para garantir compatibilidade
    // com a implementação "unescape(encodeURIComponent(name))" do browser/electron:
    const nameStr = unescape(encodeURIComponent(name));
    const nameBytes: number[] = [];
    for (let i = 0; i < nameStr.length; i++) {
        nameBytes.push(nameStr.charCodeAt(i));
    }

    const inputBytes = [...namespaceBytes, ...nameBytes];
    const hashBytes = sha1(inputBytes);

    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x50;
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;

    const hex = hashBytes.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

function getSupabaseUserId(firebaseUid: string): string {
    const NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
    const generatedId = uuidv5(firebaseUid, NAMESPACE);
    // console.log(`🔐 ID Generation (Server): Input=${firebaseUid} -> Output=${generatedId}`);
    return generatedId;
}

// ============================================================================

// Função auxiliar para obter o UID do Firebase a partir do token de autorização
async function getFirebaseUser(request: NextRequest) {
    if (!adminAuth) {
        console.error("Firebase Admin Auth não inicializado.");
        return null;
    }
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
        const idToken = authorization.split('Bearer ')[1];
        try {
            const decodedToken = await adminAuth.verifyIdToken(idToken);
            return decodedToken;
        } catch (error) {
            console.error("Erro ao verificar o ID token:", error);
            return null;
        }
    }
    return null;
}

// ===================================
// Lidar com requisições POST para incrementar/decrementar abates
// ===================================
export async function POST(request: NextRequest) {
    if (!adminAuth) {
        return NextResponse.json({
            error: 'Serviço de autenticação indisponível.',
            details: initError ? initError.message : 'Erro desconhecido na inicialização.'
        }, { status: 503 });
    }
    try {
        const firebaseUser = await getFirebaseUser(request);
        if (!firebaseUser) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // GERA O ID CORRETO (Não cria perfil, apenas calcula o ID)
        const supabaseUserId = getSupabaseUserId(firebaseUser.uid);

        const { action, payload } = await request.json();
        const { speciesId, amount } = payload; // speciesId aqui deve corresponder ao animal_id no banco

        if (!speciesId) {
            return NextResponse.json({ error: 'speciesId é obrigatório' }, { status: 400 });
        }

        if (action === 'increment' || action === 'decrement') {
            const valueToIncrement = action === 'increment' ? (amount || 1) : -(amount || 1);

            // Nota: O Electron usa 'registerKill' para inserir na tabela kill_records.
            // Se você quiser apenas atualizar o contador total na tabela grind_sessions,
            // você precisa garantir que a sessão exista.

            // Vamos tentar atualizar a sessão ativa diretamente.
            // O ideal seria replicar a lógica de 'registerKill' se você quiser histórico detalhado.
            // Mas para um contador simples, vamos atualizar grind_sessions.

            // 1. Verifica se existe sessão ativa para esse animal
            const { data: session, error: sessionError } = await supabaseAdmin
                .from('grind_sessions')
                .select('id, total_kills')
                .eq('user_id', supabaseUserId)
                .eq('animal_id', speciesId) // Corrigido de species_id para animal_id
                .eq('is_active', true)
                .single();

            if (sessionError || !session) {
                return NextResponse.json({ error: 'Nenhuma sessão ativa encontrada para este animal. Inicie uma sessão no app Desktop primeiro.' }, { status: 404 });
            }

            // 2. Atualiza o contador
            const newTotal = (session.total_kills || 0) + valueToIncrement;

            const { data: updatedSession, error: updateError } = await supabaseAdmin
                .from('grind_sessions')
                .update({ total_kills: newTotal })
                .eq('id', session.id)
                .select()
                .single();

            if (updateError) {
                console.error('Erro ao atualizar grind_sessions:', updateError);
                throw updateError;
            }

            return NextResponse.json({ success: true, data: updatedSession });

        } else {
            return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Erro na API /api/grind-data (POST):', error);
        return NextResponse.json({ error: error.message || 'Ocorreu um erro interno no servidor.' }, { status: 500 });
    }
}


// ===================================
// Lidar com requisições GET para buscar dados de um grind
// ===================================
export async function GET(request: NextRequest) {
    if (!adminAuth) {
        return NextResponse.json({
            error: 'Serviço de autenticação indisponível.',
            details: initError ? initError.message : 'Erro desconhecido na inicialização.'
        }, { status: 503 });
    }
    try {
        const firebaseUser = await getFirebaseUser(request);
        if (!firebaseUser) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // GERA O ID CORRETO
        const supabaseUserId = getSupabaseUserId(firebaseUser.uid);

        const speciesId = request.nextUrl.searchParams.get('speciesId');
        if (!speciesId) {
            return NextResponse.json({ error: 'O parâmetro speciesId é obrigatório' }, { status: 400 });
        }

        // Busca na tabela grind_sessions
        const { data, error } = await supabaseAdmin
            .from('grind_sessions')
            .select('total_kills')
            .eq('user_id', supabaseUserId)
            .eq('animal_id', speciesId) // Corrigido: animal_id, não species_id
            .eq('is_active', true)      // Importante: pegar apenas a sessão ativa
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 significa "nenhuma linha encontrada"
            console.error('Erro ao buscar dados do grind no Supabase:', error);
            throw error;
        }

        const responseData = {
            totalKills: data?.total_kills || 0,
        };

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('Erro na API /api/grind-data (GET):', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
