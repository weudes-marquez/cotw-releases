import { useState, useEffect, useMemo } from 'react';
import { getNeedZones, getMaps, getSpecies } from '../supabase_integration';
import { ZoneTimeline } from './ZoneTimeline';
import { ZoneClock } from './ZoneClock';

interface NeedZonesPanelProps {
    show: boolean;
    onClose: () => void;
}

const ZONE_COLORS: Record<string, string> = {
    'Bebendo': '#3b82f6', 'Comendo': '#f97316', 'Descansando': '#22c55e', 'Coletando': '#a855f7',
    'Drinking': '#3b82f6', 'Eating': '#f97316', 'Resting': '#22c55e', 'Gathering': '#a855f7',
};

const ZONE_LABELS: Record<string, string> = {
    'Bebendo': 'Bebendo', 'Comendo': 'Comendo', 'Descansando': 'Descansando', 'Coletando': 'Coletando',
    'Drinking': 'Bebendo', 'Eating': 'Comendo', 'Resting': 'Descansando', 'Gathering': 'Coletando',
};

const ZONE_BG_CLASSES: Record<string, string> = {
    'Bebendo': 'bg-blue-500/20 text-blue-300 border-blue-500/50',
    'Comendo': 'bg-orange-500/20 text-orange-300 border-orange-500/50',
    'Descansando': 'bg-green-500/20 text-green-300 border-green-500/50',
    'Coletando': 'bg-purple-500/20 text-purple-300 border-purple-500/50',
    'Drinking': 'bg-blue-500/20 text-blue-300 border-blue-500/50',
    'Eating': 'bg-orange-500/20 text-orange-300 border-orange-500/50',
    'Resting': 'bg-green-500/20 text-green-300 border-green-500/50',
    'Gathering': 'bg-purple-500/20 text-purple-300 border-purple-500/50',
};

export function NeedZonesPanel({ show, onClose }: NeedZonesPanelProps) {
    const [speciesList, setSpeciesList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnimal, setSelectedAnimal] = useState<string>('');
    const [needZones, setNeedZones] = useState<any[]>([]);
    const [maps, setMaps] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'timeline' | 'clock'>('timeline');
    const [highlightedType, setHighlightedType] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMapId, setSelectedMapId] = useState<string>('');
    const [showScheduleList, setShowScheduleList] = useState(false);

    useEffect(() => {
        const savedView = localStorage.getItem('needZonesViewMode');
        if (savedView && (savedView === 'timeline' || savedView === 'clock')) {
            setViewMode(savedView);
        }
    }, []);

    useEffect(() => {
        async function loadData() {
            try {
                const [speciesData, mapsData] = await Promise.all([
                    getSpecies(),
                    getMaps()
                ]);
                setSpeciesList(speciesData || []);
                setMaps(mapsData || []);
                if (speciesData && speciesData.length > 0) {
                    setSelectedAnimal(speciesData[0].name_ptbr);
                }
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    useEffect(() => {
        if (!selectedAnimal) return;
        async function loadNeedZones() {
            try {
                const zones = await getNeedZones(selectedAnimal);
                setNeedZones(zones || []);
                setSelectedMapId(''); // Don't select any map by default
            } catch (error) {
                console.error('Error loading need zones:', error);
            }
        }
        loadNeedZones();
    }, [selectedAnimal]);

    const filteredSpecies = useMemo(() => {
        if (!searchTerm) return speciesList;
        return speciesList.filter(s =>
            s.name_ptbr.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [speciesList, searchTerm]);

    const groupedZones = useMemo(() => {
        if (!needZones || needZones.length === 0 || !selectedMapId) return [];

        const zonesToGroup = needZones.filter(z => z.map_id === selectedMapId);
        const groups: Record<string, any[]> = {};

        zonesToGroup.forEach((zone: any) => {
            if (!groups[zone.map_id]) {
                groups[zone.map_id] = [];
            }
            groups[zone.map_id].push(zone);
        });

        return Object.entries(groups).map(([mapId, zones]) => ({
            mapId,
            mapName: zones[0]?.map_name || 'Unknown Map',
            zones: zones.map(z => ({
                mapId: z.map_id,
                time: `${z.start_time}-${z.end_time}`,
                type: z.zone_type
            }))
        }));
    }, [needZones, selectedMapId]);

    const animalMaps = useMemo(() => {
        if (!needZones || needZones.length === 0) return [];
        const uniqueMaps = new Map();
        needZones.forEach(zone => {
            if (!uniqueMaps.has(zone.map_id)) {
                uniqueMaps.set(zone.map_id, zone.map_name);
            }
        });
        return Array.from(uniqueMaps.entries()).map(([id, name]) => ({ id, name }));
    }, [needZones]);

    const handleViewModeChange = (mode: 'timeline' | 'clock') => {
        setViewMode(mode);
        localStorage.setItem('needZonesViewMode', mode);
    };

    const toggleHighlight = (type: string) => {
        setHighlightedType(prev => prev === type ? null : type);
    };

    if (!show) return null;

    return (
        <div
            className="fixed inset-0 w-full h-full bg-stone-950 shadow-2xl overflow-y-auto z-50"
            style={{
                transform: show ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s ease-out'
            }}
        >
            {/* Title Bar - Orange like Dashboard */}
            <div className="bg-hunter-orange border-b border-hunter-orange/50 px-3 h-8 flex justify-between items-center cursor-move" style={{ WebkitAppRegion: 'drag' } as any}>
                <h2 className="text-[11px] font-bold text-stone-950 uppercase tracking-wide">
                    Horários de Necessidades
                </h2>
                <button onClick={onClose} className="text-stone-950 hover:text-white p-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <i className="fa-solid fa-times text-sm"></i>
                </button>
            </div>

            <div className="p-3 space-y-2.5">
                {/* Dropdowns Side by Side */}
                <div className="grid grid-cols-2 gap-2">
                    <select
                        value={selectedAnimal}
                        onChange={(e) => setSelectedAnimal(e.target.value)}
                        className="block w-full px-2 py-1.5 text-[11px] bg-stone-800 border border-stone-700 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-white cursor-pointer"
                    >
                        {filteredSpecies.map(s => (
                            <option key={s.name_enus} value={s.name_ptbr}>{s.name_ptbr}</option>
                        ))}
                    </select>

                    <select
                        value={selectedMapId}
                        onChange={(e) => setSelectedMapId(e.target.value)}
                        className="block w-full px-2 py-1.5 text-[11px] bg-stone-800 border border-stone-700 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-white cursor-pointer"
                        disabled={animalMaps.length === 0}
                    >
                        <option value="">Selecione um Mapa</option>
                        {animalMaps.map(map => (
                            <option key={map.id} value={map.id}>{map.name}</option>
                        ))}
                    </select>
                </div>

                {/* Search Below */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-stone-500">
                        <i className="fa-solid fa-search text-[9px]"></i>
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar animal..."
                        className="block w-full pl-7 pr-2 py-1.5 text-[11px] bg-stone-800 border border-stone-700 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-stone-500"
                    />
                </div>

                {/* Filters and View Toggle Side by Side */}
                <div className="flex gap-2">
                    {/* Filters - takes more space */}
                    <div className="flex-1 bg-stone-800/50 p-2 rounded border border-stone-700/50">
                        <div className="flex items-center gap-1.5 mb-1.5 text-[9px] text-stone-500 font-medium uppercase tracking-wider">
                            <i className="fa-solid fa-filter text-[8px]"></i> Filtros
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {['Bebendo', 'Comendo', 'Descansando', 'Coletando'].map((type) => {
                                const isSelected = highlightedType === type;
                                const isDimmed = highlightedType && !isSelected;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => toggleHighlight(type)}
                                        className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border transition-all ${isSelected ? 'bg-stone-700 border-stone-500' : 'bg-transparent border-transparent hover:bg-stone-700/50'} ${isDimmed ? 'opacity-30 grayscale' : ''}`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'scale-125' : ''}`} style={{ backgroundColor: ZONE_COLORS[type] }} />
                                        <span className={isSelected ? 'text-white font-semibold' : 'text-stone-300'}>{ZONE_LABELS[type]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-stone-800 p-0.5 rounded border border-stone-700 self-start">
                        <button
                            onClick={() => handleViewModeChange('timeline')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${viewMode === 'timeline' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-white'}`}
                        >
                            <i className="fa-solid fa-chart-bar text-[9px]"></i> Timeline
                        </button>
                        <button
                            onClick={() => handleViewModeChange('clock')}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${viewMode === 'clock' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-white'}`}
                        >
                            <i className="fa-solid fa-clock text-[9px]"></i> Relógio
                        </button>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="text-center py-12 text-[11px] text-stone-400">Carregando...</div>
                ) : groupedZones.length === 0 ? (
                    <div className="text-center py-12 text-[11px] text-stone-400">
                        {selectedMapId ? 'Nenhum horário encontrado.' : 'Selecione um mapa para ver os horários.'}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {groupedZones.map((schedule) => (
                            <div key={schedule.mapId} className="bg-stone-800/40 border border-stone-700 rounded-lg p-3">
                                <h4 className="text-[11px] font-medium text-green-400 mb-2">{schedule.mapName}</h4>
                                <div className="bg-stone-900/50 rounded border border-stone-800/50 p-1 mb-2">
                                    {viewMode === 'clock' ? (
                                        <ZoneClock zones={schedule.zones} size={280} highlightedType={highlightedType} />
                                    ) : (
                                        <div className="p-2">
                                            <ZoneTimeline zones={schedule.zones} highlightedType={highlightedType} />
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <button
                                        onClick={() => setShowScheduleList(!showScheduleList)}
                                        className="w-full flex items-center justify-between px-2 py-1 bg-stone-800/50 hover:bg-stone-800 border border-stone-700/50 rounded transition-colors text-[10px] font-medium text-stone-300"
                                    >
                                        <span>Detalhes</span>
                                        <i className={`fa-solid fa-chevron-${showScheduleList ? 'up' : 'down'} text-[8px]`}></i>
                                    </button>

                                    {showScheduleList && (
                                        <div className="mt-1.5 space-y-1">
                                            {schedule.zones.map((zone: any, idx: number) => {
                                                const isDimmed = highlightedType && highlightedType !== zone.type;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`flex justify-between items-center p-1 text-[10px] rounded border transition-all ${isDimmed ? 'opacity-20 grayscale border-transparent' : ZONE_BG_CLASSES[zone.type] || 'bg-stone-700/20 text-stone-300 border-stone-600/50'}`}
                                                    >
                                                        <span className="font-medium flex items-center gap-1">
                                                            <i className="fa-solid fa-circle-info text-[8px]"></i>
                                                            {ZONE_LABELS[zone.type] || zone.type}
                                                        </span>
                                                        <span className="font-mono font-bold">{zone.time}h</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
