import { useState, useEffect, useRef } from 'react';

interface VoiceCommandHandlers {
    onIncrement: () => void;
    onDecrement: () => void;
    onDiamond: () => void;
    onDiamondRare: () => void;
    onGreatOne: () => void;
}

export function useVoiceCommands(enabled: boolean, handlers: VoiceCommandHandlers) {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Check if Web Speech API is available
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('🎤 Web Speech API não disponível neste navegador');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'pt-BR';

        recognition.onstart = () => {
            setIsListening(true);

        };

        recognition.onend = () => {
            setIsListening(false);

            // Auto-restart se ainda estiver habilitado
            if (enabled) {
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (e) {
                        // Ignora erro se já estiver rodando
                    }
                }, 100);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('❌ Erro no reconhecimento de voz:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                setIsListening(false);
            }
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();


            // Comandos de incremento
            if (transcript.includes('mais') || transcript.includes('adicionar') || transcript.includes('mais um')) {

                handlers.onIncrement();
            }
            // Comandos de decremento
            else if (transcript.includes('menos') || transcript.includes('remover') || transcript.includes('menos um')) {

                handlers.onDecrement();
            }
            // Diamante raro
            else if (transcript.includes('diamante raro') || (transcript.includes('diamante') && transcript.includes('raro'))) {

                handlers.onDiamondRare();
            }
            // Diamante normal
            else if (transcript.includes('diamante')) {

                handlers.onDiamond();
            }
            // Great One
            else if (transcript.includes('great one') || transcript.includes('great1') || transcript.includes('grande')) {

                handlers.onGreatOne();
            }
        };

        recognitionRef.current = recognition;

        // Start/stop based on enabled state
        if (enabled) {
            try {
                recognition.start();
            } catch (error) {
                console.error('Erro ao iniciar reconhecimento:', error);
            }
        }

        return () => {
            if (recognition) {
                recognition.stop();
            }
        };
    }, [enabled, handlers]);

    return { isListening };
}
