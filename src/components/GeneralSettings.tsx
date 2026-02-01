
import { useState, useEffect } from 'react';
import { db } from '../db_local';

export const GeneralSettings = () => {
    const [hotkeys, setHotkeys] = useState<Record<string, string>>({
        increment: 'numadd',
        decrement: 'numsub',
        stats: 'Alt+Shift+S',
        tray: 'Alt+Shift+G',
        overlay: 'Alt+Shift+H',
        detailedStats: 'Alt+Shift+]',
        needZones: 'Alt+Shift+['
    });
    const [tempHotkeys, setTempHotkeys] = useState<Record<string, string>>({});
    const [hotkeyToEdit, setHotkeyToEdit] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // HUD & UI Settings
    const [hudScale, setHudScale] = useState(1.0);
    const [hudEditable, setHudEditable] = useState(false);
    const [fontSize, setFontSize] = useState(1.0);
    const [showDetailedMode, setShowDetailedMode] = useState(false);

    const [activeTab, setActiveTab] = useState<'hotkeys' | 'hud' | 'general'>('hotkeys');

    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Load Hotkeys
                const savedHotkeys = await db.settings.toArray();
                const hotkeyMap: Record<string, string> = { ...hotkeys };
                savedHotkeys.forEach(s => {
                    if (s.key.startsWith('hotkey_')) {
                        hotkeyMap[s.key.replace('hotkey_', '')] = s.value;
                    }
                });
                setHotkeys(hotkeyMap);
                setTempHotkeys(hotkeyMap);

                // Load HUD Scale
                const savedHudScale = await db.settings.get('hud_scale');
                if (savedHudScale) setHudScale(parseFloat(savedHudScale.value));

                // Load Font Size
                const savedFontSize = localStorage.getItem('fontSize');
                if (savedFontSize) setFontSize(parseFloat(savedFontSize));

                // Load Detailed Mode
                const savedDetailedMode = localStorage.getItem('detailedMode');
                if (savedDetailedMode) setShowDetailedMode(savedDetailedMode === 'true');

            } catch (err) {
                console.error('❌ Error loading settings:', err);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

    const saveSettings = async () => {
        try {
            // Save Hotkeys
            for (const [action, accelerator] of Object.entries(tempHotkeys)) {
                await db.settings.put({ key: `hotkey_${action}`, value: accelerator });
            }
            (window as any).ipcRenderer.send('update-hotkeys', tempHotkeys);

            // Save HUD Scale
            await db.settings.put({ key: 'hud_scale', value: hudScale.toString() });
            (window as any).ipcRenderer.send('update-hud-scale', hudScale);

            // Save Other Settings (LocalStorage)
            localStorage.setItem('fontSize', fontSize.toString());
            localStorage.setItem('detailedMode', showDetailedMode.toString());

            // Notify Dashboard
            (window as any).ipcRenderer.send('settings-updated', {
                fontSize,
                showDetailedMode
            });

            window.close();
        } catch (err) {
            console.error('❌ Error saving settings:', err);
            alert('Erro ao salvar configurações.');
        }
    };

    const handleHudEditToggle = (enabled: boolean) => {
        setHudEditable(enabled);
        (window as any).ipcRenderer.send('toggle-hud-edit', enabled);
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
            {/* Header */}
            <div className="h-10 px-4 border-b border-stone-800 flex justify-between items-center bg-stone-950/50 shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
                <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-cog text-hunter-orange"></i>
                    Configurações do Sistema
                </h3>
                <button
                    onClick={() => window.close()}
                    className="w-6 h-6 flex items-center justify-center text-stone-500 hover:text-white hover:bg-white/5 rounded transition-colors"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-800 bg-stone-950/20 shrink-0">
                <button
                    onClick={() => setActiveTab('hotkeys')}
                    className={`flex-1 py-2 text-[10px] uppercase font-bold transition-all ${activeTab === 'hotkeys' ? 'text-hunter-orange border-b-2 border-hunter-orange bg-stone-800/30' : 'text-stone-500 hover:text-stone-300'}`}
                >
                    Atalhos
                </button>
                <button
                    onClick={() => setActiveTab('hud')}
                    className={`flex-1 py-2 text-[10px] uppercase font-bold transition-all ${activeTab === 'hud' ? 'text-hunter-orange border-b-2 border-hunter-orange bg-stone-800/30' : 'text-stone-500 hover:text-stone-300'}`}
                >
                    HUD (Overlay)
                </button>
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 py-2 text-[10px] uppercase font-bold transition-all ${activeTab === 'general' ? 'text-hunter-orange border-b-2 border-hunter-orange bg-stone-800/30' : 'text-stone-500 hover:text-stone-300'}`}
                >
                    Geral
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'hotkeys' && (
                    <div className="space-y-3">
                        <div className="bg-blue-900/10 p-2 rounded border border-blue-500/20 mb-4">
                            <p className="text-blue-300 text-[10px] leading-tight flex items-start gap-2">
                                <i className="fa-solid fa-info-circle mt-0.5"></i>
                                Clique no campo e aperte as teclas que deseja configurar para o atalho.
                            </p>
                        </div>

                        <div className="space-y-2">
                            {[
                                { id: 'increment', label: 'Adicionar Abate', icon: 'fa-plus' },
                                { id: 'decrement', label: 'Remover Abate', icon: 'fa-minus' },
                                { id: 'stats', label: 'Histórico Completo', icon: 'fa-chart-column' },
                                { id: 'tray', label: 'Modo Compacto (Bandeja)', icon: 'fa-right-to-bracket' },
                                { id: 'overlay', label: 'HUD do Jogo', icon: 'fa-layer-group' },
                                { id: 'detailedStats', label: 'Estatísticas de Safra', icon: 'fa-chart-pie' },
                                { id: 'needZones', label: 'Horários de Necessidade', icon: 'fa-clock' },
                            ].map((item) => (
                                <div key={item.id} className="flex flex-col gap-1 p-2 bg-stone-800/20 border border-stone-700/50 rounded group hover:border-stone-600">
                                    <label className="text-stone-500 text-[9px] uppercase font-bold flex items-center gap-2">
                                        <i className={`fa-solid ${item.icon} text-hunter-orange/70 w-3`}></i>
                                        {item.label}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            readOnly
                                            value={hotkeyToEdit === item.id ? '...' : (tempHotkeys[item.id] || 'Nenhum')}
                                            onClick={() => setHotkeyToEdit(item.id)}
                                            onKeyDown={(e) => {
                                                if (hotkeyToEdit !== item.id) return;
                                                e.preventDefault();
                                                if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

                                                let modifiers = [];
                                                if (e.ctrlKey) modifiers.push('Ctrl');
                                                if (e.altKey) modifiers.push('Alt');
                                                if (e.shiftKey) modifiers.push('Shift');
                                                if (e.metaKey) modifiers.push('Meta');

                                                let key = e.key;
                                                if (e.code.startsWith('Numpad')) {
                                                    const map: any = { 'NumpadAdd': 'numadd', 'NumpadSubtract': 'numsub', 'NumpadMultiply': 'nummult', 'NumpadDivide': 'numdiv', 'NumpadDecimal': 'numdec' };
                                                    key = map[e.code] || `num${e.code.replace('Numpad', '')}`;
                                                } else {
                                                    if (key === ' ') key = 'Space';
                                                    else if (key === '+') key = 'Plus';
                                                    else if (key === '-') key = 'Minus';
                                                    else if (key === '=') key = 'Plus';
                                                    key = key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
                                                }

                                                const accelerator = [...modifiers, key].join('+');
                                                setTempHotkeys(prev => ({ ...prev, [item.id]: accelerator }));
                                                setHotkeyToEdit(null);
                                            }}
                                            className={`w-full bg-stone-950 border px-3 py-1.5 rounded font-mono text-xs text-center transition-all cursor-pointer ${hotkeyToEdit === item.id ? 'border-hunter-orange text-hunter-orange ring-1 ring-hunter-orange/20' : 'border-stone-800 text-stone-300 hover:border-stone-700'}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'hud' && (
                    <div className="space-y-6">
                        <div className="bg-stone-800/30 p-4 rounded-lg border border-stone-700">
                            <h4 className="text-white text-xs font-bold uppercase mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-wand-magic-sparkles text-hunter-orange"></i>
                                Personalização da HUD
                            </h4>

                            <div className="space-y-6">
                                {/* Drag Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-stone-300 text-sm font-medium">Modo de Edição</span>
                                        <span className="text-stone-500 text-[10px]">Permite arrastar a HUD pela tela.</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={hudEditable}
                                            onChange={(e) => handleHudEditToggle(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hunter-orange"></div>
                                    </label>
                                </div>

                                {/* Scale Slider */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-stone-300 text-sm font-medium">Escala da HUD</span>
                                        <span className="text-hunter-orange font-bold text-sm">{hudScale.toFixed(1)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.5"
                                        step="0.1"
                                        value={hudScale}
                                        onChange={(e) => {
                                            const newScale = parseFloat(e.target.value);
                                            setHudScale(newScale);
                                            (window as any).ipcRenderer.send('update-hud-scale', newScale);
                                        }}
                                        className="w-full accent-hunter-orange h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-stone-500 mt-2">
                                        <span>Pequena</span>
                                        <span>Normal</span>
                                        <span>Enorme</span>
                                    </div>
                                </div>

                                {/* Reset Position Button */}
                                <button
                                    onClick={() => {
                                        (window as any).ipcRenderer.send('settings-updated', { hudPosition: { x: 50, y: 0 } });
                                        localStorage.setItem('hud_position', JSON.stringify({ x: 50, y: 0 }));
                                        alert('HUD resetada para o topo central!');
                                    }}
                                    className="w-full flex items-center justify-center gap-2 p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-bold uppercase rounded border border-stone-700 transition-colors"
                                >
                                    <i className="fa-solid fa-arrows-to-circle text-hunter-orange"></i>
                                    Resetar Posição (Topo Central)
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-orange-900/10 border border-orange-500/20 rounded-lg">
                            <p className="text-orange-300 text-[10px] leading-relaxed">
                                <strong>Dica:</strong> Se você perder a HUD de vista, clique no botão "Restaurar Posição das Janelas" na aba Geral.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div className="bg-stone-800/30 p-4 rounded-lg border border-stone-700">
                            <h4 className="text-white text-xs font-bold uppercase mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-sliders text-hunter-orange"></i>
                                Opções de Interface
                            </h4>

                            <div className="space-y-6">
                                {/* Font Size */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-stone-300 text-sm font-medium">Tamanho da Fonte Global</span>
                                        <span className="text-hunter-orange font-bold text-sm">{fontSize.toFixed(1)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.8"
                                        max="1.5"
                                        step="0.1"
                                        value={fontSize}
                                        onChange={(e) => {
                                            const newSize = parseFloat(e.target.value);
                                            setFontSize(newSize);
                                            (window as any).ipcRenderer.send('settings-updated', { fontSize: newSize });
                                        }}
                                        className="w-full accent-hunter-orange h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                {/* Detailed Mode */}
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-stone-300 text-sm font-medium">Modo Detalhado de Abate</span>
                                        <span className="text-stone-500 text-[10px]">Formulário extra para peso e score.</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={showDetailedMode}
                                            onChange={(e) => {
                                                const enabled = e.target.checked;
                                                setShowDetailedMode(enabled);
                                                (window as any).ipcRenderer.send('settings-updated', { showDetailedMode: enabled });
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hunter-orange"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Dangerous Actions */}
                        <div className="space-y-2">
                            <h4 className="text-stone-500 text-[9px] uppercase font-bold tracking-widest px-1">Ações de Emergência</h4>
                            <button
                                onClick={() => {
                                    if (confirm('Tem certeza que deseja resetar TODAS as estatísticas? Esta ação não pode ser desfeita.')) {
                                        (window as any).ipcRenderer.send('reset-all-stats');
                                    }
                                }}
                                className="w-full flex items-center justify-between p-3 bg-red-900/10 border border-red-500/20 rounded hover:bg-red-900/20 transition-all group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-red-400 text-sm font-bold">Zerar Tudo</span>
                                    <span className="text-stone-400 text-[10px]">Excluir histórico e sessões.</span>
                                </div>
                                <i className="fa-solid fa-trash text-red-500 opacity-60 group-hover:opacity-100"></i>
                            </button>

                            <button
                                onClick={() => (window as any).ipcRenderer.send('reset-windows')}
                                className="w-full flex items-center justify-between p-3 bg-blue-900/10 border border-blue-500/20 rounded hover:bg-blue-900/20 transition-all group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-blue-400 text-sm font-bold">Recuperar Telas</span>
                                    <span className="text-stone-400 text-[10px]">Centraliza todas as janelas.</span>
                                </div>
                                <i className="fa-solid fa-arrows-to-dot text-blue-500 opacity-60 group-hover:opacity-100"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-stone-950 border-t border-stone-800 flex gap-3 shrink-0">
                <button
                    onClick={() => window.close()}
                    className="flex-1 py-3 text-xs font-bold uppercase text-stone-500 hover:text-white transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={saveSettings}
                    className="flex-[2] py-3 bg-hunter-orange hover:bg-orange-600 text-white text-xs font-bold uppercase rounded-lg shadow-xl shadow-orange-950/30 flex items-center justify-center gap-2"
                >
                    <i className="fa-solid fa-check"></i>
                    Salvar Alterações
                </button>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d95d1e; }
            `}</style>
        </div>
    );
};
