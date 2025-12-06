/**
 * Normaliza string para slug (lowercase, sem acentos, com hífens)
 */
export function normalizeToSlug(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .trim();
}
