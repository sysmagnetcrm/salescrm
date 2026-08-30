import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Sliders, CheckCircle2, AlertCircle, ArrowRight, Smartphone, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

const CrmCallSetupWizard = () => {
  const [diag, setDiag] = useState({
    brand: 'Xiaomi',
    model: '24053PY09I',
    sdk: 36,
    manufacturer: 'Xiaomi',
    isXiaomi: true,
    hasCallPhone: true,
    hasReadCallLog: true,
    hasReadPhoneState: true,
    hasPostNotif: true,
    hasStorageAccess: true,
    isIgnoringBattery: true,
    showPhoneRationale: true,
    showCallLogRationale: true,
    showPhoneStateRationale: true,
    showNotifRationale: true,
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

  const runScan = useCallback(() => {
    setScanning(true);
    try {
      if (window.AndroidCRM && typeof window.AndroidCRM.getDeviceDiagnostics === 'function') {
        const raw = window.AndroidCRM.getDeviceDiagnostics();
        const parsed = JSON.parse(raw);
        setDiag(parsed);
      }
    } catch (e) {
      console.error('Error scanning device status:', e);
    } finally {
      setScanning(false);
    }
  }, []);

  // Automatic live status re-check on app resume (when user returns from Settings or dialogs)
  useEffect(() => {
    runScan();
    const handleFocus = () => runScan();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runScan();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [runScan]);

  const isXiaomiDevice = diag.isXiaomi || (diag.manufacturer || '').toLowerCase().includes('xiaomi');
  const rawDeviceName = `${diag.manufacturer || diag.brand || 'Device'} ${diag.model || ''}`.trim();

  // Unified Onboarding Items List
  const onboardingItems = [
    {
      id: 'phone_call',
      label: '1. Phone Call Permission',
      desc: 'Required to initiate outgoing SIM cellular calls directly from the lead queue without manual typing.',
      permissionName: 'android.permission.CALL_PHONE',
      type: 'runtime',
      isHardBlocker: true,
      isGranted: !!diag.hasCallPhone,
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
      id: 'read_call_log',
      label: '2. Call Log Permission',
      desc: 'Required to detect call start/end timestamps and precise talk duration for automatic lead logging.',
      permissionName: 'android.permission.READ_CALL_LOG',
      type: 'runtime',
      isHardBlocker: true,
      isGranted: !!diag.hasReadCallLog,
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
      id: 'read_phone_state',
      label: '3. Phone Line State Permission',
      desc: 'Required to monitor live SIM line state transitions (Ringing, Connected, Ended) during BDE calls.',
      permissionName: 'android.permission.READ_PHONE_STATE',
      type: 'runtime',
      isHardBlocker: true,
      isGranted: !!diag.hasReadPhoneState,
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
      label: '4. Call Recording Files Access',
      desc: 'All Files Access (MANAGE_EXTERNAL_STORAGE) required to locate and upload call audio recordings for AI transcription.',
      type: 'special',
      isHardBlocker: true,
      isGranted: !!diag.hasStorageAccess,
      action: () => {
        if (window.AndroidCRM?.openAllFilesAccessSettings) {
          window.AndroidCRM.openAllFilesAccessSettings();
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'battery_optimization',
      label: '5. Battery Saver Exemption',
      desc: 'Exemption from Android battery optimization so call log sync is never killed in background when phone screen locks.',
      type: 'special',
      isHardBlocker: true,
      isGranted: !!diag.isIgnoringBattery,
      action: () => {
        if (window.AndroidCRM?.openBatteryOptimizationSettings) {
          window.AndroidCRM.openBatteryOptimizationSettings();
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    {
      id: 'post_notif',
      label: '6. Notification Permission',
      desc: 'Allows displaying persistent background call monitoring and offline queue sync progress notifications.',
      permissionName: 'android.permission.POST_NOTIFICATIONS',
      type: 'runtime',
      isHardBlocker: false,
      isGranted: !!diag.hasPostNotif,
      showRationale: diag.showNotifRationale,
      action: () => {
        if (window.AndroidCRM?.requestRuntimePermission) {
          window.AndroidCRM.requestRuntimePermission('android.permission.POST_NOTIFICATIONS');
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    },
    ...(isXiaomiDevice ? [{
      id: 'auto_start',
      label: `7. ${diag.manufacturer || 'Xiaomi'} Security Auto-Start`,
      desc: 'Allows background call receiver to auto-launch on phone boot and remain active for uninterrupted tracking.',
      type: 'special',
      isHardBlocker: false,
      isGranted: diag.autoStart === 'PASS' || diag.autoStart === 'SUPPORTED',
      action: () => {
        if (window.AndroidCRM?.openAutoStartSettings) {
          window.AndroidCRM.openAutoStartSettings();
        } else {
          window.AndroidCRM?.openAppSettings?.();
        }
      }
    }] : [])
  ];

  // Hard blockers evaluation
  const hardBlockers = onboardingItems.filter(item => item.isHardBlocker);
  const passedHardBlockers = hardBlockers.filter(item => item.isGranted);
  const isHardBlockersPassed = passedHardBlockers.length === hardBlockers.length;

  const firstPendingItem = onboardingItems.find(item => !item.isGranted);

  const getBadge = (isGranted, isHardBlocker) => {
    if (isGranted) {
      return (
        <span className="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> GRANTED
        </span>
      );
    }
    if (isHardBlocker) {
      return (
        <span className="px-2.5 py-1 text-xs font-black rounded-full bg-orange-100 text-orange-800 border border-orange-300 animate-pulse inline-flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" /> ACTION REQUIRED
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-xs font-black rounded-full bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
        <AlertCircle className="h-3.5 w-3.5" /> RECOMMENDED
      </span>
    );
  };

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
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block">TELEPHONY SYSTEM ONBOARDING</span>
              <h1 className="text-xl font-bold">BDE Call Setup & Permissions</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runScan}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/20"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} /> Refresh Status
            </button>
            <a
              href={isHardBlockersPassed ? "/salesperson/queue" : "#"}
              onClick={(e) => {
                if (!isHardBlockersPassed) {
                  e.preventDefault();
                  toast.error(`Please configure the required permissions (${passedHardBlockers.length}/${hardBlockers.length} ready)`);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all shadow-md ${
                isHardBlockersPassed
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-80'
              }`}
            >
              Continue to Queue <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Device Profile & Progress Meter */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between text-xs gap-1">
            <span className="text-slate-300 font-mono flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-sky-400" />
              Target: <strong className="text-white">{rawDeviceName}</strong> (Android SDK {diag.sdk || 36})
            </span>
            <span className={isHardBlockersPassed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {isHardBlockersPassed
                ? '100% HARD-BLOCKERS READY — READY TO CALL'
                : `${passedHardBlockers.length} / ${hardBlockers.length} REQUIRED PERMISSIONS GRANTED`}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${isHardBlockersPassed ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${(passedHardBlockers.length / hardBlockers.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active Step Banner (If any item is pending) */}
      {firstPendingItem ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded">
                NEXT STEP ({firstPendingItem.isHardBlocker ? 'REQUIRED' : 'RECOMMENDED'})
              </span>
              <h2 className="text-base font-bold text-gray-900">{firstPendingItem.label}</h2>
              <p className="text-xs text-gray-700">{firstPendingItem.desc}</p>
            </div>
            <button
              onClick={firstPendingItem.action}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-all"
            >
              {firstPendingItem.type === 'runtime' && !firstPendingItem.showRationale && !firstPendingItem.isGranted ? (
                <>
                  <Settings className="h-4 w-4" /> Open App Settings
                </>
              ) : (
                <>
                  <Sliders className="h-4 w-4" /> Grant / Configure Now
                </>
              )}
            </button>
          </div>
          {firstPendingItem.type === 'runtime' && !firstPendingItem.showRationale && !firstPendingItem.isGranted && (
            <p className="text-xs text-amber-900 bg-amber-100/80 p-2.5 rounded-lg border border-amber-300">
              ⚠️ Permission was denied by Android. Tap <strong>Open App Settings</strong> &gt; <strong>Permissions</strong> and enable it manually.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-emerald-900">All Telephony Requirements Configured!</h2>
              <p className="text-xs text-emerald-700">Your device is fully setup for native SIM calling, recording capture, and automated CRM tracking.</p>
            </div>
          </div>
          <a
            href="/salesperson/queue"
            className="shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
          >
            Start Calling <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Sequential Requirements Checklist Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <span className="font-bold text-sm text-gray-800">Sequential Telephony Onboarding Checklist</span>
          <span className="text-xs text-gray-500 font-mono">{rawDeviceName}</span>
        </div>

        {onboardingItems.map((item) => {
          const isPending = !item.isGranted;
          const isPermanentlyDenied = item.type === 'runtime' && !item.showRationale && isPending;

          return (
            <div
              key={item.id}
              className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                isPending ? 'bg-amber-50/20' : 'hover:bg-gray-50/60'
              }`}
            >
              <div className="space-y-1 max-w-xl">
                <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  {item.label}
                  {item.isHardBlocker ? (
                    <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">REQUIRED</span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">OPTIONAL</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {getBadge(item.isGranted, item.isHardBlocker)}
                {isPending && (
                  <button
                    onClick={item.action}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
                  >
                    {isPermanentlyDenied ? (
                      <>
                        <Settings className="h-3 w-3" /> App Settings
                      </>
                    ) : (
                      <>
                        <Sliders className="h-3 w-3" /> Configure
                      </>
                    )}
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
