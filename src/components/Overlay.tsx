import React, { useState, useEffect } from 'react';
import { db } from '../db_local';
import { getSupabaseUserId } from '../supabase_client';
import { auth } from '../firebase';

export const Overlay: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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

    // Auto-refresh a cada 2 segundos
    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 2000);

        // Inicialmente, deixa o mouse passar direto (click-through)
        (window as any).ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });

        return () => clearInterval(interval);
    }, []);

    if (loading) return null;
    if (!stats) return null;

    return (
        <div className="fixed top-0 left-0 w-screen h-screen pointer-events-none select-none overflow-hidden bg-transparent">

            {/* HUD Container - Interativo apenas ao passar o mouse */}
            <div className="absolute top-0 left-0 w-full flex items-start justify-center pointer-events-none">
                <div
                    className="flex items-center gap-12 px-4 py-2 drag-region bg-black/0 hover:bg-black/20 transition-colors rounded-xl pointer-events-auto"
                    onMouseEnter={() => {
                        // Quando o mouse entra na área dos ícones, captura os eventos (permite clique/arraste)
                        (window as any).ipcRenderer.send('set-ignore-mouse-events', false);
                    }}
                    onMouseLeave={() => {
                        // Quando sai, deixa passar direto novamente
                        (window as any).ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
                    }}
                >

                    {/* Total Kills (Main Counter) - HUGE */}
                    <div className="flex flex-col items-center mr-8 group">
                        <span className="text-8xl font-black text-white drop-shadow-[0_4px_4px_rgba(0,0,0,1)] font-mono leading-none stroke-black stroke-2">
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

                        {/* Great One - Tenta usar a versão -01, fallback para normal */}
                        <div className="flex flex-col items-center group">
                            <img
                                src="/cotw_go_icon-01.webp"
                                onError={(e) => e.currentTarget.src = '/cotw_go_icon.webp'}
                                alt="GO"
                                className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110"
                            />
                            <span className="text-4xl text-yellow-400 font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,1)] mt-[-5px]">{stats.greatOnes}</span>
                        </div>

                        {/* Super Rare - NOME CONFIRMADO: diamond-rare.webp */}
                        <div className="flex flex-col items-center group">
                            <img src="/diamond-rare.webp" alt="Super Rare" className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110" />
                            <span className="text-4xl text-purple-400 font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,1)] mt-[-5px]">{stats.superRares}</span>
                        </div>

                        {/* Rare - NOME CONFIRMADO: cotw_rare_icon.webp */}
                        <div className="flex flex-col items-center group">
                            <img src="/cotw_rare_icon.webp" alt="Rare" className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] filter brightness-110" />
                            <span className="text-4xl text-pink-400 font-bold drop-shadow-[0_3px_3px_rgba(0,0,0,1)] mt-[-5px]">{stats.rares}</span>
                        </div>

                        {/* Troll - NOME CONFIRMADO: cotw_troll_icon.webp */}
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
