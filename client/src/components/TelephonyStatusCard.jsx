import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneCall, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const TelephonyStatusCard = () => {
  const navigate = useNavigate();
  const [diag, setDiag] = useState({
    autoStart: 'ACTION REQUIRED',
    recordingCapability: 'SUPPORTED',
    callTracking: 'PASS'
  });

  useEffect(() => {
    try {
      if (window.AndroidCRM && typeof window.AndroidCRM.getDeviceDiagnostics === 'function') {
        const raw = window.AndroidCRM.getDeviceDiagnostics();
        setDiag(JSON.parse(raw));
      }
    } catch (e) {
      console.error('Error fetching status pill diagnostics:', e);
    }
  }, []);

  const handleClick = () => {
    navigate('/salesperson/call-setup');
  };

  const isAction = diag.autoStart === 'ACTION REQUIRED' || diag.batteryOptimization === 'ACTION REQUIRED';
  const isUnavail = diag.recordingCapability === 'UNAVAILABLE' || diag.callTracking === 'RESTRICTED';

  if (isAction) {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-colors shadow-sm animate-pulse"
      >
        <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
        <span>CRM CALL SYSTEM</span>
        <span className="font-extrabold text-[11px] text-amber-800">⚠ ACTION REQUIRED</span>
      </button>
    );
  }

  if (isUnavail) {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-900 border border-red-300 hover:bg-red-200 transition-colors shadow-sm"
      >
        <XCircle className="h-3.5 w-3.5 text-red-700" />
        <span>CRM CALL SYSTEM</span>
        <span className="font-extrabold text-[11px] text-red-800">✕ RECORDING UNAVAILABLE</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition-colors shadow-sm"
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
      <span>CRM CALL SYSTEM</span>
      <span className="font-extrabold text-[11px] text-emerald-800">● READY</span>
    </button>
  );
};

export default TelephonyStatusCard;
