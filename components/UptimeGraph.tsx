
import React from 'react';
import { Severity } from '../types.ts';

interface UptimeGraphProps {
  componentId: string;
  days?: number;
}

const UptimeGraph: React.FC<UptimeGraphProps> = ({ componentId, days = 90 }) => {
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

  return (
    <div className="mt-2 group relative">
      <div className="flex gap-[2px] h-8 items-end">
        {history.map((status, i) => (
          <div
            key={i}
            className={`flex-1 h-full rounded-[1px] ${getDayColor(status)} opacity-80 hover:opacity-100 transition-opacity cursor-help`}
            title={`Day ${days - i}: ${status.toLowerCase()}`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-medium">
        <span>{days} days ago</span>
        <span className="text-gray-300">|</span>
        <span>Today</span>
      </div>
    </div>
  );
};

export default UptimeGraph;
