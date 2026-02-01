import React, { useState, useEffect } from 'react';
import { db } from '../db_local';
import { getSupabaseUserId } from '../supabase_client';
import { auth } from '../firebase';

export const Overlay: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditable, setIsEditable] = useState(false);
    const [scale, setScale] = useState(1.0);
    const [position, setPosition] = useState({ x: 50, y: 0 }); // Padrão: Topo Absoluto
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Função para carregar dados do banco local
    const loadData = async () => {
        if (!auth.currentUser) return;
        const userId = getSupabaseUserId(auth.currentUser.uid);

        try {
            // 1. Pega a sessão ativa para saber qual animal mostrar
            const activeSession = await db.grind_sessions
                .where('user_id').equals(userId)
                .and(s => s.is_active === true)
                .first();

            if (!activeSession) {
                setStats(null);
                setLoading(false);
                return;
            }

            // 2. Pega TODAS as sessões do usuário (Lifetime)
            const allUserSessions = await db.grind_sessions
                .where('user_id').equals(userId)
                .toArray();

            // Totais GLOBAIS (Lifetime de TODOS os animais)
            // Soma total_kills de TODAS as sessões do usuário
            const globalLifetimeKills = allUserSessions.reduce((sum, s) => sum + (s.total_kills || 0), 0);

            // Totais GLOBAIS (Lifetime de TODOS os animais) para troféus
            // AGORA CALCULADOS DIRETAMENTE DE KILL_RECORDS PARA TEMPO REAL

            const allKills = await db.kill_records
                .where('user_id').equals(userId)
                .toArray();

            let globalDiamonds = 0;
            let globalGreatOnes = 0;
            let globalTrolls = 0;
            let globalRares = 0;
            let globalSuperRares = 0;

            allKills.forEach(k => {
                const count = k.kill_number || 1;

                if (k.is_diamond) globalDiamonds += count;
                if (k.is_great_one) globalGreatOnes += count;
                if (k.is_troll) globalTrolls += count;

                if (k.fur_type_id && k.fur_type_id !== 'undefined') {
                    globalRares += count;
                }

                if (k.is_diamond && k.fur_type_id && k.fur_type_id !== 'undefined') {
                    globalSuperRares += count;
                }
            });

            setStats({
                animalName: activeSession.animal_name,
                totalKills: globalLifetimeKills, // Total Global de Kills
                diamonds: globalDiamonds,
                greatOnes: globalGreatOnes,
                trolls: globalTrolls,
                rares: globalRares,
                superRares: globalSuperRares
            });

        } catch (error) {
            console.error('Error loading overlay data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Carregar configurações iniciais
    useEffect(() => {
        const loadSettings = async () => {
            const savedScale = await db.settings.get('hud_scale');
            const savedPos = await db.settings.get('hud_position');

            if (savedScale) setScale(parseFloat(savedScale.value));
            if (savedPos) setPosition(JSON.parse(savedPos.value));
        };

        loadSettings();
        loadData();
        const interval = setInterval(loadData, 2000);

        // Listen for IPC updates
        const handleEdit = (_event: any, enabled: boolean) => {
            console.log('🔄 HUD Edit Mode:', enabled);
            setIsEditable(enabled);
            // Se habilitado (enabled=true), ignore deve ser false (captura o mouse)
            // Se desabilitado (enabled=false), ignore deve ser true (passa o mouse)
            if (enabled) {
                // MODO EDIÇÃO: Não ignore o mouse, mas permita clicar através da transparência
                (window as any).ipcRenderer.send('set-ignore-mouse-events', false);
            } else {
                // MODO JOGO: Ignore totalmente e passe cliques para o jogo
                (window as any).ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
            }
        };

        const handleScale = (_event: any, s: number) => {
            setScale(s);
        };

        const handleSettingsUpdate = (_event: any, settings: any) => {
            if (settings.hudPosition) {
                setPosition(settings.hudPosition);
            }
        };

        (window as any).ipcRenderer.on('toggle-hud-edit', handleEdit);
        (window as any).ipcRenderer.on('update-hud-scale', handleScale);
        (window as any).ipcRenderer.on('sync-settings', handleSettingsUpdate);

        // Inicialmente, deixa o mouse passar direto (click-through)
        (window as any).ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });

        return () => {
            clearInterval(interval);
            (window as any).ipcRenderer.off('toggle-hud-edit', handleEdit);
            (window as any).ipcRenderer.off('update-hud-scale', handleScale);
            (window as any).ipcRenderer.off('sync-settings', handleSettingsUpdate);
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isEditable) return;
        setIsDragging(true);

        // Posição visual atual em pixels
        const currentX_px = (window.innerWidth * position.x) / 100;
        const currentY_px = position.y;

        setDragStart({
            x: e.clientX - currentX_px,
            y: e.clientY - currentY_px
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !isEditable) return;

        // Calcula a nova posição baseada no deslocamento do mouse
        const newX_px = e.clientX - dragStart.x;
        const newY_px = e.clientY - dragStart.y;

        setPosition({
            x: Math.max(0, Math.min(100, (newX_px / window.innerWidth) * 100)),
            y: Math.max(0, Math.min(window.innerHeight - 50, newY_px))
        });
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            db.settings.put({ key: 'hud_position', value: JSON.stringify(position) });
        }
    };

    if (loading) return null;
    if (!stats) return null;

    return (
        <div
            className="fixed top-0 left-0 w-full h-full select-none overflow-hidden bg-transparent flex justify-center pointer-events-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
                pointerEvents: 'none', // CAMADA PAI NUNCA PEGA MOUSE
                width: '100vw',
                height: '100vh',
                position: 'fixed',
                zIndex: 9999
            }}
        >
            {/* HUD Container */}
            <div
                className={`absolute transition-shadow duration-200 ${isEditable ? 'bg-black/30 outline outline-1 outline-dashed outline-hunter-orange cursor-move shadow-2xl rounded-sm' : 'pointer-events-none'}`}
                onMouseDown={handleMouseDown}
                style={{
                    left: `${position.x}%`,
                    top: `${position.y}px`, // Pixels para precisão no topo
                    transform: `translateX(-50%) scale(${scale})`,
                    transformOrigin: 'top center',
                    pointerEvents: isEditable ? 'auto' : 'none',
                    padding: '0'
                }}
            >
                {isEditable && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-hunter-orange text-black px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex items-center gap-1 whitespace-nowrap shadow-lg z-50">
                        <i className="fa-solid fa-up-down-left-right"></i>
                        Arraste para Mover
                    </div>
                )}

                <div
                    className="flex items-center gap-12 px-4 py-2 bg-black/0 transition-colors rounded-xl pointer-events-auto"
                >
                    {/* Total Kills (Main Counter) - HUGE */}
                    <div className="flex flex-col items-center mr-8 group">
                        <span className="text-8xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,1)] font-mono leading-none stroke-black">
                            {stats.totalKills}
                        </span>
                        <span className="text-xl text-stone-200 uppercase tracking-widest font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,1)] mt-2">KILLS</span>
                    </div>

                    {/* Stats Icons Row - HUGE */}
                    <div className="flex items-center gap-10 mt-2">
                        {/* Diamond */}
                        <div className="flex flex-col items-center group">
                            <img src="/cotw-diamond.webp" alt="Diamond" className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110" />
                            <span className="text-4xl text-cyan-400 font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,1)] mt-[-5px]">{stats.diamonds}</span>
                        </div>

                        {/* Great One */}
                        <div className="flex flex-col items-center group">
                            <img
                                src="/cotw_go_icon-01.webp"
                                onError={(e) => e.currentTarget.src = '/cotw_go_icon.webp'}
                                alt="GO"
                                className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110"
                            />
                            <span className="text-4xl text-yellow-400 font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,1)] mt-[-5px]">{stats.greatOnes}</span>
                        </div>

                        {/* Super Rare */}
                        <div className="flex flex-col items-center group">
                            <img src="/diamond-rare.webp" alt="Super Rare" className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110" />
                            <span className="text-4xl text-purple-400 font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,1)] mt-[-5px]">{stats.superRares}</span>
                        </div>

                        {/* Rare */}
                        <div className="flex flex-col items-center group">
                            <img src="/cotw_rare_icon.webp" alt="Rare" className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110" />
                            <span className="text-4xl text-pink-400 font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,1)] mt-[-5px]">{stats.rares}</span>
                        </div>

                        {/* Troll */}
                        <div className="flex flex-col items-center group">
                            <img src="/cotw_troll_icon.webp" alt="Troll" className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110" />
                            <span className="text-4xl text-red-500 font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,1)] mt-[-5px]">{stats.trolls}</span>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .drag-region {
                    -webkit-app-region: drag;
                }
                /* Force absolute transparency and reset margins */
                :global(body), :global(html), :global(#root) {
                    background: transparent !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden !important;
                }
                /* Text Stroke Effect for better visibility */
                .stroke-black {
                    -webkit-text-stroke: 2px black;
                }
            `}</style>
        </div>
    );
};
