
import React, { useState } from 'react';
import { useApp } from '../store';
import { Severity, Incident } from '../types';
import UptimeGraph from './UptimeGraph';

const PublicDashboard: React.FC = () => {
  const { state, calculateSLA, addSubscriber: subscribe, removeSubscriber: unsubscribe } = useApp();
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
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return 'Error Parsing Date'; }
  };

  const formatSimpleDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const adjustedDate = new Date(utc + (state.timezoneOffset * 60000));
    return adjustedDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubStatus('loading');
    setErrorMessage('');
    try {
      await subscribe(email);
      setSubStatus('success');
      setEmail('');
    } catch (err: any) {
      setSubStatus('error');
      setErrorMessage(err.message || 'Subscription failed.');
    }
  };

  const [expandedRegions, setExpandedRegions] = useState<string[]>([]);

  const toggleRegion = (regionId: string) => {
    setExpandedRegions(prev => 
      prev.includes(regionId) ? prev.filter(id => id !== regionId) : [...prev, regionId]
    );
  };

  const RegionSubscribe: React.FC<{ regionId: string; regionName: string }> = ({ regionId, regionName }) => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) return;
      setStatus('loading');
      setError('');
      try {
        await subscribe(email, regionId);
        setStatus('success');
        setEmail('');
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Failed to subscribe');
      }
    };

    if (status === 'success') {
      return (
        <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full">
          Subscribed to {regionName} updates!
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input 
          type="email" 
          required
          placeholder="Email for updates" 
          className="px-2 py-1 text-[10px] border border-gray-200 rounded outline-none focus:border-indigo-300 transition-colors w-40"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button 
          disabled={status === 'loading'}
          className="bg-indigo-600 text-white px-3 py-1 text-[10px] font-bold rounded hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
        >
          {status === 'loading' ? '...' : 'Subscribe'}
        </button>
        {status === 'error' && <span className="text-[9px] text-red-500 font-bold">{error}</span>}
      </form>
    );
  };

  const getComponentStatus = (componentId: string) => {
    if (!state.incidents) return Severity.OPERATIONAL;
    const activeIncidents = state.incidents.filter(i => 
      !i.endTime && 
      (i.componentIds || []).some(cid => String(cid) === String(componentId))
    );
    
    if (activeIncidents.some(i => String(i.severity).toUpperCase() === Severity.OUTAGE)) return Severity.OUTAGE;
    if (activeIncidents.some(i => String(i.severity).toUpperCase() === Severity.DEGRADED)) return Severity.DEGRADED;
    return Severity.OPERATIONAL;
  };

  const getRegionStatus = (regionComponents: any[]) => {
    if (!regionComponents || regionComponents.length === 0) return Severity.OPERATIONAL;
    const statuses = regionComponents.map(c => getComponentStatus(c.id));
    if (statuses.includes(Severity.OUTAGE)) return Severity.OUTAGE;
    if (statuses.includes(Severity.DEGRADED)) return Severity.DEGRADED;
    return Severity.OPERATIONAL;
  };

  const regionsWithComponents = React.useMemo(() => {
    return [...(state.regions || [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(region => ({
        ...region,
        components: [...(state.components || [])]
          .filter(c => c.regionId === region.id)
          .sort((a, b) => a.name.localeCompare(b.name))
      })).filter(r => r.components.length > 0);
  }, [state.regions, state.components]);

  const globalStatus = React.useMemo(() => {
    const activeIncidents = (state.incidents || []).filter(i => !i.endTime);
    
    if (activeIncidents.length === 0) {
      if ((state.components || []).length === 0) return { label: 'System Initializing', color: 'bg-indigo-500', sub: 'Monitoring is starting up...' };
      return { label: 'All Systems Operational', color: 'bg-emerald-500', sub: 'Services are running optimally' };
    }

    const hasOutage = activeIncidents.some(i => i.severity === Severity.OUTAGE);
    const hasDegradation = activeIncidents.some(i => i.severity === Severity.DEGRADED);

    if (hasOutage) return { label: 'System Outage', color: 'bg-red-600', sub: 'Major disruptions are occurring' };
    if (hasDegradation) return { label: 'Partial Degradation', color: 'bg-yellow-500', sub: 'Some services are experiencing issues' };
    
    return { label: 'All Systems Operational', color: 'bg-emerald-500', sub: 'Services are running optimally' };
  }, [state.components, state.incidents]);

  const pastIncidentsByDate = React.useMemo(() => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const filtered = (state.incidents || [])
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
        </div>
      </div>

      {(state.incidents || []).filter(i => !i.endTime).length > 0 && (
        <div className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Active Incidents
          </h2>
          <div className="space-y-4">
            {(state.incidents || []).filter(i => !i.endTime).map(incident => (
              <div key={incident.id} className="bg-white border-l-4 border-red-500 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{incident.title}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    incident.severity === Severity.OUTAGE ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {incident.severity}
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{incident.description}</p>
                <div className="text-xs text-gray-400">Detected: {formatDate(incident.startTime)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-12 mb-16">
        {regionsWithComponents.length === 0 ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl h-48 border border-gray-100"></div>
            ))}
          </div>
        ) : (
          regionsWithComponents.map(region => {
            const isExpanded = expandedRegions.includes(region.id);
            const regionStatus = getRegionStatus(region.components);
            return (
              <div key={region.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" role="region" aria-labelledby={`region-${region.id}`}>
                 <button 
                   onClick={() => toggleRegion(region.id)}
                   className="w-full p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center hover:bg-gray-100 transition-colors"
                 >
                    <div className="flex items-center gap-3">
                       <h2 id={`region-${region.id}`} className="text-sm font-black text-gray-900 uppercase tracking-widest">{region.name}</h2>
                       <span className="text-[10px] text-gray-400 font-bold">({region.components.length} components)</span>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            regionStatus === Severity.OPERATIONAL ? 'bg-emerald-500' :
                            regionStatus === Severity.DEGRADED ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          <span className={`text-[10px] font-bold uppercase ${
                            regionStatus === Severity.OPERATIONAL ? 'text-gray-400' :
                            regionStatus === Severity.DEGRADED ? 'text-yellow-600' : 'text-red-600'
                          }`}>{regionStatus}</span>
                       </div>
                       <svg className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                       </svg>
                    </div>
                 </button>
                 {isExpanded && (
                   <div className="divide-y divide-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">
                     <div className="p-4 bg-gray-50/30 flex justify-between items-center border-b border-gray-50">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Subscribe to {region.name} updates</span>
                        <RegionSubscribe regionId={region.id} regionName={region.name} />
                     </div>
                     {region.components.map(comp => {
                        const compStatus = getComponentStatus(comp.id);
                        const sla = calculateSLA(comp.id);
                        return (
                          <div key={comp.id} className="p-6 hover:bg-gray-50/50 transition-colors" aria-label={`Component ${comp.name} status: ${compStatus}`}>
                             <div className="flex justify-between items-center mb-3">
                                <div>
                                   <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                      {comp.name}
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sla < 99.9 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                         90D SLA: {sla}%
                                      </span>
                                   </h4>
                                   <p className="text-[10px] text-gray-400 mt-0.5">{comp.description}</p>
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
                 )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-20">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 border-b pb-4">Incident History</h2>
        {Object.keys(pastIncidentsByDate).length > 0 ? (
          <div className="space-y-10">
            {Object.entries(pastIncidentsByDate).map(([date, incidents]) => (
              <div key={date}>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{date}</h3>
                <div className="space-y-4">
                  {incidents.map(incident => {
                    const affectedComponents = (state.components || []).filter(c => (incident.componentIds || []).includes(c.id));
                    const uniqueRegions = Array.from(new Set(affectedComponents.map(c => c.regionId)))
                      .map(rid => (state.regions || []).find(r => r.id === rid))
                      .filter(Boolean);

                    return (
                      <div key={incident.id} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-gray-800">{incident.title}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {affectedComponents.map(comp => (
                                <span key={comp.id} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold uppercase rounded">
                                  {comp.name}
                                </span>
                              ))}
                              {uniqueRegions.length > 0 && (
                                <>
                                  <span className="text-gray-300 mx-1">•</span>
                                  <span className="text-[10px] text-gray-500 font-bold uppercase">
                                    {uniqueRegions.map(r => r?.name).join(', ')}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            incident.severity === Severity.OUTAGE ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                          }`}>
                            {incident.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">{incident.description}</p>
                        <div className="flex gap-4 text-[10px] font-medium text-gray-400 border-t pt-3">
                          <span>Started: {formatDate(incident.startTime)}</span>
                          {incident.endTime ? <span>Resolved: {formatDate(incident.endTime)}</span> : <span className="text-red-500 font-bold">Ongoing</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center text-gray-500 italic">No historical incidents recorded.</div>
        )}
      </div>
    </div>
  );
};

export default PublicDashboard;
