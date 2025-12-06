// Font size control hook for Dashboard
import { useEffect } from 'react';

export function useFontSizeControl(_fontSize: number, setFontSize: (size: number) => void) {
    // Load font size from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('fontSize');
        if (saved) {
            const size = parseFloat(saved);
            setFontSize(size);
            applyFontSize(size);
        }
    }, [setFontSize]);

    // Apply font size to document
    const applyFontSize = (size: number) => {
        // Apply font-size scaling to text content, not titles
        // Target specific text elements (stats, labels, descriptions)
        const baseSize = 16; // pixels
        const scaledSize = baseSize * size;

        // Set CSS variable for text scaling
        document.documentElement.style.setProperty('--text-scale', `${scaledSize}px`);

        // Apply to specific elements that should scale
        const style = document.createElement('style');
        style.id = 'font-scale-override';

        // Remove old style if exists
        const oldStyle = document.getElementById('font-scale-override');
        if (oldStyle) oldStyle.remove();

        style.textContent = `
            /* Scale text content but not titles/headers */
            .text-xs:not(h1 *, h2 *, h3 *, h4 *, h5 *, h6 *) { font-size: calc(0.75rem * ${size}) !important; }
            .text-sm:not(h1 *, h2 *, h3 *, h4 *, h5 *, h6 *) { font-size: calc(0.875rem * ${size}) !important; }
            .text-base:not(h1 *, h2 *, h3 *, h4 *, h5 *, h6 *) { font-size: calc(1rem * ${size}) !important; }
            .text-lg:not(h1 *, h2 *, h3 *, h4 *, h5 *, h6 *) { font-size: calc(1.125rem * ${size}) !important; }
            /* Scale specific text sizes in stats */
            .text-\\[10px\\]:not(h1 *, h2 *, h3 *, h4 *, h5 *, h6 *) { font-size: calc(10px * ${size}) !important; }
            .text-\\[11px\\]:not(h1 *, h2 *, h3 *, h4 *, h5 *, h6 *) { font-size: calc(11px * ${size}) !important; }
            .text-\\[9px\\]:not(h1 *, h2 *, h3 *, h4 *, h5 *, h6 *) { font-size: calc(9px * ${size}) !important; }
            .text-\\[8px\\]:not(h1 *, h2 *, h3 *, h4 *, h5 *, h6 *) { font-size: calc(8px * ${size}) !important; }
        `;

        document.head.appendChild(style);
    };

    // Update font size
    const updateFontSize = (newSize: number) => {
        setFontSize(newSize);
        localStorage.setItem('fontSize', newSize.toString());
        applyFontSize(newSize);
    };

    return { updateFontSize };
}

// Hamburger Menu Component
interface HamburgerMenuProps {
    show: boolean;
    onClose: () => void;
    fontSize: number;
    onFontSizeChange: (size: number) => void;
    onResetStats: () => void;
    onShowAbout: () => void;
    onShowGuide: () => void;
}

export function HamburgerMenu({ show, onClose, fontSize, onFontSizeChange, onResetStats, onShowAbout, onShowGuide }: HamburgerMenuProps) {
    if (!show) return null;

    return (
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose}></div>

            {/* Menu Panel */}
            <div className="fixed top-0 left-0 w-64 h-full bg-stone-900 border-r border-stone-800 z-50 p-4 overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-hunter-orange uppercase text-sm font-bold">Configurações</h3>
                    <button onClick={onClose} className="text-stone-400 hover:text-white">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>

                {/* Font Size Control */}
                <div className="mb-6">
                    <label className="text-stone-400 text-xs uppercase block mb-2">
                        Tamanho da Fonte: {fontSize.toFixed(1)}x
                    </label>
                    <input
                        type="range"
                        min="0.8"
                        max="1.5"
                        step="0.1"
                        value={fontSize}
                        onChange={(e) => onFontSizeChange(parseFloat(e.target.value))}
                        className="w-full accent-hunter-orange"
                    />
                    <div className="flex justify-between text-[8px] text-stone-500 mt-1">
                        <span>Pequeno</span>
                        <span>Normal</span>
                        <span>Grande</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                    <button
                        onClick={onShowGuide}
                        className="w-full text-left px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-sm  text-sm flex items-center gap-2"
                    >
                        <i className="fa-solid fa-book text-hunter-orange"></i>
                        Guia de Uso
                    </button>

                    <button
                        onClick={onResetStats}
                        className="w-full text-left px-3 py-2 bg-stone-800 hover:bg-red-900/30 text-stone-300 hover:text-red-400 rounded-sm  text-sm flex items-center gap-2"
                    >
                        <i className="fa-solid fa-trash"></i>
                        Resetar Estatísticas
                    </button>

                    <button
                        onClick={onShowAbout}
                        className="w-full text-left px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-sm  text-sm flex items-center gap-2"
                    >
                        <i className="fa-solid fa-circle-info"></i>
                        Sobre
                    </button>
                </div>
            </div>
        </>
    );
}

// About Modal Component
interface AboutModalProps {
    show: boolean;
    onClose: () => void;
}

export function AboutModal({ show, onClose }: AboutModalProps) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/80" onClick={onClose}></div>

            {/* Modal */}
            <div className="relative bg-stone-900 border border-hunter-orange/30 rounded p-6 max-w-md w-full mx-4">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-stone-400 hover:text-white"
                >
                    <i className="fa-solid fa-times"></i>
                </button>

                <div className="text-center">
                    <h2 className="text-hunter-orange text-xl font-bold mb-4">COTW Pin Planner</h2>
                    <p className="text-stone-400 text-sm mb-4">
                        Aplicativo não oficial para auxiliar o grind no jogo{' '}
                        <a
                            href="https://callofthewild.thehunter.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-hunter-orange hover:text-yellow-400 transition-colors font-bold"
                        >
                            theHunter: Call of the Wild
                        </a>
                    </p>
                    <div className="border-t border-stone-700 pt-4 mt-4">
                        <p className="text-stone-500 text-xs">Versão 1.0.0</p>
                        <p className="text-stone-500 text-xs mt-2">
                            Desenvolvido por{' '}
                            <a
                                href="https://www.instagram.com/weudesmarquez/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-hunter-orange hover:text-yellow-400 transition-colors font-bold"
                            >
                                Weudes S. M.
                            </a>
                            {' '}como app auxiliar do aplicativo Pin Planner
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Confirmation Modal Component
interface ConfirmationModalProps {
    show: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'red' | 'yellow' | 'blue';
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmationModal({
    show,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmColor = 'red',
    onConfirm,
    onCancel
}: ConfirmationModalProps) {
    if (!show) return null;

    const colorClasses = {
        red: 'bg-red-600 hover:bg-red-700 text-white',
        yellow: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        blue: 'bg-blue-600 hover:bg-blue-700 text-white'
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-[60]">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/80" onClick={onCancel}></div>

            {/* Modal */}
            <div className="relative bg-stone-900 border border-stone-700 rounded p-4 max-w-sm w-full mx-4 shadow-2xl">
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-stone-400 text-sm mb-6">{message}</p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded text-stone-400 hover:text-white hover:bg-stone-800 transition-colors text-sm"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-3 py-1.5 rounded font-bold transition-colors text-sm ${colorClasses[confirmColor]}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
