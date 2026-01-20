
import React, { useState } from 'react';
import { Severity } from '../types.ts';

interface UptimeGraphProps {
  componentId: string;
  days?: number;
}

const UptimeGraph: React.FC<UptimeGraphProps> = ({ componentId, days = 90 }) => {
  const [hoveredDay, setHoveredDay] = useState<{index: number, status: Severity} | null>(null);

  // Mock uptime logic: Higher indices are more recent.
  // In a real app, this would be computed from incident history.
  const history = React.useMemo(() => {
    return Array.from({ length: days }).map((_, i) => {
      // Simulate occasional hiccups
      const rand = Math.random();
      if (rand > 0.98) return Severity.OUTAGE;
      if (rand > 0.95) return Severity.DEGRADED;
      return Severity.OPERATIONAL;
    });
  }, [componentId, days]);

  const getDayColor = (status: Severity) => {
    switch (status) {
      case Severity.OUTAGE: return 'bg-red-500';
      case Severity.DEGRADED: return 'bg-yellow-400';
      default: return 'bg-emerald-500';
    }
  };

  const formatDate = (daysAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="mt-2 relative">
      {/* Custom Tooltip */}
      {hoveredDay && (
        <div 
          className="absolute z-50 bottom-full mb-2 bg-gray-900 text-white text-[10px] px-2 py-1.5 rounded-md shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95 duration-100 flex flex-col items-center"
          style={{ 
            left: `${(hoveredDay.index / (days - 1)) * 100}%`,
            transform: 'translateX(-50%)'
          }}
        >
          <span className="font-bold opacity-70 mb-0.5">{formatDate(days - 1 - hoveredDay.index)}</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${getDayColor(hoveredDay.status)} shadow-[0_0_4px_rgba(0,0,0,0.5)]`}></span>
            <span className="capitalize font-medium">{hoveredDay.status.toLowerCase()}</span>
          </div>
          {/* Tooltip Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}

      <div className="flex gap-[2px] h-8 items-end">
        {history.map((status, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoveredDay({ index: i, status })}
            onMouseLeave={() => setHoveredDay(null)}
            className={`flex-1 h-full rounded-[1px] ${getDayColor(status)} opacity-80 hover:opacity-100 transition-opacity cursor-help`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-medium">
        <span>{days} days ago</span>
        <span className="text-gray-300 mx-1">|</span>
        <span>Today</span>
      </div>
    </div>
  );
};

export default UptimeGraph;
