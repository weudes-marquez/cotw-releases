// src/app/planner/grind-monitor/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useBestiary } from '@/components/PlannerClientLayout';
import { useTranslation, type Locale } from '@/hooks/use-translation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Power, RotateCcw, Skull, Diamond, Gem, Crown, Plus, Minus, Frown, Star } from 'lucide-react';
import type { GrindSession, Species, Trophy } from '@/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

// Helper to get translated text if available
const getTranslatedText = (textValue: any, locale: Locale, fallback: string = '') => {
    if (!textValue) return fallback;
    if (typeof textValue === 'string') return textValue;
    if (typeof textValue === 'object' && textValue !== null) {
        return textValue[locale] || textValue['pt-BR'] || textValue['en-US'] || fallback;
    }
    return fallback;
};

// Hook to manage grind data via API
function useGrindData(speciesId: string | null) {
    const [totalKills, setTotalKills] = useState(0);
    const [sessionKills, setSessionKills] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        if (!speciesId || !user) {
            setTotalKills(0);
            setSessionKills(0);
            return;
        }
        setIsLoading(true);
        setSessionKills(0);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/grind-data?speciesId=${speciesId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`API Error (${response.status}):`, errorText);
                throw new Error(`Failed to fetch grind data: ${response.status} ${errorText}`);
            }
            const data = await response.json();
            setTotalKills(data.totalKills);
        } catch (error: any) {
            console.error("Fetch error details:", error);
            toast({
                variant: 'destructive',
                title: 'Erro ao carregar dados',
                description: error.message || 'Verifique o console para mais detalhes.'
            });
        } finally {
            setIsLoading(false);
        }
    }, [speciesId, user, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const updateKills = async (action: 'increment' | 'decrement', amount: number) => {
        if (!user || !speciesId) return;

        const optimisticTotal = totalKills + (action === 'increment' ? amount : -amount);
        const optimisticSession = sessionKills + (action === 'increment' ? amount : 0);

        setTotalKills(optimisticTotal);
        setSessionKills(optimisticSession);

        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/grind-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ action, payload: { amount, speciesId } }),
            });
            if (!response.ok) throw new Error('Failed to update kills');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível sincronizar a contagem.' });
            fetchData();
        }
    };

    const increment = () => updateKills('increment', 1);
    const decrement = () => updateKills('decrement', 1);

    const resetSession = () => {
        setSessionKills(0);
        toast({ title: 'Sessão Resetada', description: 'O contador da sessão atual foi zerado.' });
    };

    return { totalKills, sessionKills, isLoading, increment, decrement, resetSession, refetch: fetchData };
}

export default function GrindMonitorTestPage() {
    const { t, locale } = useTranslation();
    const bestiaryData = useBestiary();
    const { species, isLoading: isBestiaryLoading } = bestiaryData || {};
    const cardRef = useRef<HTMLDivElement>(null);

    const [selectedSpeciesId, setSelectedSpeciesId] = useState('');
    const [activeGrind, setActiveGrind] = useState<string | null>(null);

    const { totalKills, sessionKills, isLoading: isGrindLoading, increment, decrement, resetSession } = useGrindData(activeGrind);

    const selectedSpecies = useMemo(() => {
        return species?.find(s => s.id === (activeGrind || selectedSpeciesId));
    }, [species, activeGrind, selectedSpeciesId]);

    const handleStartGrind = () => {
        if (selectedSpeciesId) {
            setActiveGrind(selectedSpeciesId);
        }
    };

    const handleEndGrind = () => {
        setActiveGrind(null);
        setSelectedSpeciesId('');
    };

    if (isBestiaryLoading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="p-4 sm:p-8 flex items-center justify-center min-h-full">
            <div className="perspective-container">
                <Card
                    ref={cardRef}
                    className="w-full max-w-sm text-card-foreground border-none"
                    style={{ backgroundColor: '#0c0a09', color: '#FFFFFF' }}
                >
                    <CardHeader className="text-center">
                        {!activeGrind ? (
                            <>
                                <CardTitle>{t('grind_monitor_title')}</CardTitle>
                                <CardDescription className="text-stone-400">Selecione uma espécie para iniciar uma nova sessão de caça.</CardDescription>
                            </>
                        ) : (
                            <div className="flex items-center gap-4">
                                {selectedSpecies?.imageUrl && (
                                    <Image src={selectedSpecies.imageUrl} alt={getTranslatedText(selectedSpecies.name, locale)} width={64} height={64} className="rounded-md border p-1 bg-black/10" />
                                )}
                                <div>
                                    <CardTitle className="text-left">{getTranslatedText(selectedSpecies?.name, locale)}</CardTitle>
                                    <CardDescription className="text-left text-stone-400">Grind em andamento</CardDescription>
                                </div>
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>
                        {!activeGrind ? (
                            <div className="space-y-4">
                                <Select value={selectedSpeciesId} onValueChange={setSelectedSpeciesId}>
                                    <SelectTrigger className="bg-stone-800 border-stone-700 text-white"><SelectValue placeholder={t('grind_monitor_species_placeholder')} /></SelectTrigger>
                                    <SelectContent>
                                        {(species || []).map(sp => (
                                            <SelectItem key={sp.id} value={sp.id}>{getTranslatedText(sp.name, locale)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button className="w-full bg-stone-800 text-white hover:bg-stone-700" onClick={handleStartGrind} disabled={!selectedSpeciesId}>
                                    {t('grind_monitor_start_button')}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div>
                                        <p className="text-sm font-medium text-stone-400">SESSÃO</p>
                                        <p className="text-4xl font-bold font-mono">{sessionKills}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-stone-400">TOTAL</p>
                                        {isGrindLoading ? (
                                            <Loader2 className="h-10 w-10 mx-auto animate-spin" />
                                        ) : (
                                            <div className="flex items-center justify-center gap-2">
                                                <Button variant="outline" size="icon" className="h-7 w-7 bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700" onClick={decrement}><Minus className="h-4 w-4" /></Button>
                                                <p className="text-4xl font-bold font-mono">{totalKills}</p>
                                                <Button variant="outline" size="icon" className="h-7 w-7 bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700" onClick={increment}><Plus className="h-4 w-4" /></Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 relative z-10">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            onClick={() => { }}
                                            className="py-1.5 px-2 text-[9px] font-bold border border-blue-600/50 bg-gradient-to-r from-blue-900/20 via-blue-800/10 to-blue-900/20 text-blue-300 hover:bg-blue-500 hover:text-white hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all rounded-sm flex items-center justify-center gap-1 active:scale-[0.98]"
                                        >
                                            <Gem className="h-3 w-3" /> DIAMANTE
                                        </Button>
                                        <Button
                                            onClick={() => { }}
                                            className="py-1.5 px-2 text-[9px] font-bold border border-orange-600/50 bg-gradient-to-r from-orange-900/20 via-orange-800/10 to-orange-900/20 text-orange-400 hover:bg-orange-600 hover:text-white hover:border-orange-400 hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all rounded-sm flex items-center justify-center gap-1 active:scale-[0.98]"
                                        >
                                            <Frown className="h-3 w-3" /> TROLL
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            onClick={() => { }}
                                            className="py-1.5 px-2 text-[9px] font-bold border border-purple-600/50 bg-gradient-to-r from-purple-900/20 via-purple-800/10 to-purple-900/20 text-purple-300 hover:bg-purple-500 hover:text-white hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all rounded-sm flex items-center justify-center gap-1 active:scale-[0.98]"
                                        >
                                            <Star className="h-3 w-3" /> RARO
                                        </Button>
                                        <Button
                                            onClick={() => { }}
                                            className="py-1.5 px-2 text-[9px] font-bold border border-cyan-600/50 bg-gradient-to-r from-cyan-900/20 via-blue-900/10 to-purple-900/20 text-cyan-300 hover:bg-gradient-to-r hover:from-cyan-600 hover:via-blue-500 hover:to-purple-600 hover:text-white hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all rounded-sm flex items-center justify-center gap-1 active:scale-[0.98]"
                                        >
                                            <Gem className="h-3 w-3" />
                                            <Star className="h-2 w-2" />
                                            <span className="tracking-tighter">DIAMANTE RARO</span>
                                        </Button>
                                    </div>
                                    <Button
                                        onClick={() => { }}
                                        className="w-full py-2 px-2 text-[10px] font-bold border border-yellow-600/50 bg-gradient-to-r from-yellow-900/20 via-yellow-800/10 to-yellow-900/20 text-amber-400 hover:bg-gradient-to-r hover:from-yellow-600 hover:via-yellow-500 hover:to-yellow-600 hover:text-white hover:border-amber-400 hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all rounded-sm flex items-center justify-center gap-2 group active:scale-[0.98]"
                                    >
                                        <Crown className="h-3 w-3 group-hover:animate-bounce" />
                                        <span className="tracking-[0.2em] text-sm">GREAT ONE</span>
                                    </Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="secondary" className="w-full bg-stone-800 text-stone-300 border-stone-700" onClick={resetSession}><RotateCcw className="h-4 w-4 mr-2" />SESSÃO</Button>
                                    <Button variant="destructive" className="w-full" onClick={handleEndGrind}><Power className="h-4 w-4 mr-2" />GRIND</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
