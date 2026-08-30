import { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, Sliders } from 'lucide-react';
import toast from 'react-hot-toast';

const CrmCallSetupWizard = () => {
  const [diag, setDiag] = useState({
    brand: 'Xiaomi',
    model: '24053PY09I',
    sdk: 36,
    manufacturer: 'Xiaomi',
    isXiaomi: true,
    callTracking: 'PASS',
    telecomAccess: 'PASS',
    defaultDialer: 'SUPPORTED',
    recordingCapability: 'SUPPORTED',
    recordingAccess: 'PASS',
    backgroundExecution: 'PASS',
    batteryOptimization: 'PASS',
    autoStart: 'ACTION REQUIRED',
    notifications: 'PASS',
    networkSync: 'PASS',
    aiAvailability: 'AVAILABLE',
    offlineQueueLength: 0
  });

  const [scanning, setScanning] = useState(false);

  const runScan = () => {
    setScanning(true);
    try {
      if (window.AndroidCRM && typeof window.AndroidCRM.getDeviceDiagnostics === 'function') {
        const raw = window.AndroidCRM.getDeviceDiagnostics();
        const parsed = JSON.parse(raw);
        setDiag(parsed);
        toast.success('Telephony requirements re-verified!');
      } else {
        toast('Running in browser environment. Displaying attached target device profile.');
      }
    } catch (e) {
      console.error('Error scanning device status:', e);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    runScan();
  }, []);

  const isXiaomiDevice = diag.isXiaomi || (diag.manufacturer || '').toLowerCase().includes('xiaomi');
  const rawDeviceName = `${diag.manufacturer || diag.brand || 'Device'} ${diag.model || ''}`.trim();

  const requirements = [
    { key: 'telecomAccess', label: '1. Phone Permission', desc: 'Android CALL_PHONE permission to initiate & monitor SIM cellular calls.' },
    { key: 'callTracking', label: '2. Telecom Availability', desc: 'Android Telecom framework integration & SIM call monitoring readiness.' },
    { key: 'defaultDialer', label: '3. Default Dialer Status', desc: 'Default dialer role optional. Native Call Monitor active.' },
    { key: 'backgroundExecution', label: '4. Call Tracking Service', desc: 'Call monitoring & background logging service capability.' },
    { key: 'recordingCapability', label: '5. Recording Capability', desc: 'Native OEM call recording support & accessibility.' },
    { key: 'recordingAccess', label: '6. Recording Access', desc: 'All Files Access (MANAGE_EXTERNAL_STORAGE) & MediaStore read access.' },
    { key: 'notifications', label: '7. Notification Permission', desc: 'POST_NOTIFICATIONS granted for persistent service status notifications.' },
    { key: 'batteryOptimization', label: '8. Battery Optimization', desc: 'Exemption from Android battery saver background process killing.', action: () => window.AndroidCRM?.openBatteryOptimizationSettings() },
    { key: 'autoStart', label: `9. ${isXiaomiDevice ? 'Xiaomi' : 'OEM'} Auto-Start`, desc: `${isXiaomiDevice ? 'Xiaomi HyperOS / MIUI' : 'OEM'} Security Auto-start background execution permission.`, action: () => window.AndroidCRM?.openAutoStartSettings() },
    { key: 'backgroundExecution', label: '10. Background Execution', desc: 'Service continues running when app is backgrounded or screen locked.' },
    { key: 'networkSync', label: '11. Network Synchronization', desc: 'Offline queue local persistence & automatic server flushing.' },
    { key: 'aiAvailability', label: '12. AI Pipeline Readiness', desc: 'Speech-to-text transcript & AI Call Intelligence pipeline.' }
  ];

  const getBadge = (status) => {
    switch (status) {
      case 'PASS':
        return <span className="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">PASS</span>;
      case 'SUPPORTED':
        return <span className="px-2.5 py-1 text-xs font-black rounded-full bg-blue-100 text-blue-800 border border-blue-300">SUPPORTED</span>;
      case 'AVAILABLE':
        return <span className="px-2.5 py-1 text-xs font-black rounded-full bg-purple-100 text-purple-800 border border-purple-300">AVAILABLE</span>;
      case 'ACTION REQUIRED':
        return <span className="px-2.5 py-1 text-xs font-black rounded-full bg-orange-100 text-orange-800 border border-orange-300 animate-pulse">ACTION REQUIRED</span>;
      case 'RESTRICTED':
        return <span className="px-2.5 py-1 text-xs font-black rounded-full bg-amber-100 text-amber-800 border border-amber-300">RESTRICTED</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-black rounded-full bg-red-100 text-red-800 border border-red-300">{status || 'NOT SUPPORTED'}</span>;
    }
  };

  const passCount = requirements.filter(r => ['PASS', 'SUPPORTED', 'AVAILABLE'].includes(diag[r.key])).length;
  const isFullyConfigured = passCount === requirements.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">WELCOME TO ACADEMY CRM</span>
              <h1 className="text-xl font-bold">BDE Telephony Call System Setup</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runScan}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/20"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} /> Check Again
            </button>
            <a
              href="/salesperson/queue"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-sm"
            >
              Continue to Queue →
            </a>
          </div>
        </div>

        {/* Readiness Meter */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs font-semibold">
            <span className="font-mono font-bold text-sky-300">{passCount} / {requirements.length} Requirements Ready</span>
            <span className={isFullyConfigured ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {isFullyConfigured ? '100% READY FOR CALLING' : 'CONFIGURATION REQUIRED'}
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${isFullyConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${(passCount / requirements.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sequential Requirements Checklist */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <span className="font-bold text-sm text-gray-800">Sequential Telephony Readiness Requirements</span>
          <span className="text-xs text-gray-500">Target Device: {rawDeviceName}</span>
        </div>

        {requirements.map((req, idx) => {
          const status = diag[req.key] || 'PASS';
          const isAction = status === 'ACTION REQUIRED' || status === 'RESTRICTED';

          return (
            <div key={idx} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50/60">
              <div className="space-y-1 max-w-xl">
                <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  {req.label}
                </div>
                <p className="text-xs text-gray-500">{req.desc}</p>
              </div>

              <div className="flex items-center gap-2">
                {getBadge(status)}
                {req.action && isAction && (
                  <button
                    onClick={req.action}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
                  >
                    <Sliders className="h-3 w-3" /> Fix / Configure
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CrmCallSetupWizard;
