
import React, { useState } from 'react';
import { useApp } from '../store.tsx';
import { Severity, Incident } from '../types.ts';
import UptimeGraph from './UptimeGraph.tsx';

const PublicDashboard: React.FC = () => {
  const { state, calculateSLA, subscribe, unsubscribe } = useApp();
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Invalid Date';
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const adjustedDate = new Date(utc + (state.timezoneOffset * 60000));
      return adjustedDate.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Error Parsing Date';
    }
  };

  const formatSimpleDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const adjustedDate = new Date(utc + (state.timezoneOffset * 60000));
    return adjustedDate.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleSubscribe = async (e: React.FormEvent, isUnsubscribe = false) => {
    e.preventDefault();
    if (!email) return;
    setSubStatus('loading');
    setErrorMessage('');
    try {
      if (isUnsubscribe) {
        await unsubscribe(email);
        setSubStatus('success');
        setErrorMessage('You have been successfully unsubscribed.');
      } else {
        await subscribe(email);
        setSubStatus('success');
      }
      setEmail('');
    } catch (err: any) {
      setSubStatus('error');
      setErrorMessage(err.message || 'Subscription failed.');
    }
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
  }, [state, state.incidents, state.components]);

  const pastIncidentsByDate = React.useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const filtered = state.incidents
      .filter(i => new Date(i.startTime) >= ninetyDaysAgo)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    const groups: { [date: string]: Incident[] } = {};
    filtered.forEach(inc => {
      const dateKey = formatSimpleDate(inc.startTime);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(inc);
    });

    return groups;
  }, [state.incidents, state.timezoneOffset]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className={`${globalStatus.color} rounded-xl p-8 text-white shadow-lg mb-8 transition-all duration-500`}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{globalStatus.label}</h1>
            <p className="opacity-90">{globalStatus.sub}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/20 w-full md:w-auto">
            <h3 className="text-sm font-bold mb-2 uppercase tracking-tighter">Get Status Updates</h3>
            <form onSubmit={(e) => handleSubscribe(e)} className="flex flex-col gap-2">
              <div className="flex bg-white rounded-lg overflow-hidden border border-white/30">
                <input 
                  type="email" 
                  required
                  placeholder="email@example.com" 
                  className="px-3 py-2 text-gray-900 text-xs outline-none w-full"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <button 
                  disabled={subStatus === 'loading'}
                  className="bg-indigo-600 px-4 py-2 text-xs font-bold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
                >
                  {subStatus === 'loading' ? '...' : 'Subscribe'}
                </button>
              </div>
              <div className="flex justify-between items-center px-1">
                <button 
                  type="button"
                  onClick={(e) => handleSubscribe(e as any, true)}
                  className="text-[9px] font-bold uppercase hover:underline opacity-80"
                >
                  Unsubscribe
                </button>
                {subStatus === 'success' && <span className="text-[10px] font-bold text-emerald-300">Done!</span>}
                {subStatus === 'error' && <span className="text-[10px] font-bold text-red-300 truncate max-w-[150px]">{errorMessage}</span>}
              </div>
            </form>
          </div>
        </div>
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

      {/* Current System Status */}
      <div className="space-y-12 mb-16">
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

      {/* Past Incidents Section */}
      <div className="mt-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 border-b pb-4">Incident History (Past 90 Days)</h2>
        
        {Object.keys(pastIncidentsByDate).length > 0 ? (
          <div className="space-y-10">
            {Object.entries(pastIncidentsByDate).map(([date, incidents]) => (
              <div key={date}>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{date}</h3>
                <div className="space-y-4">
                  {incidents.map(incident => {
                    const comp = state.components.find(c => c.id === incident.componentId);
                    return (
                      <div key={incident.id} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-gray-800">{incident.title}</h4>
                            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-tight">Component: {comp?.name || 'Unknown'}</p>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            incident.severity === Severity.OUTAGE ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                          }`}>
                            {incident.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">{incident.description}</p>
                        <div className="flex gap-4 text-[10px] font-medium text-gray-400 border-t pt-3">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                            Started: {formatDate(incident.startTime)}
                          </span>
                          {incident.endTime ? (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                              Resolved: {formatDate(incident.endTime)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                              Ongoing
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No incidents reported</h3>
            <p className="text-gray-500 text-sm">All systems were operational during the past 90 days.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicDashboard;
