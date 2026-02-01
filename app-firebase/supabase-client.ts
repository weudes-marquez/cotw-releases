// src/lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

// Variáveis públicas (acessíveis no navegador) devem ter o prefixo NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Variável secreta (apenas servidor) NÃO deve ter NEXT_PUBLIC_
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verificação de segurança para evitar crash no cliente
if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ Supabase URL or Key missing! Check your .env.local file. Variables must start with NEXT_PUBLIC_');
}

// Cliente para uso no lado do cliente (navegador)
// Usamos um fallback vazio para evitar que o app trave completamente se as variáveis faltarem
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : createClient('https://placeholder.supabase.co', 'placeholder');

// Cliente com privilégios de administrador para uso no lado do servidor (API Routes)
export const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey)
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : (supabaseUrl && supabaseKey)
        ? createClient(supabaseUrl, supabaseKey) // Fallback para chave anon se service role faltar
        : createClient('https://placeholder.supabase.co', 'placeholder');
