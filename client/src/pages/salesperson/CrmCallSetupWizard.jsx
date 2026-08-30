import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Smartphone, 
  BatteryCharging, 
  Zap, 
  Bell, 
  PhoneCall, 
  FileText, 
  Sliders, 
  ArrowRight,
  FolderArchive,
  ExternalLink,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

const CrmCallSetupWizard = () => {
  const navigate = useNavigate();
  const [diag, setDiag] = useState({
    brand: '',
    model: '',
    sdk: 0,
    manufacturer: '',
    isXiaomi: false,
    hasCallPhone: false,
    hasReadCallLog: false,
    hasReadPhoneState: false,
    hasPostNotif: false,
    hasStorageAccess: false,
    isIgnoringBattery: false,
    showPhoneRationale: false,
    showCallLogRationale: false,
    showPhoneStateRationale: false,
    showNotifRationale: false,
    offlineQueueLength: 0
  });

  const [scanning, setScanning] = useState(false);
  const [autoStartUserConfigured, setAutoStartUserConfigured] = useState(() => {
    return localStorage.getItem('xiaomi_autostart_configured') === 'true';
  });

  const runScan = useCallback(() => {
    setScanning(true);
    try {
      if (window.AndroidCRM && typeof window.AndroidCRM.getDeviceDiagnostics === 'function') {
        const raw = window.AndroidCRM.getDeviceDiagnostics();
        const parsed = JSON.parse(raw);
        setDiag(parsed);
      } else {
        // Fallback for non-Android / Web preview environment
        setDiag(prev => ({
          ...prev,
          manufacturer: 'Web Browser',
          model: 'Desktop/Mobile Web',
          sdk: 34,
          hasCallPhone: true,
          hasReadCallLog: true,
          hasReadPhoneState: true,
          hasPostNotif: true,
          hasStorageAccess: true,
          isIgnoringBattery: true
        }));
      }
    } catch (e) {
      console.error('Error scanning device status:', e);
    } finally {
      setTimeout(() => setScanning(false), 300);
    }
  }, []);

  useEffect(() => {
    runScan();
    const handleFocus = () => runScan();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runScan();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [runScan]);

  const handleToggleAutoStartConfigured = (value) => {
    setAutoStartUserConfigured(value);
    localStorage.setItem('xiaomi_autostart_configured', value ? 'true' : 'false');
    if (value) {
      toast.success('Xiaomi Auto-Start marked as enabled');
    }
  };

  const isXiaomi = diag.isXiaomi || (diag.manufacturer || '').toLowerCase().includes('xiaomi');
  const deviceName = `${diag.manufacturer || diag.brand || 'Device'} ${diag.model || ''}`.trim() || 'Android Device';

  // Master Permissions Definition
  const permissionsList = [
    {
      id: 'phone_call',
      title: 'Phone Call Execution',
      category: 'hard',
      icon: PhoneCall,
      desc: 'Required to initiate direct cellular SIM calls from CRM lead queues.',
      granted: !!diag.hasCallPhone,
      showRationale: diag.showPhoneRationale,
      action: () => {
        if (window.AndroidCRM?.requestRuntimePermission) {
          window.AndroidCRM.requestRuntimePermission('android.permission.CALL_PHONE');
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'call_log',
      title: 'Call Log & Duration Tracking',
      category: 'hard',
      icon: FileText,
      desc: 'Required to capture exact talk duration, connect time, and hangup events.',
      granted: !!diag.hasReadCallLog,
      showRationale: diag.showCallLogRationale,
      action: () => {
        if (window.AndroidCRM?.requestRuntimePermission) {
          window.AndroidCRM.requestRuntimePermission('android.permission.READ_CALL_LOG');
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'phone_state',
      title: 'Cellular State Detection',
      category: 'hard',
      icon: Smartphone,
      desc: 'Detects active SIM state, line carrier status, and idle/dialing transitions.',
      granted: !!diag.hasReadPhoneState,
      showRationale: diag.showPhoneStateRationale,
      action: () => {
        if (window.AndroidCRM?.requestRuntimePermission) {
          window.AndroidCRM.requestRuntimePermission('android.permission.READ_PHONE_STATE');
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'storage_access',
      title: 'Call Recording File Access',
      category: 'hard',
      icon: FolderArchive,
      desc: 'Required to access native OEM call recordings in storage for AI intelligence.',
      granted: !!diag.hasStorageAccess,
      action: () => {
        if (window.AndroidCRM?.openAllFilesAccessSettings) {
          window.AndroidCRM.openAllFilesAccessSettings();
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'battery_exemption',
      title: 'Battery Saver Exemption',
      category: 'hard',
      icon: BatteryCharging,
      desc: 'Prevents Android OS from killing background call tracking services during long calls.',
      granted: !!diag.isIgnoringBattery,
      action: () => {
        if (window.AndroidCRM?.requestBatteryOptimizationExemption) {
          window.AndroidCRM.requestBatteryOptimizationExemption();
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'notifications',
      title: 'System Notifications',
      category: 'soft',
      icon: Bell,
      desc: 'Displays active call status notifications and pending sync alerts.',
      granted: !!diag.hasPostNotif,
      showRationale: diag.showNotifRationale,
      action: () => {
        if (window.AndroidCRM?.requestRuntimePermission) {
          window.AndroidCRM.requestRuntimePermission('android.permission.POST_NOTIFICATIONS');
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'notif_listener',
      title: 'Status Bar Live Call Listener',
      category: 'soft',
      icon: Eye,
      desc: 'Truecaller-style status bar monitor. Detects live call connect/answer status from system phone dialer notifications.',
      granted: true,
      action: () => {
        if (window.AndroidCRM?.openNotificationListenerSettings) {
          window.AndroidCRM.openNotificationListenerSettings();
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'default_dialer',
      title: 'CRM Native Phone Dialer',
      category: 'soft',
      icon: PhoneCall,
      desc: 'Sets CRM as the default native phone dialer for 100% accurate call connect/disconnect tracking & live in-call controls.',
      granted: !!(window.AndroidCRM && typeof window.AndroidCRM.isDefaultDialerHeld === 'function' && window.AndroidCRM.isDefaultDialerHeld()),
      action: () => {
        if (window.AndroidCRM?.requestDefaultDialer) {
          window.AndroidCRM.requestDefaultDialer();
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    }
  ];

  if (isXiaomi) {
    permissionsList.push({
      id: 'xiaomi_autostart',
      title: 'Xiaomi Auto-Start Management',
      category: 'soft',
      icon: Zap,
      desc: 'Allows CRM background service to auto-start on MIUI / HyperOS reboot.',
      granted: autoStartUserConfigured,
      isAutoStart: true,
      action: () => {
        if (window.AndroidCRM?.openXiaomiAutoStartSettings) {
          window.AndroidCRM.openXiaomiAutoStartSettings();
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    });
  }

  const hardBlockers = permissionsList.filter(p => p.category === 'hard');
  const softSettings = permissionsList.filter(p => p.category === 'soft');

  const hardGrantedCount = hardBlockers.filter(p => p.granted).length;
  const totalGrantedCount = permissionsList.filter(p => p.granted).length;
  const allHardGranted = hardGrantedCount === hardBlockers.length;
  const progressPercent = Math.round((totalGrantedCount / permissionsList.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 px-4 sm:px-0">
      {/* Minimal Header Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold">
              <Smartphone className="h-3.5 w-3.5 text-primary-400" />
              <span>{deviceName}</span>
              {diag.sdk ? <span className="text-slate-500">• API {diag.sdk}</span> : null}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white pt-1">
              Telephony Readiness Setup
            </h1>
            <p className="text-xs text-slate-400">
              Configure system permissions for real-time call tracking and recording sync.
            </p>
          </div>

          <button
            onClick={runScan}
            disabled={scanning}
            className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-primary-400 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Re-scan Status'}</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-2 relative z-10">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">System Readiness</span>
            <span className="font-bold text-primary-400">{progressPercent}% Completed ({totalGrantedCount}/{permissionsList.length})</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary-500 to-emerald-400 h-2 transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Main Checklist */}
      <div className="space-y-6">
        {/* Section 1: Hard Blockers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-amber-500" /> Essential Telephony Grants ({hardGrantedCount}/{hardBlockers.length})
            </h2>
            {allHardGranted && (
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                All Core Grants Ready
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {hardBlockers.map((item) => (
              <PermissionRow key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Section 2: Soft Recommended Settings */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-blue-500" /> Recommended System Optimizations
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {softSettings.map((item) => (
              <PermissionRow 
                key={item.id} 
                item={item} 
                onToggleAutoStart={handleToggleAutoStartConfigured}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 text-center sm:text-left">
          {allHardGranted 
            ? 'All essential permissions granted. You are ready to make cellular calls.' 
            : 'Grant essential permissions above to enable cellular call tracking.'}
        </p>

        <button
          type="button"
          onClick={() => {
            if (!allHardGranted) {
              toast.error('Please grant required telephony permissions first');
              return;
            }
            navigate('/salesperson/queue');
          }}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all ${
            allHardGranted
              ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-600/20'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>Open BDE Lead Queue</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const PermissionRow = ({ item, onToggleAutoStart }) => {
  const Icon = item.icon;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      item.granted 
        ? 'bg-white border-slate-200 shadow-sm' 
        : 'bg-amber-50/40 border-amber-200/80 shadow-sm'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg shrink-0 ${
            item.granted ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-100 text-amber-700'
          }`}>
            <Icon className="h-5 w-5" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              {item.granted ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> PASS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">
                  <AlertCircle className="h-3 w-3" /> ACTION REQUIRED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">{item.desc}</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 self-end sm:self-center pt-2 sm:pt-0">
          {item.granted ? (
            item.isAutoStart ? (
              <button
                onClick={() => onToggleAutoStart(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Reset Status
              </button>
            ) : (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Ready
              </span>
            )
          ) : (
            <div className="flex items-center gap-2">
              {item.isAutoStart && (
                <button
                  onClick={() => onToggleAutoStart(true)}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  Mark Enabled
                </button>
              )}
              <button
                onClick={item.action}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
              >
                <span>{item.showRationale === false ? 'Open App Settings' : 'Configure Grant'}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CrmCallSetupWizard;
