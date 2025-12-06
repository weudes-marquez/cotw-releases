import React from 'react';

interface NeedZone {
    time: string; // Format: "04:00-08:00"
    type: string; // "Eating", "Drinking", "Resting"
}

interface NeedZoneTimelineProps {
    zones: NeedZone[];
}

export const NeedZoneTimeline: React.FC<NeedZoneTimelineProps> = ({ zones }) => {
    // Helper to parse time string "HH:MM" to percentage of day (0-100)
    const timeToPercent = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return ((hours * 60 + minutes) / (24 * 60)) * 100;
    };

    // Helper to get color based on type
    const getTypeColor = (type: string) => {
        const lowerType = type.toLowerCase();
        if (lowerType.includes('eat') || lowerType.includes('com')) return 'bg-green-500';
        if (lowerType.includes('drink') || lowerType.includes('beb')) return 'bg-blue-500';
        if (lowerType.includes('rest') || lowerType.includes('desc')) return 'bg-orange-500';
        return 'bg-purple-500'; // Default/Collecting
    };

    const getTypeLabel = (type: string) => {
        const lowerType = type.toLowerCase();
        if (lowerType.includes('eat') || lowerType.includes('com')) return 'Comendo';
        if (lowerType.includes('drink') || lowerType.includes('beb')) return 'Bebendo';
        if (lowerType.includes('rest') || lowerType.includes('desc')) return 'Descansando';
        return type;
    };

    return (
        <div className="w-full py-2">
            {/* Timeline Bar */}
            <div className="relative h-8 bg-stone-800 rounded-sm w-full flex items-center overflow-hidden border border-stone-700">
                {/* Hour Markers (every 4 hours) */}
                {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
                    <div
                        key={hour}
                        className="absolute h-full border-l border-stone-600/30 text-[9px] text-stone-500 pl-0.5 pt-0.5"
                        style={{ left: `${(hour / 24) * 100}%` }}
                    >
                        {hour === 24 ? '00' : hour.toString().padStart(2, '0')}
                    </div>
                ))}

                {/* Zones */}
                {zones.map((zone, index) => {
                    const [startStr, endStr] = zone.time.split('-');
                    const startPercent = timeToPercent(startStr);
                    let endPercent = timeToPercent(endStr);

                    // Handle crossing midnight (e.g., 22:00-02:00)
                    // For simplicity in this version, we might split it or just clamp.
                    // If end < start, it means it crosses midnight.
                    // We'll render it as two blocks if needed, or just one if it's simple.

                    let width = endPercent - startPercent;
                    if (width < 0) {
                        // Crosses midnight: Draw from start to 100%
                        width = 100 - startPercent;
                        // Ideally we'd draw another block from 0 to endPercent, but let's keep it simple first
                    }

                    return (
                        <div
                            key={index}
                            className={`absolute h-full ${getTypeColor(zone.type)} opacity-80 hover:opacity-100 transition-opacity cursor-help group`}
                            style={{
                                left: `${startPercent}%`,
                                width: `${width}%`
                            }}
                        >
                            {/* Tooltip */}
                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap z-50 border border-white/20">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${getTypeColor(zone.type)}`}></span>
                                    <span className="font-bold">{zone.time}</span>
                                    <span className="text-stone-300">| {getTypeLabel(zone.type)}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend/Details below */}
            <div className="mt-1 flex flex-wrap gap-2">
                {zones.map((zone, index) => (
                    <div key={index} className="flex items-center gap-1.5 text-[10px] bg-stone-800/50 px-1.5 py-0.5 rounded border border-stone-700/50">
                        <div className={`w-1.5 h-1.5 rounded-full ${getTypeColor(zone.type)}`}></div>
                        <span className="text-stone-300 font-mono">{zone.time}</span>
                        <span className="text-stone-400 uppercase tracking-wide">{getTypeLabel(zone.type)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
