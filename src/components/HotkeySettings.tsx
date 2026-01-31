
import { useState, useEffect } from 'react';
import { db } from '../db_local';

export const HotkeySettings = () => {
    const [hotkeys, setHotkeys] = useState<Record<string, string>>({
        increment: 'Alt+Shift+=',
        decrement: 'Alt+Shift+-',
        stats: 'Alt+Shift+S',
        tray: 'Alt+Shift+G',
        overlay: 'Alt+Shift+H'
    });
    const [tempHotkeys, setTempHotkeys] = useState<Record<string, string>>({});
    const [hotkeyToEdit, setHotkeyToEdit] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedHotkeys = await db.settings.toArray();
                const hotkeyMap: Record<string, string> = { ...hotkeys };
                savedHotkeys.forEach(s => {
                    if (s.key.startsWith('hotkey_')) {
                        hotkeyMap[s.key.replace('hotkey_', '')] = s.value;
                    }
                });
                setHotkeys(hotkeyMap);
                setTempHotkeys(hotkeyMap);
            } catch (err) {
                console.error('❌ Error loading hotkeys:', err);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    const applyHotkeys = async () => {
        try {
            for (const [action, accelerator] of Object.entries(tempHotkeys)) {
                await db.settings.put({ key: `hotkey_${action}`, value: accelerator });
            }
            (window as any).ipcRenderer.send('update-hotkeys', tempHotkeys);
            window.close();
        } catch (err) {
            console.error('❌ Error saving hotkeys:', err);
            alert('Erro ao salvar atalhos.');
        }
    };

    if (loading) {
        return (
            <div className="w-full h-screen bg-stone-950 flex items-center justify-center text-white">
                <i className="fa-solid fa-circle-notch fa-spin text-hunter-orange text-xl mr-2"></i>
                <span className="text-xs uppercase tracking-widest">Carregando...</span>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-stone-900 flex flex-col overflow-hidden border border-stone-700">
            {/* Header - More Compact */}
            <div className="h-8 px-3 border-b border-stone-800 flex justify-between items-center bg-stone-950/30 shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
                <h3 className="text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-keyboard text-hunter-orange"></i>
                    Atalhos Globais
                </h3>
                <button
                    onClick={() => window.close()}
                    className="w-5 h-5 flex items-center justify-center text-stone-500 hover:text-white hover:bg-white/5 rounded transition-colors"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <i className="fa-solid fa-xmark text-xs"></i>
                </button>
            </div>

            {/* Content - Compact Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                <div className="bg-stone-950/50 p-2 rounded border border-white/5">
                    <p className="text-stone-400 text-[9px] leading-tight">
                        <i className="fa-solid fa-circle-info text-blue-400 mr-1"></i>
                        Clique no campo para capturar a nova tecla.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    {[
                        { id: 'increment', label: 'Adicionar Abate', icon: 'fa-plus' },
                        { id: 'decrement', label: 'Remover Abate', icon: 'fa-minus' },
                        { id: 'stats', label: 'Estatísticas', icon: 'fa-chart-column' },
                        { id: 'tray', label: 'Compactar/Expandir', icon: 'fa-right-to-bracket' },
                        { id: 'overlay', label: 'HUD (Overlay)', icon: 'fa-layer-group' },
                    ].map((item) => (
                        <div key={item.id} className="bg-stone-800/20 p-2 rounded border border-stone-700/50 hover:border-stone-600 transition-colors group">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-stone-400 text-[9px] uppercase font-bold flex items-center gap-1.5">
                                    <i className={`fa-solid ${item.icon} text-hunter-orange/80 w-3`}></i>
                                    {item.label}
                                </label>
                                <button
                                    onClick={() => {
                                        setTempHotkeys(prev => ({ ...prev, [item.id]: '' }));
                                        setHotkeyToEdit(null);
                                    }}
                                    className="text-stone-600 hover:text-red-400 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                                    title="Limpar"
                                >
                                    <i className="fa-solid fa-eraser text-[9px]"></i>
                                </button>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    readOnly
                                    value={hotkeyToEdit === item.id ? '...' : (tempHotkeys[item.id] || 'Nenhum')}
                                    onClick={() => {
                                        if (hotkeyToEdit === item.id) return;
                                        setHotkeyToEdit(item.id);
                                    }}
                                    onKeyDown={(e) => {
                                        if (hotkeyToEdit !== item.id) return;
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // Ignore modifier keys alone
                                        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

                                        // Build modifiers in standard order: Ctrl, Alt, Shift, Meta
                                        let modifiers = [];
                                        if (e.ctrlKey) modifiers.push('Ctrl');
                                        if (e.altKey) modifiers.push('Alt');
                                        if (e.shiftKey) modifiers.push('Shift');
                                        if (e.metaKey) modifiers.push('Meta');

                                        let key = '';

                                        // Priority 1: Numpad keys (using e.code for physical key identification)
                                        if (e.code.startsWith('Numpad')) {
                                            if (e.code === 'NumpadAdd') key = 'numadd';
                                            else if (e.code === 'NumpadSubtract') key = 'numsub';
                                            else if (e.code === 'NumpadMultiply') key = 'nummult';
                                            else if (e.code === 'NumpadDivide') key = 'numdiv';
                                            else if (e.code === 'NumpadDecimal') key = 'numdec';
                                            else {
                                                // Numpad0-9
                                                const num = e.code.replace('Numpad', '');
                                                key = `num${num}`;
                                            }
                                        }
                                        // Priority 2: Special keys and standard mapping
                                        else {
                                            key = e.key;
                                            if (key === ' ') key = 'Space';
                                            else if (key === '+') key = 'Plus';
                                            else if (key === '-') key = 'Minus';
                                            else if (key === '=') key = 'Plus'; // Shift + = is Plus

                                            // Normalize key name (e.g., 'a' -> 'A')
                                            if (key.length === 1) {
                                                key = key.toUpperCase();
                                            } else {
                                                // Capitalize first letter of special keys (e.g., 'enter' -> 'Enter')
                                                key = key.charAt(0).toUpperCase() + key.slice(1);
                                            }
                                        }

                                        const accelerator = [...modifiers, key].join('+');
                                        setTempHotkeys(prev => ({ ...prev, [item.id]: accelerator }));
                                        setHotkeyToEdit(null);
                                    }}
                                    className={`w-full bg-stone-950 border rounded px-2 py-1.5 font-mono text-[10px] focus:outline-none transition-all cursor-pointer text-center ${hotkeyToEdit === item.id ? 'border-blue-500 text-blue-400 ring-1 ring-blue-500/20' : 'border-stone-800 text-hunter-orange hover:border-hunter-orange/40 hover:bg-stone-900'}`}
                                    placeholder="Clique..."
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => {
                        const defaults = {
                            increment: 'numadd',
                            decrement: 'numsub',
                            stats: 'Alt+Shift+S',
                            tray: 'Alt+Shift+G',
                            overlay: 'Alt+Shift+H'
                        };
                        setTempHotkeys(defaults);
                        setHotkeyToEdit(null);
                    }}
                    className="w-full py-2 border border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-600 text-[8px] font-bold uppercase transition-all rounded flex items-center justify-center gap-1.5"
                >
                    <i className="fa-solid fa-rotate-left"></i>
                    Resetar Padrões
                </button>
            </div>

            {/* Footer - Compact */}
            <div className="p-3 bg-stone-950/80 border-t border-stone-800 flex gap-2 shrink-0">
                <button
                    onClick={() => window.close()}
                    className="flex-1 py-2 border border-stone-700 text-stone-400 hover:text-white hover:bg-stone-800 text-[9px] font-bold uppercase transition-all rounded"
                >
                    Sair
                </button>
                <button
                    onClick={applyHotkeys}
                    className="flex-[1.5] py-2 bg-hunter-orange hover:bg-orange-600 text-white text-[9px] font-bold uppercase transition-all rounded shadow-lg shadow-orange-900/20 flex items-center justify-center gap-1.5"
                >
                    <i className="fa-solid fa-floppy-disk"></i>
                    Salvar
                </button>
            </div>
        </div>
    );
};
