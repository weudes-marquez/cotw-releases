import React, { useState, useEffect } from 'react';
import { db } from '../db_local';
import { auth } from '../firebase';
import { getSupabaseUserId } from '../supabase_client';
import type { KillRecord } from '../types';

export const DetailedStats: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
    const [trophyFilter, setTrophyFilter] = useState<string | null>(null);

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

            // 7. Distribuição de Furs Raras (Global)
            const rareFursMap: Record<string, { count: number, name: string }> = {};
            rares.forEach(r => {
                const name = r.fur_type_name || 'Desconhecido';
                if (!rareFursMap[name]) rareFursMap[name] = { count: 0, name };
                rareFursMap[name].count += 1;
            });
            const rareFursList = Object.values(rareFursMap).sort((a, b) => b.count - a.count);

            // 8. Estatísticas por Animal (Inventário)
            const animalNamesMap: Record<string, string> = {};
            sessions.forEach(s => {
                if (s.animal_id && s.animal_name) {
                    animalNamesMap[s.animal_id] = s.animal_name;
                }
            });

            const animalStatsMap: Record<string, any> = {};
            allKills.forEach(k => {
                const aid = k.animal_id;
                if (!animalStatsMap[aid]) {
                    animalStatsMap[aid] = {
                        id: aid,
                        name: animalNamesMap[aid] || 'Animal Desconhecido',
                        totalKills: 0,
                        diamonds: 0,
                        greatOnes: 0,
                        trolls: 0,
                        rares: 0,
                        rareFurs: {} as Record<string, number>,
                        maxWeight: 0,
                        maxScore: 0,
                        kills: [] as KillRecord[]
                    };
                }

                const a = animalStatsMap[aid];
                a.totalKills += 1;
                if (k.is_diamond) a.diamonds += 1;
                if (k.is_great_one) a.greatOnes += 1;
                if (k.is_troll) a.trolls += 1;
                if (k.fur_type_id && k.fur_type_id !== 'undefined') {
                    a.rares += 1;
                    const fname = k.fur_type_name || 'Desconhecido';
                    a.rareFurs[fname] = (a.rareFurs[fname] || 0) + 1;
                }
                if (k.weight && k.weight > a.maxWeight) a.maxWeight = k.weight;
                if (k.trophy_score && k.trophy_score > a.maxScore) a.maxScore = k.trophy_score;
                a.kills.push(k);
            });

            // Sort kills by date descending safely
            Object.values(animalStatsMap).forEach((a: any) => {
                a.kills.sort((x: any, y: any) => {
                    const timeX = x.killed_at ? new Date(x.killed_at).getTime() : 0;
                    const timeY = y.killed_at ? new Date(y.killed_at).getTime() : 0;
                    return timeY - timeX;
                });
            });

            const animalStatsList = Object.values(animalStatsMap).sort((a, b) => b.totalKills - a.totalKills);

            if (!selectedAnimalId && animalStatsList.length > 0) {
                setSelectedAnimalId(animalStatsList[0].id);
            }

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
                animalStatsList,
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
            ) : stats ? (
                <div className="flex-1 overflow-y-auto px-4 pt-0 pb-4 space-y-4 custom-scrollbar">

                    {/* Hero Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-serif font-black tracking-tighter text-white leading-tight">
                                Painel de <span className="text-hunter-orange">Caça</span>
                            </h1>
                            <p className="text-stone-400 mt-0.5 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em] font-bold">
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* Total Harvests */}
                        <div className="bg-[#26221f] p-4 rounded-xl border border-white/5 relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <i className="fa-solid fa-paw text-5xl text-hunter-orange"></i>
                            </div>
                            <h4 className="text-stone-500 text-[10px] uppercase tracking-widest font-black">Total de Abates</h4>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className="text-3xl font-black text-white font-mono leading-none">{stats.totalKills}</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-hunter-orange to-orange-400 w-full shadow-[0_0_10px_rgba(217,93,30,0.4)]"></div>
                            </div>
                        </div>

                        {/* Great Ones */}
                        <div className="bg-[#26221f] p-4 rounded-xl border border-white/5 relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <i className="fa-solid fa-crown text-5xl text-go-gold"></i>
                            </div>
                            <h4 className="text-stone-500 text-[10px] uppercase tracking-widest font-black">Great Ones</h4>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className="text-3xl font-black text-white font-mono leading-none">{stats.goCount}</span>
                                <span className="text-go-gold text-[10px] font-bold">GO</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]" style={{ width: `${stats.avgGOInterval > 0 ? Math.min(100, (stats.killsSinceLastGO / stats.avgGOInterval) * 100) : 0}%` }}></div>
                            </div>
                        </div>

                        {/* Diamonds */}
                        <div className="bg-[#26221f] p-4 rounded-xl border border-white/5 relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <i className="fa-solid fa-gem text-5xl text-blue-400"></i>
                            </div>
                            <h4 className="text-stone-500 text-[10px] uppercase tracking-widest font-black">Diamantes</h4>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className="text-3xl font-black text-white font-mono leading-none">{stats.diamondsCount}</span>
                                <span className="text-blue-400 text-[10px] font-bold">DIMAS</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]" style={{ width: `${stats.avgDiamondInterval > 0 ? Math.min(100, (stats.killsSinceLastDiamond / stats.avgDiamondInterval) * 100) : 0}%` }}></div>
                            </div>
                        </div>

                        {/* Rares */}
                        <div className="bg-[#26221f] p-4 rounded-xl border border-white/5 relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <i className="fa-solid fa-star text-5xl text-purple-400"></i>
                            </div>
                            <h4 className="text-stone-500 text-[10px] uppercase tracking-widest font-black">Raros</h4>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className="text-3xl font-black text-white font-mono leading-none">{stats.raresCount}</span>
                                <span className="text-purple-400 text-[10px] font-bold">RARE</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]" style={{ width: `${stats.avgRareInterval > 0 ? Math.min(100, (stats.killsSinceLastRare / stats.avgRareInterval) * 100) : 0}%` }}></div>
                            </div>
                        </div>

                        {/* Trolls */}
                        <div className="bg-[#26221f] p-4 rounded-xl border border-white/5 relative overflow-hidden group shadow-xl">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <i className="fa-solid fa-skull text-5xl text-red-500"></i>
                            </div>
                            <h4 className="text-stone-500 text-[10px] uppercase tracking-widest font-black">Trolls</h4>
                            <div className="mt-2 flex items-baseline gap-3">
                                <span className="text-3xl font-black text-white font-mono leading-none">{stats.trollsCount}</span>
                                <span className="text-red-500 text-[10px] font-bold">TROLL</span>
                            </div>
                            <div className="mt-3 h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_10px_rgba(239,68,68,0.4)] w-full"></div>
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
                                        <p className="text-stone-500 text-xs uppercase tracking-widest font-bold mb-2">Média geral</p>
                                        <p className="text-4xl font-black text-white">
                                            {(((stats.diamondsCount + stats.goCount + stats.raresCount) / Math.max(1, stats.totalKills)) * 100).toFixed(2)}%
                                        </p>
                                        <p className="text-stone-600 text-[10px] uppercase mt-2 font-bold">Raros, Dimas e GO VS Total</p>
                                    </div>
                                </div>
                            </div>

                            {/* Rare Furs Collection */}
                            <div className="bg-[#26221f] rounded-xl border border-white/5 shadow-xl overflow-hidden">
                                <div className="p-3 border-b border-white/5 bg-purple-500/10 flex justify-between items-center">
                                    <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                        <i className="fa-solid fa-star text-purple-400"></i> Pelagens Raras Globais
                                    </h3>
                                    <span className="bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 rounded-full font-black">
                                        {stats.raresCount} TOTAL
                                    </span>
                                </div>
                                <div className="p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                                    {stats.rareFursList.length > 0 ? stats.rareFursList.map((fur: any, i: number) => (
                                        <div key={i} className="bg-black/30 p-2 rounded-lg border border-white/5 hover:border-purple-500/50 transition-all group">
                                            <span className="text-stone-500 text-[8px] uppercase block mb-0.5 font-bold truncate">{fur.name}</span>
                                            <span className="text-lg font-black text-white leading-none">{fur.count}</span>
                                        </div>
                                    )) : (
                                        <div className="col-span-full py-6 text-center text-stone-600 text-xs italic">
                                            Nenhuma pelagem rara documentada.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Detailed Inventory by Species - Fluid Accordion Layout */}
                            <div className="space-y-4 pb-10">
                                <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-stone-500 flex items-center gap-3">
                                    <span className="h-px flex-1 bg-white/5"></span>
                                    Inventário por Espécie
                                    <span className="h-px flex-1 bg-white/5"></span>
                                </h3>

                                {/* Search Bar */}
                                <div className="relative max-w-md mx-auto mb-6">
                                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 text-sm"></i>
                                    <input
                                        type="text"
                                        placeholder="Buscar espécie (ex: Cervo, Urso...)"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-[#26221f] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:border-hunter-orange/50 transition-all shadow-xl"
                                    />
                                </div>

                                {/* Accordion List */}
                                <div className="space-y-2">
                                    {stats.animalStatsList
                                        .filter((a: any) => {
                                            const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase());
                                            if (!trophyFilter) return matchesSearch;
                                            if (trophyFilter === 'go') return matchesSearch && a.greatOnes > 0;
                                            if (trophyFilter === 'diamond') return matchesSearch && a.diamonds > 0;
                                            if (trophyFilter === 'rare') return matchesSearch && a.rares > 0;
                                            if (trophyFilter === 'troll') return matchesSearch && a.trolls > 0;
                                            return matchesSearch;
                                        })
                                        .map((animal: any) => {
                                            const isExpanded = selectedAnimalId === animal.id;
                                            return (
                                                <div key={animal.id} className={`bg-[#26221f] rounded-xl border transition-all duration-300 overflow-hidden shadow-lg ${isExpanded ? 'border-hunter-orange/40 ring-1 ring-hunter-orange/20 bg-white/[0.02]' : 'border-white/5 hover:border-hunter-orange/60 hover:bg-hunter-orange/10 hover:translate-x-1 hover:shadow-[0_0_20px_rgba(217,93,30,0.1)]'
                                                    }`}>
                                                    {/* Animal Row (Header) */}
                                                    <button
                                                        onClick={() => setSelectedAnimalId(isExpanded ? null : animal.id)}
                                                        className="w-full p-3 flex justify-between items-center group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-hunter-orange text-white' : 'bg-white/5 text-stone-500 group-hover:text-stone-300'
                                                                }`}>
                                                                <i className="fa-solid fa-paw text-xs"></i>
                                                            </div>
                                                            <div className="text-left">
                                                                <h4 className={`text-sm font-black uppercase tracking-tight transition-colors ${isExpanded ? 'text-white' : 'text-stone-300 group-hover:text-white'
                                                                    }`}>
                                                                    {animal.name}
                                                                </h4>
                                                                <p className="text-[9px] text-stone-500 font-bold uppercase tracking-widest">{animal.totalKills} Abates</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="hidden md:flex gap-2">
                                                                {animal.greatOnes > 0 && (
                                                                    <span className="bg-go-gold/20 text-go-gold text-[9px] px-2 py-0.5 rounded font-black border border-go-gold/30">
                                                                        {animal.greatOnes} GO
                                                                    </span>
                                                                )}
                                                                {animal.diamonds > 0 && (
                                                                    <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-0.5 rounded font-black border border-blue-500/30">
                                                                        {animal.diamonds} DIMAS
                                                                    </span>
                                                                )}
                                                                {animal.trolls > 0 && (
                                                                    <span className="bg-red-500/20 text-red-400 text-[9px] px-2 py-0.5 rounded font-black border border-red-500/30">
                                                                        {animal.trolls} TROLLS
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-300 ${isExpanded ? 'rotate-180 text-hunter-orange' : 'text-stone-700'
                                                                }`}></i>
                                                        </div>
                                                    </button>

                                                    {/* Expanded Details */}
                                                    {isExpanded && (
                                                        <div className="p-6 pt-0 border-t border-white/5 bg-black/10 animate-in slide-in-from-top-2 duration-300">
                                                            {/* Trophy Stats Cards - Premium Grid */}
                                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
                                                                {/* Great One */}
                                                                <button
                                                                    onClick={() => setTrophyFilter(trophyFilter === 'go' ? null : 'go')}
                                                                    className={`p-2 rounded-xl border transition-all duration-300 hover:scale-105 animate-in zoom-in-95 duration-500 ${animal.greatOnes > 0
                                                                        ? (trophyFilter === 'go' ? 'bg-amber-500 text-white shadow-[0_0_20px_rgba(251,191,36,0.6)] border-white' : 'bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-white shadow-[0_0_15px_rgba(251,191,36,0.3)] border-amber-400/50')
                                                                        : 'bg-[#1c1917] text-stone-600 opacity-40 border-white/5'
                                                                        }`}>
                                                                    <div className="flex justify-center mb-0.5">
                                                                        <i className={`fa-solid fa-crown text-[10px] group-hover:scale-110 transition-transform ${animal.greatOnes > 0 ? 'text-white' : 'text-stone-700'}`}></i>
                                                                    </div>
                                                                    <span className={`text-[8px] uppercase font-black block mb-0.5 ${animal.greatOnes > 0 ? 'text-white/90' : 'text-stone-500'}`}>Great One</span>
                                                                    <span className="text-lg font-black leading-none">{animal.greatOnes}</span>
                                                                </button>

                                                                {/* Diamond */}
                                                                <button
                                                                    onClick={() => setTrophyFilter(trophyFilter === 'diamond' ? null : 'diamond')}
                                                                    className={`p-2 rounded-xl border transition-all duration-300 hover:scale-105 animate-in zoom-in-95 duration-500 delay-75 ${animal.diamonds > 0
                                                                        ? (trophyFilter === 'diamond' ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] border-white' : 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] border-blue-400/50')
                                                                        : 'bg-[#1c1917] text-stone-600 opacity-40 border-white/5'
                                                                        }`}>
                                                                    <div className="flex justify-center mb-0.5">
                                                                        <i className={`fa-solid fa-gem text-[10px] group-hover:scale-110 transition-transform ${animal.diamonds > 0 ? 'text-white' : 'text-stone-700'}`}></i>
                                                                    </div>
                                                                    <span className={`text-[8px] uppercase font-black block mb-0.5 ${animal.diamonds > 0 ? 'text-white/90' : 'text-stone-500'}`}>Diamante</span>
                                                                    <span className="text-lg font-black leading-none">{animal.diamonds}</span>
                                                                </button>

                                                                {/* Rare */}
                                                                <button
                                                                    onClick={() => setTrophyFilter(trophyFilter === 'rare' ? null : 'rare')}
                                                                    className={`p-2 rounded-xl border transition-all duration-300 hover:scale-105 animate-in zoom-in-95 duration-500 delay-100 ${animal.rares > 0
                                                                        ? (trophyFilter === 'rare' ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)] border-white' : 'bg-gradient-to-br from-purple-500 via-purple-600 to-purple-800 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] border-purple-400/50')
                                                                        : 'bg-[#1c1917] text-stone-600 opacity-40 border-white/5'
                                                                        }`}>
                                                                    <div className="flex justify-center mb-0.5">
                                                                        <i className={`fa-solid fa-star text-[10px] group-hover:scale-110 transition-transform ${animal.rares > 0 ? 'text-white' : 'text-stone-700'}`}></i>
                                                                    </div>
                                                                    <span className={`text-[8px] uppercase font-black block mb-0.5 ${animal.rares > 0 ? 'text-white/90' : 'text-stone-500'}`}>Raros</span>
                                                                    <span className="text-lg font-black leading-none">{animal.rares}</span>
                                                                </button>

                                                                {/* Troll */}
                                                                <button
                                                                    onClick={() => setTrophyFilter(trophyFilter === 'troll' ? null : 'troll')}
                                                                    className={`p-2 rounded-xl border transition-all duration-300 hover:scale-105 animate-in zoom-in-95 duration-500 delay-150 ${animal.trolls > 0
                                                                        ? (trophyFilter === 'troll' ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] border-white' : 'bg-gradient-to-br from-red-500 via-red-600 to-red-800 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] border-red-400/50')
                                                                        : 'bg-[#1c1917] text-stone-600 opacity-40 border-white/5'
                                                                        }`}>
                                                                    <div className="flex justify-center mb-0.5">
                                                                        <i className={`fa-solid fa-skull text-[10px] group-hover:scale-110 transition-transform ${animal.trolls > 0 ? 'text-white' : 'text-stone-700'}`}></i>
                                                                    </div>
                                                                    <span className={`text-[8px] uppercase font-black block mb-0.5 ${animal.trolls > 0 ? 'text-white/90' : 'text-stone-500'}`}>Trolls</span>
                                                                    <span className="text-lg font-black leading-none">{animal.trolls}</span>
                                                                </button>

                                                                {/* Record Score */}
                                                                <div className="bg-gradient-to-br from-stone-600 via-stone-700 to-stone-900 p-2 rounded-xl border border-white/20 text-center group transition-all duration-300 hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] animate-in zoom-in-95 duration-500 delay-200 col-span-2 md:col-span-1 text-white">
                                                                    <div className="flex justify-center mb-0.5">
                                                                        <i className="fa-solid fa-trophy text-[10px] group-hover:scale-110 transition-transform"></i>
                                                                    </div>
                                                                    <span className="text-[8px] text-white/90 uppercase font-black block mb-0.5">Recorde Score</span>
                                                                    <span className="text-lg font-black leading-none">{animal.maxScore.toFixed(2)}</span>
                                                                </div>
                                                            </div>

                                                            {/* Rare Furs */}
                                                            <div className="mt-8 space-y-3">
                                                                <h5 className="text-[10px] text-stone-500 uppercase font-black tracking-widest flex items-center gap-2">
                                                                    <i className="fa-solid fa-dna text-purple-400"></i> Pelagens Raras Documentadas
                                                                </h5>
                                                                {Object.keys(animal.rareFurs).length > 0 ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(animal.rareFurs).map(([name, count], idx) => (
                                                                            <div key={idx} className="bg-[#1c1917] px-4 py-2 rounded-lg border border-white/5 flex items-center gap-3 hover:border-purple-500/30 transition-colors">
                                                                                <span className="text-xs text-stone-300 font-bold uppercase">{name}</span>
                                                                                <span className="w-px h-3 bg-white/10"></span>
                                                                                <span className="text-sm font-black text-purple-400">x{count as number}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-stone-600 text-[10px] uppercase font-bold tracking-wider bg-black/20 p-3 rounded-lg border border-dashed border-white/5 text-center">
                                                                        Nenhuma pelagem rara encontrada.
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Kill History */}
                                                            <div className="mt-8 space-y-4">
                                                                <h5 className="text-[10px] text-stone-500 uppercase font-black tracking-widest flex items-center gap-2">
                                                                    <i className="fa-solid fa-clock-rotate-left text-hunter-orange"></i> Histórico de Abates Recentes
                                                                </h5>
                                                                <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-left border-collapse">
                                                                            <thead>
                                                                                <tr className="bg-white/5">
                                                                                    <th className="px-4 py-2 text-[9px] font-black text-stone-500 uppercase tracking-widest">Data/Hora</th>
                                                                                    <th className="px-4 py-2 text-[9px] font-black text-stone-500 uppercase tracking-widest">Troféu</th>
                                                                                    <th className="px-4 py-2 text-[9px] font-black text-stone-500 uppercase tracking-widest">Peso</th>
                                                                                    <th className="px-4 py-2 text-[9px] font-black text-stone-500 uppercase tracking-widest">Score</th>
                                                                                    <th className="px-4 py-2 text-[9px] font-black text-stone-500 uppercase tracking-widest">Pelagem</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-white/5">
                                                                                {animal.kills
                                                                                    .filter((k: KillRecord) => {
                                                                                        if (!trophyFilter) return true;
                                                                                        if (trophyFilter === 'go') return k.is_great_one;
                                                                                        if (trophyFilter === 'diamond') return k.is_diamond;
                                                                                        if (trophyFilter === 'rare') return k.fur_type_id && k.fur_type_id !== 'undefined';
                                                                                        if (trophyFilter === 'troll') return k.is_troll;
                                                                                        return true;
                                                                                    })
                                                                                    .slice(0, 10).map((k: KillRecord) => (
                                                                                        <tr key={k.id} className="hover:bg-white/5 transition-colors">
                                                                                            <td className="px-4 py-2.5">
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="text-[11px] text-stone-300 font-bold">
                                                                                                        {new Date(k.killed_at).toLocaleDateString('pt-BR')}
                                                                                                    </span>
                                                                                                    <span className="text-[9px] text-stone-500">
                                                                                                        {new Date(k.killed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5">
                                                                                                {k.is_great_one ? (
                                                                                                    <span className="text-[10px] font-black text-go-gold uppercase tracking-tighter flex items-center gap-1">
                                                                                                        <i className="fa-solid fa-crown text-[8px]"></i> Great One
                                                                                                    </span>
                                                                                                ) : k.is_diamond ? (
                                                                                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter flex items-center gap-1">
                                                                                                        <i className="fa-solid fa-gem text-[8px]"></i> Diamante
                                                                                                    </span>
                                                                                                ) : k.is_troll ? (
                                                                                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter flex items-center gap-1">
                                                                                                        <i className="fa-solid fa-skull text-[8px]"></i> Troll
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tighter">Comum</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5">
                                                                                                <span className="text-xs font-black text-white">{k.weight?.toFixed(2) || '---'} <span className="text-[9px] text-stone-500">kg</span></span>
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5">
                                                                                                <span className="text-xs font-black text-white">{k.trophy_score?.toFixed(2) || '---'}</span>
                                                                                            </td>
                                                                                            <td className="px-4 py-2.5">
                                                                                                <span className={`text-[10px] font-bold uppercase ${k.fur_type_id && k.fur_type_id !== 'undefined' ? 'text-purple-400' : 'text-stone-600'}`}>
                                                                                                    {k.fur_type_name || 'Comum'}
                                                                                                </span>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                    <div className="p-2 bg-white/5 text-center">
                                                                        <p className="text-[9px] text-stone-600 font-bold uppercase tracking-widest">
                                                                            {trophyFilter
                                                                                ? `Mostrando os abates de ${trophyFilter.toUpperCase()} mais recentes`
                                                                                : `Mostrando os 10 abates mais recentes de ${animal.totalKills}`
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Records Footer */}
                                                            <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 p-4 bg-hunter-orange/5 border border-hunter-orange/10 rounded-xl">
                                                                <div className="flex items-center gap-3">
                                                                    <i className="fa-solid fa-weight-hanging text-hunter-orange text-lg"></i>
                                                                    <div>
                                                                        <span className="text-[9px] text-stone-500 uppercase font-black block">Maior Peso</span>
                                                                        <span className="text-base font-black text-white">{animal.maxWeight.toFixed(2)} kg</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-center md:text-right">
                                                                    <span className="text-[9px] text-stone-500 uppercase font-black block">Representatividade</span>
                                                                    <span className="text-base font-black text-hunter-orange">
                                                                        {stats.totalKills > 0 ? ((animal.totalKills / stats.totalKills) * 100).toFixed(1) : '0.0'}% <span className="text-[10px] text-stone-600">do total</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-stone-500 text-xs uppercase tracking-widest">Nenhum dado disponível</div>
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
