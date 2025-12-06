import React, { useState, useEffect, useMemo } from 'react';
import { getMaps, getNeedZones, getSpecies } from '../supabase_integration';
import { NeedZoneTimeline } from './NeedZoneTimeline';

interface NeedZonesModalProps {
    show: boolean;
    onClose: () => void;
}

interface MapData {
    id: string;
    name: string;
}

interface NeedZone {
    mapId: string;
    time: string;
    type: string;
}

interface SpeciesData {
    id: string; // Name of the animal
    needZones: NeedZone[];
}

export const NeedZonesModal: React.FC<NeedZonesModalProps> = ({ show, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [maps, setMaps] = useState<Record<string, string>>({});
    const [allSpecies, setAllSpecies] = useState<SpeciesData[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSpecies, setSelectedSpecies] = useState<SpeciesData | null>(null);

    // Fetch initial data (Maps and Species List)
    useEffect(() => {
        if (show && Object.keys(maps).length === 0) {
            fetchData();
        }
    }, [show]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Maps from Supabase
            const mapsData = await getMaps();
            const mapsMap: Record<string, string> = {};
            mapsData.forEach(m => {
                mapsMap[m.id] = m.name;
            });
            setMaps(mapsMap);

            // 2. Fetch Species List from Supabase
            // We can use the existing getSpecies function which returns { id, name_enus, name_ptbr }
            // For the search to work with the migration logic (which used species names as IDs),
            // we'll adapt the data structure.
            const speciesData = await getSpecies();

            // Transform to match the expected format for the search component
            // The modal expects { id: "Animal Name", needZones: [] } initially
            // We'll fetch need zones on demand when selected to save bandwidth, 
            // or fetch all if dataset is small. For now, let's just list species.
            const speciesList: SpeciesData[] = speciesData.map((s: any) => ({
                id: s.name_enus, // Using English name as ID to match migration/display
                needZones: [] // Will fetch on select
            }));

            setAllSpecies(speciesList);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter species based on search
    const filteredSpecies = useMemo(() => {
        if (!searchTerm) return [];
        return allSpecies.filter(s =>
            s.id.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 5); // Limit suggestions
    }, [searchTerm, allSpecies]);

    // Fetch zones when a species is selected
    useEffect(() => {
        if (selectedSpecies) {
            const loadZones = async () => {
                try {
                    const zones = await getNeedZones(selectedSpecies.id);

                    // Transform Supabase data to component format
                    const formattedZones: NeedZone[] = zones.map(z => ({
                        mapId: z.map_id,
                        time: z.start_time === z.end_time ? z.start_time : `${z.start_time} - ${z.end_time}`, // Handle format
                        type: z.zone_type
                    }));

                    // Update the selected species with fetched zones
                    setSelectedSpecies(prev => prev ? { ...prev, needZones: formattedZones } : null);
                } catch (err) {
                    console.error('Error loading zones:', err);
                }
            };
            loadZones();
        }
    }, [selectedSpecies?.id]);

    // Group zones by map for the selected species
    const zonesByMap = useMemo(() => {
        if (!selectedSpecies || !selectedSpecies.needZones) return {};

        const grouped: Record<string, NeedZone[]> = {};

        selectedSpecies.needZones.forEach(zone => {
            // Try to find map name by ID, or use the ID itself if name not found
            const mapName = maps[zone.mapId] || 'Unknown Map';
            if (!grouped[mapName]) {
                grouped[mapName] = [];
            }
            grouped[mapName].push(zone);
        });

        return grouped;
    }, [selectedSpecies, maps]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-stone-700 flex justify-between items-center bg-stone-950">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-hunter-orange/20 flex items-center justify-center text-hunter-orange">
                            <i className="fa-regular fa-clock"></i>
                        </div>
                        <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                            Need Zones Finder
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-stone-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Search Area */}
                <div className="p-4 bg-stone-900 border-b border-stone-800">
                    <div className="relative">
                        <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"></i>
                        <input
                            type="text"
                            placeholder="Search for an animal (e.g., Moose, Red Deer)..."
                            className="w-full bg-stone-950 border border-stone-700 rounded p-2 pl-10 text-white focus:border-hunter-orange focus:outline-none transition-colors uppercase text-sm tracking-wide"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (!e.target.value) setSelectedSpecies(null);
                            }}
                        />

                        {/* Suggestions Dropdown */}
                        {searchTerm && !selectedSpecies && filteredSpecies.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded shadow-xl z-50 max-h-60 overflow-y-auto">
                                {filteredSpecies.map(species => (
                                    <button
                                        key={species.id}
                                        className="w-full text-left p-3 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors border-b border-stone-700/50 last:border-0 flex items-center justify-between group"
                                        onClick={() => {
                                            setSelectedSpecies(species);
                                            setSearchTerm(species.id);
                                        }}
                                    >
                                        <span className="font-bold uppercase">{species.id}</span>
                                        <i className="fa-solid fa-chevron-right text-stone-600 group-hover:text-hunter-orange text-xs"></i>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-stone-900">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-stone-500 gap-3">
                            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-hunter-orange"></i>
                            <span className="text-xs uppercase tracking-widest">Loading Database...</span>
                        </div>
                    ) : selectedSpecies ? (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-2xl font-bold text-hunter-orange uppercase tracking-widest border-b-2 border-hunter-orange/30 pb-1 pr-4">
                                    {selectedSpecies.id}
                                </h3>
                                <span className="text-xs text-stone-500 uppercase bg-stone-950 px-2 py-1 rounded border border-stone-800">
                                    {Object.keys(zonesByMap).length} Maps Found
                                </span>
                            </div>

                            {Object.entries(zonesByMap).map(([mapName, zones]) => (
                                <div key={mapName} className="bg-stone-950/50 rounded-lg p-4 border border-stone-800 hover:border-stone-700 transition-colors">
                                    <div className="flex items-center gap-2 mb-3">
                                        <i className="fa-solid fa-map text-stone-400"></i>
                                        <h4 className="text-stone-200 font-bold uppercase tracking-wide text-sm">
                                            {mapName}
                                        </h4>
                                    </div>

                                    <NeedZoneTimeline zones={zones} />
                                </div>
                            ))}

                            {Object.keys(zonesByMap).length === 0 && (
                                <div className="text-center p-8 text-stone-500 border border-dashed border-stone-800 rounded">
                                    <i className="fa-regular fa-circle-question text-2xl mb-2"></i>
                                    <p>No need zones data available for this species.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-stone-600 opacity-50">
                            <i className="fa-solid fa-paw text-6xl mb-4"></i>
                            <p className="uppercase tracking-widest text-sm">Select an animal to view schedule</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
