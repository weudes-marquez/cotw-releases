/**
 * Security Audit Logging
 * Registra eventos de segurança importantes
 */

export interface SecurityEvent {
    event_type: 'login_success' | 'login_failed' | 'session_created' | 'session_deleted' | 'data_deleted' | 'suspicious_activity';
    user_id?: string;
    details: string;
    ip_address?: string;
    user_agent?: string;
    timestamp: string;
}

class SecurityLogger {
    private events: SecurityEvent[] = [];
    private maxEvents = 100; // Manter apenas os últimos 100 eventos na memória

    /**
     * Registra um evento de segurança
     */
    log(event: Omit<SecurityEvent, 'timestamp'>): void {
        const securityEvent: SecurityEvent = {
            ...event,
            timestamp: new Date().toISOString(),
            user_agent: window.navigator.userAgent
        };

        // Adiciona ao array local
        this.events.push(securityEvent);

        // Limita o tamanho do array
        if (this.events.length > this.maxEvents) {
            this.events.shift();
        }

        // Log no console em desenvolvimento
        if (process.env.NODE_ENV === 'development') {
            // console.log('🔒 Security Event:', securityEvent);
        }

        // Em produção, você pode enviar para um serviço de logging
        // this.sendToLoggingService(securityEvent);
    }

    /**
     * Registra falha de login
     */
    logLoginFailure(email: string, error: string): void {
        this.log({
            event_type: 'login_failed',
            details: `Login failed for ${email}: ${error}`
        });
    }

    /**
     * Registra sucesso de login
     */
    logLoginSuccess(userId: string, email: string): void {
        this.log({
            event_type: 'login_success',
            user_id: userId,
            details: `User ${email} logged in successfully`
        });
    }

    /**
     * Registra criação de sessão
     */
    logSessionCreated(userId: string, animalName: string): void {
        this.log({
            event_type: 'session_created',
            user_id: userId,
            details: `Grind session created for ${animalName}`
        });
    }

    /**
     * Registra deleção de dados
     */
    logDataDeletion(userId: string, dataType: string, details: string): void {
        this.log({
            event_type: 'data_deleted',
            user_id: userId,
            details: `${dataType} deleted: ${details}`
        });
    }

    /**
     * Registra atividade suspeita
     */
    logSuspiciousActivity(userId: string | undefined, details: string): void {
        this.log({
            event_type: 'suspicious_activity',
            user_id: userId,
            details: details
        });
    }

    /**
     * Obtém eventos recentes (para debug)
     */
    getRecentEvents(count: number = 10): SecurityEvent[] {
        return this.events.slice(-count);
    }

    /**
     * Limpa eventos (para testes)
     */
    clear(): void {
        this.events = [];
    }
}

// Singleton
export const securityLogger = new SecurityLogger();
