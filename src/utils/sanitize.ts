/**
 * Utilitários de sanitização e validação de inputs
 * Proteção contra XSS, SQL Injection e outros ataques
 */

/**
 * Remove tags HTML e scripts de uma string
 */
export function sanitizeHtml(input: string): string {
    if (!input) return '';

    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove <script>
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove <iframe>
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '') // Remove <object>
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '') // Remove <embed>
        .replace(/<link\b[^<]*>/gi, '') // Remove <link>
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove <style>
        .replace(/<[^>]+>/g, '') // Remove todas as outras tags HTML
        .replace(/javascript:/gi, '') // Remove javascript:
        .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick, onload, etc)
        .trim();
}

/**
 * Sanitiza email
 */
export function sanitizeEmail(email: string): string {
    if (!email) return '';

    return email
        .toLowerCase()
        .trim()
        .replace(/[<>'"]/g, ''); // Remove caracteres perigosos
}

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

/**
 * Sanitiza senha (não remove caracteres, apenas valida)
 */
export function isValidPassword(password: string): boolean {
    // Mínimo 6 caracteres
    return password.length >= 6;
}

/**
 * Sanitiza texto genérico (nomes, descrições, etc)
 */
export function sanitizeText(text: string, maxLength: number = 255): string {
    if (!text) return '';

    return sanitizeHtml(text)
        .substring(0, maxLength)
        .trim();
}

/**
 * Sanitiza números (garante que é um número válido)
 */
export function sanitizeNumber(value: any): number {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : Math.max(0, num);
}

/**
 * Sanitiza booleanos
 */
export function sanitizeBoolean(value: any): boolean {
    return Boolean(value);
}

/**
 * Sanitiza ID (UUID ou string alfanumérica)
 */
export function sanitizeId(id: string): string {
    if (!id) return '';

    // Permite apenas letras, números, hífens e underscores
    return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
}

/**
 * Sanitiza URL
 */
export function sanitizeUrl(url: string): string {
    if (!url) return '';

    try {
        const parsed = new URL(url);
        // Permite apenas http e https
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.toString();
    } catch {
        return '';
    }
}

/**
 * Escapa caracteres especiais para prevenir XSS
 */
export function escapeHtml(text: string): string {
    if (!text) return '';

    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
    };

    return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Valida e sanitiza dados de sessão de grind
 */
export interface SanitizedGrindSession {
    animalId: string;
    animalName: string;
}

export function sanitizeGrindSessionData(data: any): SanitizedGrindSession {
    return {
        animalId: sanitizeId(data.animalId || ''),
        animalName: sanitizeText(data.animalName || '', 100)
    };
}

/**
 * Valida e sanitiza dados de kill record
 */
export interface SanitizedKillRecord {
    isDiamond: boolean;
    isGreatOne: boolean;
    furTypeId: string | null;
    furTypeName: string | null;
}

export function sanitizeKillRecordData(data: any): SanitizedKillRecord {
    return {
        isDiamond: sanitizeBoolean(data.isDiamond),
        isGreatOne: sanitizeBoolean(data.isGreatOne),
        furTypeId: data.furTypeId ? sanitizeId(data.furTypeId) : null,
        furTypeName: data.furTypeName ? sanitizeText(data.furTypeName, 100) : null
    };
}

/**
 * Valida e sanitiza credenciais de login
 */
export interface SanitizedCredentials {
    email: string;
    password: string;
    isValid: boolean;
    errors: string[];
}

export function sanitizeLoginCredentials(email: string, password: string): SanitizedCredentials {
    const errors: string[] = [];
    const sanitizedEmail = sanitizeEmail(email);

    if (!sanitizedEmail) {
        errors.push('Email é obrigatório');
    } else if (!isValidEmail(sanitizedEmail)) {
        errors.push('Email inválido');
    }

    if (!password) {
        errors.push('Senha é obrigatória');
    } else if (!isValidPassword(password)) {
        errors.push('Senha deve ter no mínimo 6 caracteres');
    }

    return {
        email: sanitizedEmail,
        password: password, // Não sanitizar senha, apenas validar
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Sanitiza objeto completo recursivamente
 */
export function deepSanitize(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return sanitizeText(obj);
    }

    if (typeof obj === 'number') {
        return sanitizeNumber(obj);
    }

    if (typeof obj === 'boolean') {
        return sanitizeBoolean(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitize(item));
    }

    if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = deepSanitize(obj[key]);
            }
        }
        return sanitized;
    }

    return obj;
}

/**
 * Rate limiting simples (previne spam)
 */
class RateLimiter {
    private attempts: Map<string, number[]> = new Map();

    /**
     * Verifica se a ação pode ser executada
     * @param key Identificador único (ex: email, userId)
     * @param maxAttempts Número máximo de tentativas
     * @param windowMs Janela de tempo em milissegundos
     */
    canProceed(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
        const now = Date.now();
        const attempts = this.attempts.get(key) || [];

        // Remove tentativas antigas
        const recentAttempts = attempts.filter(time => now - time < windowMs);

        if (recentAttempts.length >= maxAttempts) {
            return false;
        }

        // Adiciona nova tentativa
        recentAttempts.push(now);
        this.attempts.set(key, recentAttempts);

        return true;
    }

    /**
     * Reseta tentativas para uma chave
     */
    reset(key: string): void {
        this.attempts.delete(key);
    }
}

export const rateLimiter = new RateLimiter();

/**
 * Validação de CSP (Content Security Policy) headers
 * Para usar no Electron main process
 */
export const CSP_HEADERS = {
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // Necessário para React
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.supabase.co wss://*.supabase.co",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'"
    ].join('; ')
};
