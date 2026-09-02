import React, { useState, useEffect } from 'react';
import { PhoneCall, Mic, MicOff, Volume2, VolumeX, PhoneOff, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';

const ActiveCallController = () => {
  const [callSession, setCallSession] = useState(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);

  // Live Timer Effect for Connected Call
  useEffect(() => {
    let timer;
    if (callSession && callSession.state === 'CONNECTED') {
      timer = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callSession]);

  // Subscribe to Native Android Telecom Bridge & Custom App Events
  useEffect(() => {
    const handleNativeCallEvent = (e) => {
      const detail = e.detail || {};
      const eventType = detail.eventType;
      const callState = detail.state;

      if (['CALL_CREATED', 'CALL_DIALING', 'CALL_RINGING', 'CALL_ACTIVE'].includes(eventType)) {
        setCallSession((prev) => ({
          callId: detail.callId || prev?.callId || '',
          leadId: detail.leadId || prev?.leadId || '',
          leadName: detail.leadName || prev?.leadName || 'Academy CRM Lead',
          phone: detail.phone || prev?.phone || '',
          state: callState === 'CONNECTED' ? 'CONNECTED' : (callState === 'RINGING' ? 'RINGING' : 'DIALING')
        }));

        if (callState === 'CONNECTED' && (!callSession || callSession.state !== 'CONNECTED')) {
          setSecondsElapsed(0);
        }
      } else if (eventType === 'CALL_AUDIO_CHANGED') {
        if (typeof detail.isMuted === 'boolean') setIsMuted(detail.isMuted);
        if (typeof detail.isSpeakerOn === 'boolean') setIsSpeakerOn(detail.isSpeakerOn);
      } else if (eventType === 'CALL_DISCONNECTED') {
        const talkSecs = detail.durationSeconds || secondsElapsed;
        setLastSummary({
          leadName: detail.leadName || callSession?.leadName || 'Academy CRM Lead',
          phone: detail.phone || callSession?.phone || '',
          durationSeconds: talkSecs,
          status: detail.status || 'completed'
        });

        setCallSession(null);
        setSecondsElapsed(0);
        setShowCompletionBanner(true);
        clearCallStorage();

        setTimeout(() => {
          setShowCompletionBanner(false);
        }, 4000);
      }
    };

    const handleCallStarted = (e) => {
      if (e?.detail) {
        setCallSession({
          callId: e.detail.callId || '',
          leadId: e.detail.leadId || '',
          leadName: e.detail.leadName || 'Academy CRM Lead',
          phone: e.detail.phone || '',
          state: 'DIALING'
        });
        setSecondsElapsed(0);
      }
    };

    const handleCallErrorOrEnded = () => {
      setCallSession(null);
      setSecondsElapsed(0);
      clearCallStorage();
    };

    window.addEventListener('crmCallStateChanged', handleNativeCallEvent);
    window.addEventListener('crmCallStarted', handleCallStarted);
    window.addEventListener('crmCallError', handleCallErrorOrEnded);
    window.addEventListener('crmCallEnded', handleCallErrorOrEnded);

    return () => {
      window.removeEventListener('crmCallStateChanged', handleNativeCallEvent);
      window.removeEventListener('crmCallStarted', handleCallStarted);
      window.removeEventListener('crmCallError', handleCallErrorOrEnded);
      window.removeEventListener('crmCallEnded', handleCallErrorOrEnded);
    };
  }, [callSession, secondsElapsed]);

  const clearCallStorage = () => {
    localStorage.removeItem('pendingCallLog');
    try {
      const rawUser = localStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      const userId = user?.id || user?._id || 'default';
      localStorage.removeItem(`pendingCallLog_${userId}`);
    } catch (_) {}
  };

  const handleMuteToggle = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (window.AndroidCRM?.setMute) {
      window.AndroidCRM.setMute(nextMute);
    }
  };

  const handleSpeakerToggle = () => {
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    if (window.AndroidCRM?.setSpeaker) {
      window.AndroidCRM.setSpeaker(nextSpeaker);
    }
  };

  const handleEndCall = () => {
    if (callSession?.callId && window.AndroidCRM?.endCall) {
      try { window.AndroidCRM.endCall(callSession.callId); } catch (_) {}
    }
    setCallSession(null);
    setSecondsElapsed(0);
    clearCallStorage();
    window.dispatchEvent(new CustomEvent('crmCallEnded'));
    toast.success('Call section closed');
  };

  const formatTime = (totalSecs) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Render Persistent Floating Call Banner if Call Active
  if (callSession) {
    const isConnected = callSession.state === 'CONNECTED';
    return (
      <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 text-white shadow-2xl relative">
          {/* Top Dismiss Button */}
          <button
            onClick={handleEndCall}
            className="absolute top-3 right-3 p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Close Call Section"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between gap-3 mb-3 pr-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-3 h-3 rounded-full shrink-0 ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black tracking-wider text-slate-400 uppercase">
                    {isConnected ? '● LIVE CALL' : `● ${callSession.state}`}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-sky-500/20 font-semibold">
                    RECORDING
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100 truncate">
                  {callSession.leadName}
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  {callSession.phone}
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="text-xl font-black font-mono text-emerald-400">
                {isConnected ? formatTime(secondsElapsed) : '00:00'}
              </div>
              <div className="text-[10px] text-slate-400 font-medium uppercase">
                {isConnected ? 'CONNECTED' : 'DIALING'}
              </div>
            </div>
          </div>

          {/* Quick Audio Controls & End Call */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleMuteToggle}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'MUTED' : 'MUTE'}</span>
            </button>

            <button
              type="button"
              onClick={handleSpeakerToggle}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                isSpeakerOn
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isSpeakerOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{isSpeakerOn ? 'SPEAKER' : 'SPEAKER'}</span>
            </button>

            <button
              type="button"
              onClick={handleEndCall}
              className="py-2 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <PhoneOff className="w-4 h-4" />
              <span>END</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Brief Disconnect Summary Banner
  if (showCompletionBanner && lastSummary) {
    return (
      <div className="fixed bottom-3 left-3 right-3 md:left-auto md:right-6 md:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-3.5 text-white shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                CALL COMPLETED
              </div>
              <div className="text-xs font-bold text-slate-200">
                {lastSummary.leadName} • Talk time: {formatTime(lastSummary.durationSeconds)}
              </div>
              <div className="text-[10px] text-slate-400">
                Call log updated
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCompletionBanner(false)}
            className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default ActiveCallController;
