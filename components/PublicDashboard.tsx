
import React from 'react';
import { useApp } from '../store.tsx';
import { Severity } from '../types.ts';
import UptimeGraph from './UptimeGraph.tsx';

const PublicDashboard: React.FC = () => {
  const { state, calculateSLA } = useApp();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const adjustedDate = new Date(utc + (state.timezoneOffset * 60000));
    return adjustedDate.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getComponentStatus = (componentId: string) => {
    const activeIncidents = state.incidents.filter(i => i.componentId === componentId && !i.endTime);
    if (activeIncidents.find(i => i.severity === Severity.OUTAGE)) return Severity.OUTAGE;
    if (activeIncidents.find(i => i.severity === Severity.DEGRADED)) return Severity.DEGRADED;
    return Severity.OPERATIONAL;
  };

  const getServiceStatus = (serviceId: string) => {
    const componentIds = state.components.filter(c => c.serviceId === serviceId).map(c => c.id);
    if (componentIds.length === 0) return Severity.OPERATIONAL;
    const statuses = componentIds.map(getComponentStatus);
    if (statuses.includes(Severity.OUTAGE)) return Severity.OUTAGE;
    if (statuses.includes(Severity.DEGRADED)) return Severity.DEGRADED;
    return Severity.OPERATIONAL;
  };

  const globalStatus = React.useMemo(() => {
    if (state.components.length === 0) return { label: 'System Initializing', color: 'bg-indigo-500', sub: 'Monitoring is starting up...' };
    const statuses = state.components.map(c => getComponentStatus(c.id));
    if (statuses.includes(Severity.OUTAGE)) return { label: 'System Outage', color: 'bg-red-600', sub: 'Major disruptions are occurring' };
    if (statuses.includes(Severity.DEGRADED)) return { label: 'Partial Degradation', color: 'bg-yellow-500', sub: 'Some services are experiencing issues' };
    return { label: 'All Systems Operational', color: 'bg-emerald-500', sub: 'Services are running optimally' };
  }, [state]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className={`${globalStatus.color} rounded-xl p-8 text-white shadow-lg mb-12 transition-all duration-500`}>
        <h1 className="text-3xl font-bold mb-2">{globalStatus.label}</h1>
        <p className="opacity-90">{globalStatus.sub}</p>
      </div>

      {state.incidents.filter(i => !i.endTime).length > 0 && (
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Active Incidents
          </h2>
          <div className="space-y-4">
            {state.incidents.filter(i => !i.endTime).map(incident => (
              <div key={incident.id} className="bg-white border-l-4 border-red-500 rounded-lg p-6 shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{incident.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    incident.severity === Severity.OUTAGE ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {incident.severity}
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{incident.description}</p>
                <div className="text-xs text-gray-400">
                  Detected: {formatDate(incident.startTime)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-12">
        {state.regions.map(region => (
          <div key={region.id}>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6 border-b pb-2">{region.name}</h2>
            <div className="space-y-8">
              {state.services.filter(s => s.regionId === region.id).map(service => {
                const serviceStatus = getServiceStatus(service.id);
                return (
                  <div key={service.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-gray-50 flex justify-between items-center border-b border-gray-100">
                      <div>
                        <h3 className="font-bold text-gray-700">{service.name}</h3>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">{service.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase ${
                          serviceStatus === Severity.OPERATIONAL ? 'text-emerald-500' :
                          serviceStatus === Severity.DEGRADED ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {serviceStatus}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${
                          serviceStatus === Severity.OPERATIONAL ? 'bg-emerald-500' :
                          serviceStatus === Severity.DEGRADED ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {state.components.filter(c => c.serviceId === service.id).map(comp => {
                        const compStatus = getComponentStatus(comp.id);
                        const sla = calculateSLA(comp.id);
                        return (
                          <div key={comp.id} className="p-6 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-center mb-3">
                              <div>
                                <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                                  {comp.name}
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sla < 99.9 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                    90D SLA: {sla}%
                                  </span>
                                </h4>
                                <p className="text-[10px] text-gray-400">{comp.description}</p>
                              </div>
                              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                compStatus === Severity.OPERATIONAL ? 'bg-emerald-50 text-emerald-600' :
                                compStatus === Severity.DEGRADED ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                              }`}>
                                {compStatus}
                              </div>
                            </div>
                            <UptimeGraph componentId={comp.id} createdAt={comp.createdAt} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PublicDashboard;
