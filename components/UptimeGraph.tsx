
import React, { useState } from 'react';
import { Severity } from '../types.ts';
import { useApp } from '../store.tsx';

interface UptimeGraphProps {
  componentId: string;
  createdAt?: string;
  days?: number;
}

enum DailyStatus {
  OPERATIONAL = 'OPERATIONAL',
  DEGRADED = 'DEGRADED',
  OUTAGE = 'OUTAGE',
  DATA_MISSING = 'DATA_MISSING'
}

const UptimeGraph: React.FC<UptimeGraphProps> = ({ componentId, createdAt, days = 90 }) => {
  const { state } = useApp();
  const [hoveredDay, setHoveredDay] = useState<{index: number, status: DailyStatus} | null>(null);

  // Filter incidents for this component
  const componentIncidents = React.useMemo(() => {
    return state.incidents.filter(i => i.componentId === componentId);
  }, [state.incidents, componentId]);

  // Compute actual history based on component lifetime and incident logs
  const history = React.useMemo(() => {
    const creationTime = createdAt ? new Date(createdAt).getTime() : 0;
    
    return Array.from({ length: days }).map((_, i) => {
      // Index i=0 is 'days-1' days ago, i=days-1 is today
      const daysAgo = (days - 1) - i;
      const targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const targetTimeStart = targetDate.getTime();
      const targetTimeEnd = targetTimeStart + 24 * 60 * 60 * 1000;

      // Check if component existed on this day
      // We check if targetTimeEnd is before creationTime to mark missing data
      if (targetTimeEnd < creationTime) {
        return DailyStatus.DATA_MISSING;
      }

      // Check for incidents overlapping this day
      const dayIncidents = componentIncidents.filter(inc => {
        const incStart = new Date(inc.startTime).getTime();
        const incEnd = inc.endTime ? new Date(inc.endTime).getTime() : Date.now();
        
        // Incident overlaps if it starts before end of day AND ends after start of day
        return incStart < targetTimeEnd && incEnd > targetTimeStart;
      });

      if (dayIncidents.some(inc => inc.severity === Severity.OUTAGE)) return DailyStatus.OUTAGE;
      if (dayIncidents.some(inc => inc.severity === Severity.DEGRADED)) return DailyStatus.DEGRADED;
      
      return DailyStatus.OPERATIONAL;
    });
  }, [componentIncidents, createdAt, days]);

  const getDayColor = (status: DailyStatus) => {
    switch (status) {
      case DailyStatus.OUTAGE: return 'bg-red-500';
      case DailyStatus.DEGRADED: return 'bg-yellow-400';
      case DailyStatus.DATA_MISSING: return 'bg-gray-200';
      default: return 'bg-emerald-500';
    }
  };

  const getStatusLabel = (status: DailyStatus) => {
    switch (status) {
      case DailyStatus.OUTAGE: return 'Major Outage';
      case DailyStatus.DEGRADED: return 'Partial Degradation';
      case DailyStatus.DATA_MISSING: return 'No data';
      default: return 'Operational';
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
            <span className="capitalize font-medium">{getStatusLabel(hoveredDay.status)}</span>
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
