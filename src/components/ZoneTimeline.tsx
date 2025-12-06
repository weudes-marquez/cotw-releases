interface Zone {
    mapId: string;
    time: string;
    type: string;
    map_name?: string;
}

interface ZoneTimelineProps {
    zones: Zone[];
    highlightedType: string | null;
}

const ZONE_COLORS: Record<string, string> = {
    'Bebendo': '#3b82f6',      // Azul
    'Comendo': '#f97316',      // Laranja
    'Descansando': '#22c55e',  // Verde
    'Coletando': '#a855f7',    // Roxo
    // English fallbacks
    'Drinking': '#3b82f6',
    'Eating': '#f97316',
    'Resting': '#22c55e',
    'Gathering': '#a855f7',
};

const ZONE_LABELS: Record<string, string> = {
    'Bebendo': 'Bebendo',
    'Comendo': 'Comendo',
    'Descansando': 'Descansando',
    'Coletando': 'Coletando',
    // English translations
    'Drinking': 'Bebendo',
    'Eating': 'Comendo',
    'Resting': 'Descansando',
    'Gathering': 'Coletando',
};

export function ZoneTimeline({ zones, highlightedType }: ZoneTimelineProps) {
    const getHourData = (hour: number) => {
        const activeZone = zones.find(z => {
            const parts = z.time.split('-').map(p => parseInt(p.trim(), 10));
            let start = parts[0];
            let end = parts[1];
            if (end < start) return hour >= start || hour < end;
            return hour >= start && hour < end;
        });
        return activeZone ? {
            color: ZONE_COLORS[activeZone.type] || '#gray',
            label: ZONE_LABELS[activeZone.type] || activeZone.type,
            time: activeZone.time,
            type: activeZone.type
        } : null;
    };

    const renderRow = (startHour: number, endHour: number, label: string) => {
        const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

        return (
            <div className="mb-6 last:mb-0">
                <div className="flex justify-between items-end mb-1 px-1">
                    <span className="text-xs font-semibold text-stone-400">{label}</span>
                </div>
                <div className="flex justify-between px-px mb-1">
                    {hours.map(h => (
                        <div key={h} className="w-full relative h-3 border-l border-stone-700/50">
                            <span className={`absolute -top-1 -left-1.5 text-[10px] font-mono transition-colors ${highlightedType ? 'text-stone-700' : 'text-stone-500'}`}>
                                {h}
                            </span>
                        </div>
                    ))}
                    <div className="w-0 relative h-3 border-l border-stone-700/50">
                        <span className={`absolute -top-1 -left-1.5 text-[10px] font-mono transition-colors ${highlightedType ? 'text-stone-700' : 'text-stone-500'}`}>
                            {endHour === 24 ? '00' : endHour}
                        </span>
                    </div>
                </div>
                <div className="flex h-12 rounded-lg overflow-hidden border border-stone-700 bg-stone-900/80 shadow-inner">
                    {hours.map(hour => {
                        const data = getHourData(hour);
                        let cellClass = "flex-1 border-r border-stone-800/50 last:border-r-0 relative group transition-all duration-300";
                        if (data) {
                            if (highlightedType && highlightedType !== data.type) {
                                cellClass += " opacity-20 grayscale filter";
                            } else if (highlightedType && highlightedType === data.type) {
                                cellClass += " brightness-110 z-10 ring-1 ring-inset ring-white/20";
                            } else {
                                cellClass += " hover:brightness-110";
                            }
                        }
                        return (
                            <div key={hour} className={cellClass} style={{ backgroundColor: data ? data.color : 'transparent' }}>
                                {data && (!highlightedType || highlightedType === data.type) && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 w-max pointer-events-none">
                                        <div className="bg-stone-800 text-white text-xs rounded px-2 py-1 shadow-lg border border-stone-600">
                                            <div className="font-bold text-center border-b border-stone-700 pb-1 mb-1">{data.label}</div>
                                            <div className="text-center font-mono">{data.time}h</div>
                                        </div>
                                        <div className="w-2 h-2 bg-stone-800 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 border-b border-r border-stone-600"></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full py-2">
            {renderRow(0, 12, 'Manhã (00h - 12h)')}
            {renderRow(12, 24, 'Tarde/Noite (12h - 00h)')}
        </div>
    );
}
