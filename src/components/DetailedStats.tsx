import React, { useState, useEffect } from 'react';
import { db } from '../db_local';
import { auth } from '../firebase';
import { getSupabaseUserId } from '../supabase_client';

export const DetailedStats: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    const loadDetailedStats = async () => {
        if (!auth.currentUser) return;
        const userId = getSupabaseUserId(auth.currentUser.uid);

        try {
            // 1. Buscar todas as sessões
            const sessions = await db.grind_sessions
                .where('user_id').equals(userId)
                .toArray();

            // 2. Buscar todos os abates
            const allKills = await db.kill_records
                .where('user_id').equals(userId)
                .sortBy('killed_at');

            // 3. Cálculos Básicos
            const totalKills = sessions.reduce((sum, s) => sum + (s.total_kills || 0), 0);
            const totalSessions = sessions.length;
            const uniqueAnimals = new Set(sessions.map(s => s.animal_id)).size;

            // 4. Troféus
            const diamonds = allKills.filter(k => k.is_diamond);
            const greatOnes = allKills.filter(k => k.is_great_one);
            const trolls = allKills.filter(k => k.is_troll);
            const rares = allKills.filter(k => k.fur_type_id && k.fur_type_id !== 'undefined');

            // 5. Médias e Intervalos (Kills to Trophy)
            const calculateIntervals = (trophies: any[]) => {
                const intervals: number[] = [];
                for (let i = 0; i < trophies.length; i++) {
                    const currentTrophy = trophies[i];
                    const currentKillNum = currentTrophy.kill_number || 0;

                    if (i === 0) {
                        // Primeiro troféu: abates desde o início até ele
                        intervals.push(currentKillNum);
                    } else {
                        // Troféus subsequentes: abates entre este e o anterior
                        const prevTrophy = trophies[i - 1];
                        const prevKillNum = prevTrophy.kill_number || 0;
                        intervals.push(Math.max(0, currentKillNum - prevKillNum));
                    }
                }
                return intervals;
            };

            const diamondIntervals = calculateIntervals(diamonds);
            const goIntervals = calculateIntervals(greatOnes);
            const rareIntervals = calculateIntervals(rares);

            const lastDiamondInterval = diamondIntervals.length > 0 ? diamondIntervals[diamondIntervals.length - 1] : 0;
            const lastGOInterval = goIntervals.length > 0 ? goIntervals[goIntervals.length - 1] : 0;
            const lastRareInterval = rareIntervals.length > 0 ? rareIntervals[rareIntervals.length - 1] : 0;

            // Média Global: Total de Abates / Quantidade de Troféus
            const avgDiamondInterval = diamonds.length > 0 ? Math.round(totalKills / diamonds.length) : 0;
            const avgGOInterval = greatOnes.length > 0 ? Math.round(totalKills / greatOnes.length) : 0;
            const avgRareInterval = rares.length > 0 ? Math.round(totalKills / rares.length) : 0;

            // Variação: Último Intervalo vs Média Geral
            const diamondVariation = lastDiamondInterval - avgDiamondInterval;
            const goVariation = lastGOInterval - avgGOInterval;
            const rareVariation = lastRareInterval - avgRareInterval;

            // 6. Progresso desde o último troféu (Live)
            const lastDiamondKillNum = diamonds.length > 0 ? diamonds[diamonds.length - 1].kill_number : 0;
            const lastGOKillNum = greatOnes.length > 0 ? greatOnes[greatOnes.length - 1].kill_number : 0;
            const lastRareKillNum = rares.length > 0 ? rares[rares.length - 1].kill_number : 0;

            const killsSinceLastDiamond = Math.max(0, totalKills - lastDiamondKillNum);
            const killsSinceLastGO = Math.max(0, totalKills - lastGOKillNum);
            const killsSinceLastRare = Math.max(0, totalKills - lastRareKillNum);

            // 7. Distribuição de Furs Raras
            const rareFursMap: Record<string, { count: number, name: string }> = {};
            rares.forEach(r => {
                const name = r.fur_type_name || 'Desconhecido';
                if (!rareFursMap[name]) rareFursMap[name] = { count: 0, name };
                rareFursMap[name].count += 1;
            });
            const rareFursList = Object.values(rareFursMap).sort((a, b) => b.count - a.count);

            setStats({
                totalKills,
                totalSessions,
                uniqueAnimals,
                diamondsCount: diamonds.length,
                goCount: greatOnes.length,
                trollsCount: trolls.length,
                raresCount: rares.length,

                // Novas Estatísticas
                lastDiamondInterval,
                lastGOInterval,
                lastRareInterval,
                avgDiamondInterval,
                avgGOInterval,
                avgRareInterval,
                diamondVariation,
                goVariation,
                rareVariation,

                rareFursList,
                killsSinceLastDiamond,
                killsSinceLastGO,
                killsSinceLastRare
            });
        } catch (error) {
            console.error('Error loading detailed stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDetailedStats();
    }, []);

    const renderVariation = (val: number) => {
        if (val === 0) return <span className="text-stone-500">±0</span>;
        const isPos = val > 0;
        return (
            <span className={isPos ? 'text-red-400' : 'text-green-400'}>
                {isPos ? '+' : ''}{val}
            </span>
        );
    };

    return (
        <div className="h-screen bg-[#1c1917] text-white flex flex-col overflow-hidden">

            {/* Custom Title Bar */}
            <div className="h-10 bg-[#26221f] border-b border-white/5 flex items-center justify-between px-4 select-none shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
                <div className="flex items-center gap-2">
                    <i className="fa-solid fa-chart-line text-hunter-orange text-xs"></i>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">Sistema de Inteligência COTW</span>
                </div>
                <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button onClick={() => window.location.reload()} className="text-stone-500 hover:text-white transition-colors">
                        <i className="fa-solid fa-rotate-right text-xs"></i>
                    </button>
                    <button onClick={() => window.close()} className="text-stone-500 hover:text-red-500 transition-colors">
                        <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-hunter-orange"></div>
                        <span className="text-stone-500 text-xs uppercase tracking-widest animate-pulse">Analisando Dados...</span>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

                    {/* Hero Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-serif font-black tracking-tighter text-white">
                                Painel de <span className="text-hunter-orange">Caça</span>
                            </h1>
                            <p className="text-stone-400 mt-1 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em] font-bold">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.6)]"></span>
                                Análise em Tempo Real • Histórico Global
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                <span className="text-stone-500 text-[10px] uppercase block mb-1">Sessões</span>
                                <span className="text-xl font-bold leading-none">{stats.totalSessions}</span>
                            </div>
                            <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                <span className="text-stone-500 text-[10px] uppercase block mb-1">Espécies</span>
                                <span className="text-xl font-bold leading-none">{stats.uniqueAnimals}</span>
                            </div>
                        </div>
                    </div>

                    {/* Top Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Total Harvests */}
                        <div className="bg-[#26221f] p-4 rounded-xl border border-white/5 relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <i className="fa-solid fa-paw text-5xl text-hunter-orange"></i>
                            </div>
                            <h4 className="text-stone-500 text-xs uppercase tracking-widest font-black">Total de Abates</h4>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className="text-4xl font-black text-white font-mono leading-none">{stats.totalKills}</span>
                                <div className="flex flex-col">
                                    <span className="text-green-400 text-xs font-bold">Ativo</span>
                                </div>
                            </div>
                            <div className="mt-3 h-1 w-full bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-hunter-orange to-orange-400 w-full shadow-[0_0_10px_rgba(217,93,30,0.4)]"></div>
                            </div>
                        </div>

                        {/* Diamonds */}
                        <div className="bg-[#26221f] p-4 rounded-xl border border-white/5 relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <i className="fa-solid fa-gem text-5xl text-blue-400"></i>
                            </div>
                            <h4 className="text-stone-500 text-xs uppercase tracking-widest font-black">Diamantes</h4>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className="text-4xl font-black text-white font-mono leading-none">{stats.diamondsCount}</span>
                                <div className="flex flex-col">
                                    <span className="text-blue-400 text-xs font-bold">Elite</span>
                                    <span className="text-stone-400 text-[10px] uppercase font-bold mt-1">Média: {stats.avgDiamondInterval} abates</span>
                                </div>
                            </div>
                            <div className="mt-3 flex justify-between items-center text-xs font-bold uppercase">
                                <span className="text-stone-300">Último: <span className="text-white">{stats.lastDiamondInterval}</span></span>
                                <span className="text-stone-300">Var: {renderVariation(stats.diamondVariation)}</span>
                            </div>
                            <div className="mt-2 h-1 w-full bg-black/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)] transition-all duration-1000"
                                    style={{ width: `${stats.avgDiamondInterval > 0 ? Math.min(100, (stats.killsSinceLastDiamond / stats.avgDiamondInterval) * 100) : 0}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Great Ones */}
                        <div className="bg-[#26221f] p-4 rounded-xl border border-white/5 relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <i className="fa-solid fa-crown text-5xl text-go-gold"></i>
                            </div>
                            <h4 className="text-stone-500 text-xs uppercase tracking-widest font-black">Great Ones</h4>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className="text-4xl font-black text-white font-mono leading-none">{stats.goCount}</span>
                                <div className="flex flex-col">
                                    <span className="text-go-gold text-xs font-bold">Lendário</span>
                                    <span className="text-stone-400 text-[10px] uppercase font-bold mt-1">Média: {stats.avgGOInterval} abates</span>
                                </div>
                            </div>
                            <div className="mt-3 flex justify-between items-center text-xs font-bold uppercase">
                                <span className="text-stone-300">Último: <span className="text-white">{stats.lastGOInterval}</span></span>
                                <span className="text-stone-300">Var: {renderVariation(stats.goVariation)}</span>
                            </div>
                            <div className="mt-2 h-1 w-full bg-black/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 shadow-[0_0_10px_rgba(251,191,36,0.4)] transition-all duration-1000"
                                    style={{ width: `${stats.avgGOInterval > 0 ? Math.min(100, (stats.killsSinceLastGO / stats.avgGOInterval) * 100) : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                        {/* Left Column - Charts */}
                        <div className="lg:col-span-12 space-y-5">

                            {/* Trophy Distribution */}
                            <div className="bg-[#26221f] p-5 rounded-xl border border-white/5 shadow-xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                        <i className="fa-solid fa-chart-simple text-hunter-orange"></i> Distribuição de Troféus
                                    </h3>
                                    <div className="flex gap-6">
                                        <div className="text-right">
                                            <p className="text-[10px] text-stone-500 uppercase font-black">Média Raros</p>
                                            <p className="text-sm text-purple-400 font-black">{stats.avgRareInterval} <span className="text-[10px] text-stone-600">ABATES</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-stone-500 uppercase font-black">Último Raro</p>
                                            <p className="text-sm text-purple-400 font-black">{stats.lastRareInterval} <span className="text-[10px] text-stone-600">ABATES</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-stone-500 uppercase font-black">Var Raros</p>
                                            <p className="text-sm font-black">{renderVariation(stats.rareVariation)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="md:col-span-2 space-y-4">
                                        {[
                                            { label: 'Great One', count: stats.goCount, color: 'bg-go-gold', textColor: 'text-go-gold' },
                                            { label: 'Diamante', count: stats.diamondsCount, color: 'bg-blue-500', textColor: 'text-blue-400' },
                                            { label: 'Raro', count: stats.raresCount, color: 'bg-purple-500', textColor: 'text-purple-400' },
                                            { label: 'Troll', count: stats.trollsCount, color: 'bg-red-500', textColor: 'text-red-500' },
                                            { label: 'Comum', count: Math.max(0, stats.totalKills - stats.diamondsCount - stats.goCount - stats.raresCount), color: 'bg-stone-600', textColor: 'text-stone-500' }
                                        ].map((item, i) => {
                                            const percentage = stats.totalKills > 0 ? (item.count / stats.totalKills) * 100 : 0;
                                            return (
                                                <div key={i} className="group">
                                                    <div className="flex justify-between text-[10px] uppercase font-black mb-1">
                                                        <span className={item.textColor}>{item.label}</span>
                                                        <span className="text-stone-400">{item.count} ({percentage.toFixed(1)}%)</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${item.color} transition-all duration-1000`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="bg-black/20 rounded-xl p-6 flex flex-col justify-center border border-white/5 text-center">
                                        <p className="text-stone-500 text-xs uppercase tracking-widest font-bold mb-2">Índice de Raridade</p>
                                        <p className="text-4xl font-black text-white">
                                            {(((stats.diamondsCount + stats.goCount + stats.raresCount) / Math.max(1, stats.totalKills)) * 100).toFixed(2)}%
                                        </p>
                                        <p className="text-stone-600 text-[10px] uppercase mt-2 font-bold">Troféus vs Total</p>
                                    </div>
                                </div>
                            </div>

                            {/* Rare Furs Collection */}
                            <div className="bg-[#26221f] rounded-xl border border-white/5 shadow-xl overflow-hidden">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                    <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                        <i className="fa-solid fa-star text-purple-400"></i> Pelagens Raras
                                    </h3>
                                    <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full font-black">
                                        {stats.raresCount} TOTAL
                                    </span>
                                </div>
                                <div className="p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
                                    {stats.rareFursList.length > 0 ? stats.rareFursList.map((fur: any, i: number) => (
                                        <div key={i} className="bg-black/30 p-3 rounded-xl border border-white/5 hover:border-purple-500/50 transition-all group">
                                            <span className="text-stone-500 text-[10px] uppercase block mb-1 font-bold truncate">{fur.name}</span>
                                            <span className="text-2xl font-black text-white leading-none">{fur.count}</span>
                                        </div>
                                    )) : (
                                        <div className="col-span-full py-6 text-center text-stone-600 text-xs italic">
                                            Nenhuma pelagem rara documentada.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-white/5 bg-[#26221f] flex justify-between items-center shrink-0">
                <p className="text-stone-600 text-[10px] uppercase tracking-[0.3em] font-bold">
                    COTW Intelligence • v2.0.4
                </p>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                    <span className="text-stone-500 text-[10px] uppercase font-bold">Sincronizado</span>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #1c1917;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #26221f;
                    border-radius: 10px;
                    border: 1px solid #1c1917;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #3f3f46;
                }
            `}</style>
        </div>
    );
};
