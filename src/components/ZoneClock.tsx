interface Zone {
    mapId: string;
    time: string;
    type: string;
    map_name?: string;
}

interface ZoneClockProps {
    zones: Zone[];
    size?: number;
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

export function ZoneClock({ zones, size = 300, highlightedType }: ZoneClockProps) {
    const center = size / 2;
    const radius = (size / 2) - 40;
    const innerRadius = radius - 40;

    const parseTime = (timeStr: string) => {
        const parts = timeStr.split('-').map(p => parseInt(p.trim(), 10));
        return { start: parts[0], end: parts[1] };
    };

    const createArc = (startHour: number, endHour: number, color: string, index: number, type: string) => {
        if (endHour < startHour) {
            return (
                <g key={`split-${index}`}>
                    {createArcPath(startHour, 24, color, index + 'a', type)}
                    {createArcPath(0, endHour, color, index + 'b', type)}
                </g>
            );
        }
        return createArcPath(startHour, endHour, color, index, type);
    };

    const createArcPath = (startHour: number, endHour: number, color: string, key: string | number, type: string) => {
        // Add small gap between arcs (1 degree total = 0.5 on each side)
        const gapDegrees = 0.5;
        const startAngle = (startHour / 24) * 360 + gapDegrees;
        const endAngle = (endHour / 24) * 360 - gapDegrees;
        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);
        const x3 = center + innerRadius * Math.cos(endRad);
        const y3 = center + innerRadius * Math.sin(endRad);
        const x4 = center + innerRadius * Math.cos(startRad);
        const y4 = center + innerRadius * Math.sin(startRad);

        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

        let opacityClass = "opacity-80 hover:opacity-100";
        let strokeColor = "#111827";
        let strokeWidth = "2";

        if (highlightedType) {
            if (highlightedType === type) {
                opacityClass = "opacity-100 brightness-110";
                strokeColor = "#fff";
                strokeWidth = "1";
            } else {
                opacityClass = "opacity-10 grayscale";
            }
        }

        return (
            <path
                key={key}
                d={d}
                fill={color}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                className={`transition-all duration-300 ${opacityClass}`}
            >
                <title>{`${startHour}h - ${endHour}h`}</title>
            </path>
        );
    };

    const renderMarkers = () => {
        const markers = [];
        for (let i = 0; i < 24; i++) {
            // Show all hours instead of every 2 hours
            const angle = (i / 24) * 360;
            const rad = (angle - 90) * (Math.PI / 180);
            const textRadius = radius + 20;
            const x = center + textRadius * Math.cos(rad);
            const y = center + textRadius * Math.sin(rad);

            const lineInnerX = center + innerRadius * Math.cos(rad);
            const lineInnerY = center + innerRadius * Math.sin(rad);
            const lineOuterX = center + radius * Math.cos(rad);
            const lineOuterY = center + radius * Math.sin(rad);

            markers.push(
                <g key={i}>
                    <text
                        x={x} y={y}
                        textAnchor="middle" dominantBaseline="middle"
                        className={`fill-stone-400 text-[9px] font-semibold transition-opacity duration-300 ${highlightedType ? 'opacity-40' : 'opacity-100'}`}
                    >
                        {i}
                    </text>
                    <line
                        x1={lineInnerX} y1={lineInnerY} x2={lineOuterX} y2={lineOuterY}
                        stroke="#374151" strokeWidth="1" opacity="0.3"
                    />
                </g>
            );
        }
        return markers;
    };

    return (
        <div className="flex justify-center items-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={center} cy={center} r={radius} fill="#1f2937" stroke="#374151" strokeWidth="1" />
                <circle cx={center} cy={center} r={innerRadius} fill="#111827" stroke="#374151" strokeWidth="1" />
                {zones.map((zone, idx) => {
                    const { start, end } = parseTime(zone.time);
                    return createArc(start, end, ZONE_COLORS[zone.type] || '#gray', idx, zone.type);
                })}
                {renderMarkers()}
                <text x={center} y={center} textAnchor="middle" dominantBaseline="middle" className="fill-white text-sm font-bold opacity-50">24h</text>
            </svg>
        </div>
    );
}
