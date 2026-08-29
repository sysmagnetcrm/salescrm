import { useState, useEffect } from 'react';
import { WifiOff, PhoneCall } from 'lucide-react';

const NetworkBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showDialerPrompt, setShowDialerPrompt] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (window.AndroidCRM?.isDefaultDialer) {
      setShowDialerPrompt(!window.AndroidCRM.isDefaultDialer());
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSetDefault = () => {
    if (window.AndroidCRM?.requestDefaultDialer) {
      window.AndroidCRM.requestDefaultDialer();
    }
  };

  if (isOffline) {
    return (
      <div className="bg-amber-500 text-white text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-2 shadow-inner z-50 transition-all">
        <WifiOff className="h-3.5 w-3.5 animate-pulse" />
        <span>Network disconnected. Displaying cached CRM data. Reconnecting...</span>
      </div>
    );
  }

  if (showDialerPrompt) {
    return (
      <div className="bg-indigo-700 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between shadow-sm z-50 transition-all">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-sky-300" />
          <span>Set Academy CRM as your default phone app for native call management & Caller ID.</span>
        </div>
        <button
          onClick={handleSetDefault}
          className="ml-3 bg-white text-indigo-900 px-3 py-1 rounded-md font-bold text-[11px] hover:bg-indigo-50 shadow-sm"
        >
          SET AS DEFAULT
        </button>
      </div>
    );
  }

  return null;
};

export default NetworkBanner;
