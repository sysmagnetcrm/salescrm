import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadAPI, paymentAPI, callAPI, dispositionAPI, userAPI, startCrmCall } from '../../services/api';
import {
  Phone,
  PhoneOff,
  PhoneCall,
  PhoneMissed,
  ArrowUpRight,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  CreditCard,
  RefreshCw,
  MessageCircle,
  Check,
  Zap,
  IndianRupee,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Plus,
  Play,
  Pause,
  Copy,
  Tag,
  User,
  History,
  ListTodo,
  Shield,
  Volume2,
  X,
  Search,
  Grid,
  HelpCircle,
  MoreVertical,
  Delete
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isBefore } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const LeadQueueView = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Top Level View Mode: 'list' (Front Call History / Queue List view - Screenshot 4) | 'detail' (Single Lead Workspace - Screenshots 1,2,3)
  const [viewMode, setViewMode] = useState('list');

  // Queue Navigation & Filter State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeBucket, setActiveBucket] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [listTabFilter, setListTabFilter] = useState('all'); // 'all' | 'my' | 'ai' | 'callback'
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Lead Detail View Sub-Tabs (DETAIL | ACTIVITY | CALLS | LEAD INFO)
  const [activeTab, setActiveTab] = useState('DETAIL');
  const [activeActivitySubTab, setActiveActivitySubTab] = useState('History');

  // Tag Management Modal / Inline Toggle
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Quick Note & Quick Task Drawers / Modals
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskDueDate, setQuickTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // Floating Dialer Keypad Modal
  const [showKeypadModal, setShowKeypadModal] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');

  // Audio Recording Player Modal State
  const [playingAudioUrl, setPlayingAudioUrl] = useState(null);
  const [playingCallId, setPlayingCallId] = useState(null);
  const audioRef = useRef(null);

  // Dynamic Dispositions Query
  const { data: dispositions = [] } = useQuery({
    queryKey: ['dispositions'],
    queryFn: () => dispositionAPI.getDispositions().then(r => r.data.data || []),
    staleTime: 300000
  });

  // Salespeople List Query for Lead Owner Selection
  const { data: salespeople = [] } = useQuery({
    queryKey: ['salespeople'],
    queryFn: () => userAPI.getSalespeople().then(r => r.data.data || []),
    staleTime: 300000
  });

  // Working Queue Query with background polling
  const { data: queueResponse, isLoading: loading, refetch: refetchQueue } = useQuery({
    queryKey: ['leads', 'queue', activeBucket],
    queryFn: () => leadAPI.getQueue({ bucket: activeBucket }).then(r => {
      setLastRefreshedAt(new Date());
      return r.data;
    }),
    staleTime: 15000,
    refetchInterval: 15000,
    placeholderData: (prev) => prev
  });

  const queue = queueResponse?.data || [];
  const summary = queueResponse?.queueSummary || { missedCount: 0, todayCount: 0, freshCount: 0, totalQueueCount: 0 };
  const currentLead = queue[currentIndex] || null;

  // Filtered queue items for list view based on tab filter & search query
  const filteredQueue = queue.filter(lead => {
    const matchesSearch = !searchQuery.trim() ||
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.product?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (listTabFilter === 'callback') {
      return lead.status === 'follow-up' || isBefore(new Date(lead.nextFollowUpAt || 0), new Date());
    } else if (listTabFilter === 'ai') {
      return lead.source?.toLowerCase().includes('ai') || lead.notes?.toLowerCase().includes('ai');
    }
    return true;
  });

  // Query Lead Call History for the active lead
  const { data: leadCallLogs = [], refetch: refetchLeadCalls } = useQuery({
    queryKey: ['calls', 'lead', currentLead?.id],
    queryFn: () => callAPI.getLeadCallHistory(currentLead.id).then(r => r.data?.data || []),
    enabled: !!currentLead?.id,
    staleTime: 10000
  });

  // Query Lead Full Details (includes activities & assignment history)
  const { data: leadFullDetails, refetch: refetchLeadDetails } = useQuery({
    queryKey: ['lead', 'detail', currentLead?.id],
    queryFn: () => leadAPI.getLead(currentLead.id).then(r => r.data?.data || r.data),
    enabled: !!currentLead?.id,
    staleTime: 10000
  });

  // Lead Working Form State
  const [status, setStatus] = useState('fresh');
  const [disposition, setDisposition] = useState('');
  const [campus, setCampus] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [notes, setNotes] = useState('');
  const [leadOwnerId, setLeadOwnerId] = useState('');
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Calling State Machine
  const [activeCallId, setActiveCallId] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [calledPhone, setCalledPhone] = useState('');

  // Payment Form State
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);
  const [paymentType, setPaymentType] = useState('admission');
  const [paymentAmount, setPaymentAmount] = useState('1000');
  const [paymentRef, setPaymentRef] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Sync form state when current lead changes
  useEffect(() => {
    if (currentLead) {
      setStatus(currentLead.status || 'fresh');
      setCampus(currentLead.campus || '');
      setNotes(currentLead.notes || '');
      setDisposition(currentLead.disposition || '');
      setLeadOwnerId(currentLead.assignedTo || '');
      setTags(Array.isArray(currentLead.tags) ? currentLead.tags : (currentLead.tags ? String(currentLead.tags).split(',') : []));
      setNextFollowUpAt(
        currentLead.nextFollowUpAt
          ? new Date(currentLead.nextFollowUpAt).toISOString().slice(0, 16)
          : ''
      );
      setSaveError(null);
    }
  }, [currentLead]);

  // Active call monitoring effect
  useEffect(() => {
    let pollInterval;

    const checkCallStatus = async () => {
      if (!activeCallId) return;
      try {
        const res = await callAPI.getCallLog(activeCallId).catch(() => null);
        const currentLog = res?.data?.data || res?.data;
        if (currentLog) {
          if (currentLog.callStatus === 'connected' && callState !== 'connected') {
            setCallState('connected');
          }
          const terminalStatuses = ['completed', 'no-answer', 'busy', 'failed', 'cancelled'];
          if (terminalStatuses.includes(currentLog.callStatus)) {
            setCallState('idle');
            setLastCompletedCall({
              id: currentLog.id,
              talkTimeSeconds: currentLog.durationSeconds || 0,
              lifecycleSeconds: currentLog.lifecycleDurationSeconds || 0,
              endedAt: currentLog.endedAt ? new Date(currentLog.endedAt) : new Date(),
              phone: currentLog.phoneNumber || calledPhone,
              callStatus: currentLog.callStatus
            });
            setActiveCallId(null);
            refetchLeadCalls();
            if (currentLog.callStatus === 'completed') {
              toast.success(`Call completed (${currentLog.durationSeconds || 0}s talk time)`);
            } else {
              toast.error(`Call ended: ${currentLog.callStatus.toUpperCase()}`);
            }
          }
        }
      } catch (e) {
        // Silent catch
      }
    };

    if (activeCallId) {
      pollInterval = setInterval(checkCallStatus, 1000);

      const handleVisibilityOrFocus = () => {
        if (document.visibilityState === 'visible') {
          checkCallStatus();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
      window.addEventListener('focus', handleVisibilityOrFocus);

      window.onNativeCallStateChange = (incomingCallId, incomingStatus, durationSecs) => {
        if (incomingCallId === activeCallId) {
          if (incomingStatus === 'connected') {
            setCallState('connected');
          } else if (['completed', 'no-answer', 'busy', 'failed', 'cancelled'].includes(incomingStatus)) {
            setCallState('idle');
            setLastCompletedCall({
              id: incomingCallId,
              talkTimeSeconds: durationSecs || 0,
              lifecycleSeconds: durationSecs || 0,
              endedAt: new Date(),
              phone: calledPhone,
              callStatus: incomingStatus
            });
            setActiveCallId(null);
            refetchLeadCalls();
            if (incomingStatus === 'completed') {
              toast.success(`Call completed (${durationSecs || 0}s talk time)`);
            } else {
              toast.error(`Call ended: ${incomingStatus.toUpperCase()}`);
            }
          }
        }
      };

      return () => {
        clearInterval(pollInterval);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        delete window.onNativeCallStateChange;
      };
    }
  }, [activeCallId, calledPhone, callState, refetchLeadCalls]);

  // Live talk timer
  useEffect(() => {
    let interval;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (name) => {
    if (!name) return 'LD';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getWhatsAppNumber = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const ensureE164 = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
  };

  const [showDefaultDialerModal, setShowDefaultDialerModal] = useState(false);

  // Start Call Handler
  const handleStartCall = async (phone, leadItem = null) => {
    const targetLead = leadItem || currentLead;
    if (!targetLead || callState !== 'idle') return;
    const sanitized = String(phone).replace(/[^0-9+]/g, '');

    if (window.AndroidCRM && typeof window.AndroidCRM.isDefaultDialerHeld === 'function') {
      const isHeld = window.AndroidCRM.isDefaultDialerHeld();
      if (!isHeld) {
        setShowDefaultDialerModal(true);
        return;
      }
    }

    setCalledPhone(sanitized);
    setCallState('initiating');

    try {
      const callData = await startCrmCall({ ...targetLead, phone: sanitized });
      if (callData?.id) {
        setActiveCallId(callData.id);
        setCallState('ringing');
      } else {
        window.location.href = `tel:${sanitized}`;
        setCallState('ringing');
      }
    } catch (err) {
      window.location.href = `tel:${sanitized}`;
      setCallState('ringing');
    }
  };

  const [lastCompletedCall, setLastCompletedCall] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // End Call Handler
  const handleEndCall = async (dispositionOutcome = 'completed') => {
    if (!activeCallId) {
      setCallState('idle');
      return;
    }
    const endingCallId = activeCallId;
    const talkSecs = callTimer;
    const finalOutcome = callState === 'connected'
      ? dispositionOutcome
      : (dispositionOutcome === 'completed' ? 'cancelled' : dispositionOutcome);

    try {
      const res = await callAPI.updateCallState(endingCallId, {
        callStatus: finalOutcome,
        endedAt: new Date(),
        durationSeconds: talkSecs,
        connectedAt: talkSecs > 0 ? new Date(Date.now() - talkSecs * 1000) : null,
        disposition: disposition || status || 'Call Worked',
        notes: notes || ''
      }).catch(err => {
        console.warn('[LeadQueueView] Soft call state update catch:', err);
        return null;
      });

      const updatedLog = res?.data?.data || res?.data;
      setLastCompletedCall({
        id: endingCallId,
        talkTimeSeconds: updatedLog?.durationSeconds ?? talkSecs,
        lifecycleSeconds: updatedLog?.lifecycleDurationSeconds ?? talkSecs,
        endedAt: updatedLog?.endedAt ? new Date(updatedLog.endedAt) : new Date(),
        phone: calledPhone,
        callStatus: updatedLog?.callStatus || finalOutcome
      });

      if (window.AndroidCRM?.endCall && endingCallId) {
        window.AndroidCRM.endCall(endingCallId);
      }
      if (window.AndroidCRM?.stopAndUploadCallRecording && endingCallId) {
        const token = localStorage.getItem('token') || '';
        const uploadUrl = `${window.location.origin}/api/calls/${endingCallId}/upload-audio`;
        window.AndroidCRM.stopAndUploadCallRecording(endingCallId, uploadUrl, token);
      }

      refetchLeadCalls();
      refetchLeadDetails();
      toast.success('Call logged successfully.');
    } catch (err) {
      toast.success('Call status saved.');
    } finally {
      setActiveCallId(null);
      setCallState('idle');
    }
  };

  // Save Lead Handler
  const handleSaveLead = async (advanceNext = false) => {
    if (!currentLead) return;
    setSaving(true);
    setSaveError(null);

    const requiresFollowUp = status === 'follow-up' || disposition.toLowerCase().includes('follow-up') || disposition.toLowerCase().includes('callback');
    if (requiresFollowUp && !nextFollowUpAt) {
      const errMsg = 'Please specify Next Follow-up Date & Time before saving.';
      setSaveError(errMsg);
      toast.error(errMsg);
      setSaving(false);
      return;
    }

    const payload = {
      status,
      disposition,
      campus,
      assignedTo: leadOwnerId || currentLead.assignedTo,
      tags,
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
      notes
    };

    try {
      await leadAPI.updateLead(currentLead.id, payload);
      toast.success(advanceNext ? 'Lead saved. Moving to next lead...' : 'Lead saved successfully');

      if (advanceNext) {
        if (currentIndex < queue.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          toast.success('Queue processing complete!');
          await refetchQueue();
        }
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to save lead. Please retry.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Add Tag Handler
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const cleanTag = newTagInput.trim();
    if (!tags.includes(cleanTag)) {
      const updated = [...tags, cleanTag];
      setTags(updated);
      leadAPI.updateLead(currentLead.id, { tags: updated }).then(() => {
        toast.success(`Tag '${cleanTag}' added`);
      });
    }
    setNewTagInput('');
    setShowAddTagModal(false);
  };

  const handleRemoveTag = (tagToRemove) => {
    const updated = tags.filter(t => t !== tagToRemove);
    setTags(updated);
    leadAPI.updateLead(currentLead.id, { tags: updated });
  };

  // Add Quick Note Handler
  const handleAddQuickNote = async () => {
    if (!quickNoteContent.trim() || !currentLead) return;
    setAddingNote(true);
    try {
      await leadAPI.addActivity(currentLead.id, {
        type: 'note',
        description: quickNoteContent.trim()
      });
      toast.success('Note added successfully');
      setQuickNoteContent('');
      setShowQuickNoteModal(false);
      refetchLeadDetails();
    } catch (err) {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  // Add Quick Task Handler
  const handleAddQuickTask = async () => {
    if (!quickTaskTitle.trim() || !currentLead) return;
    setAddingTask(true);
    try {
      await leadAPI.addActivity(currentLead.id, {
        type: 'task',
        description: `Task: ${quickTaskTitle.trim()}${quickTaskDueDate ? ` (Due: ${quickTaskDueDate})` : ''}`
      });
      toast.success('Task created successfully');
      setQuickTaskTitle('');
      setQuickTaskDueDate('');
      setShowQuickTaskModal(false);
      refetchLeadDetails();
    } catch (err) {
      toast.error('Failed to create task');
    } finally {
      setAddingTask(false);
    }
  };

  // Record Structured Payment Handler
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!currentLead) return;
    setRecordingPayment(true);

    try {
      const amt = parseFloat(paymentAmount);
      if (isNaN(amt) || amt <= 0) {
        toast.error('Please enter a valid positive payment amount');
        setRecordingPayment(false);
        return;
      }

      const res = await paymentAPI.recordPayment({
        leadId: currentLead.id,
        paymentType,
        amount: amt,
        referenceId: paymentRef,
        notes: `Recorded ${paymentType} fee`
      });

      if (res.data?.success) {
        toast.success(res.data.message);
        setPaymentRef('');
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const isMissedFollowUp = (lead) => {
    if (!lead?.nextFollowUpAt) return false;
    return isBefore(new Date(lead.nextFollowUpAt), new Date());
  };

  // Group call logs by date
  const groupLogsByDate = (logs) => {
    const groups = {};
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    logs.forEach(log => {
      const logDate = log.startedAt || log.createdAt;
      if (!logDate) return;
      const d = new Date(logDate);
      const dateKey = format(d, 'yyyy-MM-dd');

      let displayHeader = format(d, 'MMMM dd, yyyy');
      if (dateKey === todayStr) displayHeader = 'TODAY';
      else if (dateKey === yesterdayStr) displayHeader = 'YESTERDAY';

      if (!groups[displayHeader]) groups[displayHeader] = [];
      groups[displayHeader].push(log);
    });

    return groups;
  };

  // Group activities by date
  const groupActivitiesByDate = (activities) => {
    const groups = {};
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    (activities || []).forEach(act => {
      const d = new Date(act.createdAt);
      const dateKey = format(d, 'yyyy-MM-dd');
      let displayHeader = format(d, 'MMM dd, yyyy');
      if (dateKey === todayStr) displayHeader = 'TODAY';

      if (!groups[displayHeader]) groups[displayHeader] = [];
      groups[displayHeader].push(act);
    });

    return groups;
  };

  if (loading && !queue.length) {
    return (
      <div className="p-8 text-center text-gray-400 animate-pulse font-medium">
        Loading Call History & Working Queue...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-8 relative">

      {/* ========================================================================= */}
      {/* 1. FRONT VIEW: CALL HISTORY & ALL CALLS LIST VIEW (MATCHING SCREENSHOT 4) */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {/* Header Bar */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">Call History</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  {queue.length} Queue Leads
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/salesperson/call-setup')}
                  className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span>HELP</span>
                </button>
                <button
                  type="button"
                  onClick={() => refetchQueue()}
                  title="Refresh Calls List"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Rounded Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone or product..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 text-white placeholder-slate-400 text-xs font-medium rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* List Filter Sub-Tabs (All Calls | My Calls | AI Agent | Call Back) - Screenshot 4 */}
            <div className="flex items-center justify-around border-t border-slate-800 pt-2 text-xs font-bold text-slate-400">
              {[
                { key: 'all', label: 'All Calls' },
                { key: 'my', label: 'My Calls' },
                { key: 'ai', label: 'AI Agent' },
                { key: 'callback', label: 'Call Back' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setListTabFilter(tab.key)}
                  className={`pb-1 px-2.5 transition-all relative ${
                    listTabFilter === tab.key ? 'text-white font-extrabold' : 'hover:text-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  {listTabFilter === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* CALLS & LEADS LIST (Matching Screenshot 4) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {filteredQueue.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium space-y-2">
                <Phone className="h-8 w-8 mx-auto text-gray-300" />
                <div>No leads found in this filter view.</div>
              </div>
            ) : (
              filteredQueue.map((lead, idx) => {
                const totalCallsCount = (lead.callLogsCount || lead.callCount || (lead.lastCalled ? 2 : 1));
                const hasRecording = lead.hasRecordings || lead.recordingStatus === 'available';
                const isMissed = lead.status === 'follow-up' || isMissedFollowUp(lead);
                const isConnected = lead.status === 'contacted' || lead.status === 'registered';

                return (
                  <div
                    key={lead.id}
                    onClick={() => {
                      setCurrentIndex(queue.findIndex(l => l.id === lead.id));
                      setViewMode('detail');
                    }}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    {/* Left Side: Direction Arrow & Lead Details */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                      {/* Status Arrow Icon */}
                      <div className="shrink-0">
                        {isConnected ? (
                          <ArrowUpRight className="h-6 w-6 text-emerald-500 stroke-[2.5]" />
                        ) : isMissed ? (
                          <PhoneMissed className="h-6 w-6 text-red-500 stroke-[2.5]" />
                        ) : (
                          <ArrowUpRight className="h-6 w-6 text-slate-400 stroke-[2.5]" />
                        )}
                      </div>

                      {/* Lead Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm text-gray-900 truncate">
                            {lead.name}
                          </span>
                          <span className="text-xs font-bold text-gray-500 shrink-0">
                            ({totalCallsCount})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>
                            {lead.lastContactedAt
                              ? format(new Date(lead.lastContactedAt), 'hh:mm a')
                              : (lead.updatedAt ? format(new Date(lead.updatedAt), 'hh:mm a') : '12:05 pm')}
                          </span>

                          {/* Agent Avatar Circle + Name */}
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white font-bold text-[8px] flex items-center justify-center">
                              {lead.salesperson?.name ? lead.salesperson.name[0] : 'A'}
                            </span>
                            <span>{lead.salesperson?.name || 'Anila'}</span>
                          </span>

                          {/* Red REC Badge if Available */}
                          {hasRecording && (
                            <span className="px-1.5 py-0.2 bg-red-100 text-red-700 text-[9px] font-black rounded border border-red-200 flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                              <span>REC</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Round Call Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCall(lead.phone, lead);
                      }}
                      title="Call Lead"
                      className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200 transition-transform active:scale-95 shadow-2xs"
                    >
                      <Phone className="h-5 w-5 fill-current" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* FLOATING 9-DOT KEYPAD DIALER BUTTON (Screenshot 4) */}
          <button
            type="button"
            onClick={() => setShowKeypadModal(true)}
            title="Open Phone Keypad Dialer"
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl flex items-center justify-center z-40 transition-transform active:scale-95 border-2 border-white"
          >
            <Grid className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DETAIL VIEW: SINGLE LEAD WORKSPACE (MATCHING SCREENSHOTS 1, 2, 3)     */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && (
        <div className="space-y-3">
          
          {/* Back to Call History Button Bar */}
          <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Call History</span>
            </button>

            {/* Queue Prev / Next Navigation */}
            <div className="flex items-center gap-2">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="px-2.5 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-30 text-xs font-bold transition-colors"
              >
                ‹ Prev
              </button>
              <span className="font-black text-gray-900 text-xs px-2 py-0.5 bg-gray-100 rounded-md">
                {currentIndex + 1} of {queue.length}
              </span>
              <button
                disabled={currentIndex >= queue.length - 1}
                onClick={() => setCurrentIndex(prev => Math.min(queue.length - 1, prev + 1))}
                className="px-2.5 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-30 text-xs font-bold transition-colors"
              >
                Next ›
              </button>
            </div>
          </div>

          {currentLead && (
            /* SHARED MOBILE DESIGN CARD */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              
              {/* GRADIENT COVER & LEAD PROFILE HEADER (Matching Screenshot 2) */}
              <div className="bg-gradient-to-b from-blue-100/70 via-indigo-50/40 to-white px-4 pt-6 pb-4 text-center space-y-3">
                
                {/* Large Avatar Badge */}
                <div className="w-16 h-16 rounded-full bg-amber-800 text-white font-black text-2xl flex items-center justify-center mx-auto shadow-md border-2 border-white">
                  {getInitials(currentLead.name)}
                </div>

                {/* Lead Title & Name */}
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight leading-tight">
                    {currentLead.name}
                  </h2>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddTagModal(true)}
                      className="px-3 py-1 bg-white/90 hover:bg-white text-blue-700 text-xs font-bold rounded-lg border border-blue-200/80 shadow-2xs flex items-center gap-1 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5 text-blue-600" />
                      <span>Add Tags</span>
                    </button>

                    {tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                        <span>{t}</span>
                        <X className="h-3 w-3 cursor-pointer hover:text-red-600" onClick={() => handleRemoveTag(t)} />
                      </span>
                    ))}
                  </div>
                </div>

                {/* Lead Owner & Lead Stage Pill Selectors */}
                <div className="grid grid-cols-2 gap-2 pt-1 max-w-md mx-auto">
                  <div className="bg-white/90 p-2 rounded-xl border border-gray-200/80 text-left shadow-2xs">
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-0.5">LEAD OWNER</label>
                    <select
                      value={leadOwnerId}
                      onChange={(e) => setLeadOwnerId(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-gray-800 focus:outline-none cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {salespeople.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-amber-50/80 p-2 rounded-xl border border-amber-200/80 text-left shadow-2xs">
                    <label className="block text-[9px] font-black text-amber-700 uppercase tracking-wider mb-0.5">LEAD STAGE</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-gray-900 focus:outline-none cursor-pointer"
                    >
                      <option value="fresh">Fresh</option>
                      <option value="follow-up">Contacted / Follow-up</option>
                      <option value="registered">Registered</option>
                    </select>
                  </div>
                </div>

                {/* 3 Circular Quick Action Buttons (Matching Screenshot 2) */}
                <div className="flex items-center justify-center gap-5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickNoteModal(true)}
                    title="Add Note or Task"
                    className="w-12 h-12 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-sm hover:shadow flex items-center justify-center transition-all active:scale-95"
                  >
                    <FileText className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartCall(currentLead.phone)}
                    title="Call Lead"
                    className="w-12 h-12 rounded-full border border-gray-900 bg-gray-900 hover:bg-black text-white shadow-md hover:shadow-lg flex items-center justify-center transition-all active:scale-95"
                  >
                    <Phone className="h-5 w-5 fill-current" />
                  </button>

                  <a
                    href={`https://wa.me/${getWhatsAppNumber(currentLead.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open WhatsApp"
                    className="w-12 h-12 rounded-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 shadow-sm hover:shadow flex items-center justify-center transition-all active:scale-95"
                  >
                    <MessageCircle className="h-5 w-5 fill-current" />
                  </a>
                </div>
              </div>

              {/* SHARED NAVIGATION TABS (DETAIL | ACTIVITY | CALLS | LEAD INFO) */}
              <div className="flex items-center justify-around border-b border-gray-200 bg-white px-2 pt-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                {['DETAIL', 'ACTIVITY', 'CALLS', 'LEAD INFO'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveTab(t)}
                    className={`pb-2.5 px-3 transition-colors relative ${
                      activeTab === t ? 'text-blue-700 font-black' : 'hover:text-gray-900'
                    }`}
                  >
                    <span>{t}</span>
                    {activeTab === t && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT PANELS */}
              <div className="p-4 space-y-4">

                {/* -------------------- TAB 1: DETAIL -------------------- */}
                {activeTab === 'DETAIL' && (
                  <div className="space-y-4">
                    {/* Phone Row */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white border border-gray-200 text-gray-700">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-mono text-sm font-bold text-gray-900">{currentLead.phone}</div>
                          <div className="text-[10px] font-semibold text-gray-400 uppercase">Phone</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(currentLead.phone);
                            toast.success('Phone number copied');
                          }}
                          title="Copy Phone Number"
                          className="p-2 bg-white hover:bg-gray-100 rounded-lg border border-gray-200 text-gray-600 transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <a
                          href={`https://wa.me/${getWhatsAppNumber(currentLead.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 text-emerald-600 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    {/* Telephony Action & Live Call Status */}
                    <div className="space-y-2">
                      {callState === 'idle' ? (
                        <div className="space-y-2">
                          <button
                            onClick={() => handleStartCall(currentLead.phone)}
                            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black text-sm tracking-wide transition-all shadow hover:shadow-md active:scale-98 flex items-center justify-center gap-2"
                          >
                            <Phone className="h-4.5 w-4.5" />
                            <span>CALL NOW</span>
                          </button>

                          {/* Recent Completed Call Summary */}
                          {lastCompletedCall && (
                            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5">
                                <span className="font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                  CALL COMPLETED ({lastCompletedCall.endedAt ? format(new Date(lastCompletedCall.endedAt), 'hh:mm a') : 'Just now'})
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-center py-1">
                                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Talk Time</span>
                                  <span className="text-sm font-black text-emerald-700">{formatTimer(lastCompletedCall.talkTimeSeconds || 0)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-emerald-100">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Duration</span>
                                  <span className="text-sm font-black text-gray-900">{formatTimer(lastCompletedCall.lifecycleSeconds || 0)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-red-700 uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                              {callState === 'connected' ? `CONNECTED ${formatTimer(callTimer)}` : 'RINGING...'}
                            </span>
                            <button
                              onClick={() => handleEndCall('completed')}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-md flex items-center gap-1 transition-colors"
                            >
                              <PhoneOff className="h-3.5 w-3.5" />
                              <span>END CALL</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Disposition Chips */}
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Call Disposition Outcome
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {(dispositions.length > 0 ? dispositions : [
                          { label: 'Connected', category: 'connected' },
                          { label: 'Follow-up Required', category: 'callback' },
                          { label: 'Call Back Requested', category: 'callback' },
                          { label: 'Interested', category: 'connected' },
                          { label: 'RNR (Ring No Response)', category: 'no_answer' },
                          { label: 'Busy', category: 'busy' },
                          { label: 'No Answer', category: 'no_answer' },
                          { label: 'Not Interested', category: 'not_interested' },
                          { label: 'Registered', category: 'registered' },
                          { label: 'Duplicate Lead', category: 'other' },
                          { label: 'Wrong Number', category: 'other' }
                        ]).map((d) => {
                          const isSelected = disposition === d.label;
                          return (
                            <button
                              key={d.label}
                              type="button"
                              onClick={() => {
                                setDisposition(d.label);
                                if (d.category === 'registered') setStatus('registered');
                                else if (d.requiresFollowUp || d.category === 'callback' || d.label.toLowerCase().includes('follow-up') || d.label.toLowerCase().includes('call back')) {
                                  setStatus('follow-up');
                                }
                              }}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-red-700 text-white border-red-700 shadow-sm'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                              <span>{d.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Follow-up & Campus Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gray-100">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Campus</label>
                        <select
                          value={campus}
                          onChange={(e) => setCampus(e.target.value)}
                          className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-white"
                        >
                          <option value="Kochi">Kochi</option>
                          <option value="Chennai">Chennai</option>
                        </select>
                      </div>

                      <div className={(status === 'follow-up' || disposition.toLowerCase().includes('follow-up') || disposition.toLowerCase().includes('call back')) ? 'ring-2 ring-red-500 rounded-lg p-0.5' : ''}>
                        <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                          Next Follow-up Date & Time {(status === 'follow-up' || disposition.toLowerCase().includes('follow-up') || disposition.toLowerCase().includes('call back')) && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="datetime-local"
                          value={nextFollowUpAt}
                          onChange={(e) => setNextFollowUpAt(e.target.value)}
                          className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-white ${saveError && !nextFollowUpAt ? 'border-red-500' : ''}`}
                        />
                      </div>
                    </div>

                    {/* Call Notes */}
                    <div className="pt-2 border-t border-gray-100">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Call Notes</label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add call notes, objections, or next steps..."
                        className="w-full px-3 py-2 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary-500"
                      />
                    </div>

                    {/* Collapsible Payment Widget */}
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setIsPaymentExpanded(prev => !prev)}
                        className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-800 border border-gray-200 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary-600" />
                          <span>Structured Payment Entry</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-700 font-extrabold">₹{(currentLead.paidAmount || 0).toLocaleString('en-IN')}</span>
                          {isPaymentExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>

                      {isPaymentExpanded && (
                        <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2.5">
                          <select
                            value={paymentType}
                            onChange={(e) => setPaymentType(e.target.value)}
                            className="px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-white"
                          >
                            <option value="admission">Admission Fee</option>
                            <option value="orientation">Orientation Fee</option>
                            <option value="tuition">Tuition Fee</option>
                          </select>

                          <input
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            className="px-2.5 py-1.5 border rounded-lg text-xs font-bold bg-white"
                            placeholder="Amount ₹"
                            min="1"
                          />

                          <input
                            type="text"
                            value={paymentRef}
                            onChange={(e) => setPaymentRef(e.target.value)}
                            className="px-2.5 py-1.5 border rounded-lg text-xs bg-white"
                            placeholder="UPI / Ref ID"
                          />

                          <button
                            type="submit"
                            disabled={recordingPayment}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            <IndianRupee className="h-3.5 w-3.5" />
                            <span>{recordingPayment ? 'Recording...' : 'Record Payment'}</span>
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------- TAB 2: ACTIVITY -------------------- */}
                {activeTab === 'ACTIVITY' && (
                  <div className="space-y-4">
                    {/* Activity Sub-Tabs (History | Notes | Tasks) - Matching Screenshot 3 */}
                    <div className="flex items-center justify-center border border-purple-200 rounded-xl p-1 bg-purple-50/50 text-xs font-bold max-w-sm mx-auto">
                      {['History', 'Notes', 'Tasks'].map(sub => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setActiveActivitySubTab(sub)}
                          className={`flex-1 py-1.5 rounded-lg transition-all ${
                            activeActivitySubTab === sub
                              ? 'bg-purple-600 text-white shadow-xs font-black'
                              : 'text-purple-800 hover:bg-purple-100/60'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>

                    {/* HISTORY SUB-TAB */}
                    {activeActivitySubTab === 'History' && (
                      <div className="space-y-4">
                        {Object.entries(groupActivitiesByDate(leadFullDetails?.activities || [])).length === 0 ? (
                          <div className="text-center py-6 text-xs text-gray-400 font-medium">
                            No activity history recorded for this lead yet.
                          </div>
                        ) : (
                          Object.entries(groupActivitiesByDate(leadFullDetails?.activities || [])).map(([dateGroup, items]) => (
                            <div key={dateGroup} className="space-y-2">
                              <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                                {dateGroup}
                              </div>

                              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                                {items.map(act => (
                                  <div key={act.id} className="relative text-xs space-y-0.5">
                                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-white border-2 border-purple-400" />
                                    <div className="font-bold text-gray-900">
                                      {act.description || act.type}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                      {act.user && (
                                        <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                                          <span className="w-4 h-4 rounded-full bg-purple-500 text-white text-[9px] font-bold flex items-center justify-center">
                                            {act.user.name ? act.user.name[0] : 'U'}
                                          </span>
                                          <span>{act.user.name}</span>
                                        </span>
                                      )}
                                      <span>{format(new Date(act.createdAt), 'hh:mm a')}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* NOTES SUB-TAB */}
                    {activeActivitySubTab === 'Notes' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                          <textarea
                            rows={2}
                            value={quickNoteContent}
                            onChange={(e) => setQuickNoteContent(e.target.value)}
                            placeholder="Type a new activity note for this lead..."
                            className="w-full p-2.5 bg-white border rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            disabled={addingNote || !quickNoteContent.trim()}
                            onClick={handleAddQuickNote}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{addingNote ? 'Adding...' : 'Add Note'}</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(leadFullDetails?.activities || []).filter(a => a.type === 'note').map(note => (
                            <div key={note.id} className="p-3 bg-white rounded-xl border border-gray-200 text-xs space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                                <span className="font-bold text-gray-800">{note.user?.name || 'User'}</span>
                                <span>{format(new Date(note.createdAt), 'MMM dd, hh:mm a')}</span>
                              </div>
                              <p className="text-gray-800 font-normal leading-relaxed">{note.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TASKS SUB-TAB */}
                    {activeActivitySubTab === 'Tasks' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                          <input
                            type="text"
                            value={quickTaskTitle}
                            onChange={(e) => setQuickTaskTitle(e.target.value)}
                            placeholder="Follow-up task title..."
                            className="w-full p-2 bg-white border rounded-lg text-xs"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={quickTaskDueDate}
                              onChange={(e) => setQuickTaskDueDate(e.target.value)}
                              className="flex-1 p-2 bg-white border rounded-lg text-xs"
                            />
                            <button
                              type="button"
                              disabled={addingTask || !quickTaskTitle.trim()}
                              onClick={handleAddQuickTask}
                              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>{addingTask ? 'Creating...' : 'Create Task'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {(leadFullDetails?.activities || []).filter(a => a.type === 'task' || (a.description && a.description.startsWith('Task:'))).map(task => (
                            <div key={task.id} className="p-3 bg-white rounded-xl border border-gray-200 text-xs flex items-center justify-between">
                              <div className="space-y-0.5">
                                <div className="font-bold text-gray-900">{task.description}</div>
                                <div className="text-[11px] text-gray-500">Created {format(new Date(task.createdAt), 'MMM dd, hh:mm a')}</div>
                              </div>
                              <CheckCircle className="h-4 w-4 text-purple-600" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------- TAB 3: CALLS (Matching Screenshot 1) -------------------- */}
                {activeTab === 'CALLS' && (
                  <div className="space-y-4">
                    {Object.entries(groupLogsByDate(leadCallLogs)).length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-400 font-medium space-y-2">
                        <Phone className="h-8 w-8 mx-auto text-gray-300" />
                        <div>No call history records found for this lead.</div>
                      </div>
                    ) : (
                      Object.entries(groupLogsByDate(leadCallLogs)).map(([dateHeader, logs]) => (
                        <div key={dateHeader} className="space-y-2">
                          <div className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                            {dateHeader}
                          </div>

                          <div className="divide-y divide-gray-100 bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {logs.map(log => {
                              const isAnswered = log.callStatus === 'completed' && log.durationSeconds > 0;
                              const isMissed = log.callStatus === 'no-answer' || log.callStatus === 'busy' || log.callStatus === 'failed';
                              const hasRecording = log.recordingUrl || log.recordingStatus === 'available';

                              return (
                                <div key={log.id} className="p-3 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
                                  {/* Direction Arrow & Details */}
                                  <div className="flex items-center gap-3">
                                    {isAnswered ? (
                                      <ArrowUpRight className="h-5 w-5 text-emerald-500 stroke-[2.5]" />
                                    ) : isMissed ? (
                                      <PhoneMissed className="h-5 w-5 text-red-500 stroke-[2.5]" />
                                    ) : (
                                      <ArrowUpRight className="h-5 w-5 text-gray-400 stroke-[2.5]" />
                                    )}

                                    <div>
                                      <div className="font-mono font-bold text-xs text-gray-900">
                                        {log.phoneNumber || currentLead.phone}
                                      </div>
                                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                        <span>{log.startedAt ? format(new Date(log.startedAt), 'hh:mm a') : 'N/A'}</span>
                                        <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded text-[10px]">
                                          <span className="w-3.5 h-3.5 rounded-full bg-blue-600 text-white font-bold text-[8px] flex items-center justify-center">
                                            {log.User?.name ? log.User.name[0] : 'A'}
                                          </span>
                                          <span>{log.User?.name || 'Agent'}</span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Side: Duration & Audio Player Button */}
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-gray-700 font-mono">
                                      {log.durationSeconds ? `${log.durationSeconds}s` : '0s'}
                                    </span>

                                    {/* Red/Pink REC Play Badge (Matching Screenshot 1) */}
                                    {hasRecording && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const token = localStorage.getItem('token') || '';
                                          const audioUrl = `${window.location.origin}/api/calls/${log.id}/audio?token=${token}`;
                                          setPlayingCallId(log.id);
                                          setPlayingAudioUrl(audioUrl);
                                        }}
                                        className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 border border-red-200 rounded-md text-[11px] font-black flex items-center gap-1 shadow-2xs transition-colors"
                                      >
                                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                        <span>REC</span>
                                        <Play className="h-3 w-3 fill-current ml-0.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* -------------------- TAB 4: LEAD INFO -------------------- */}
                {activeTab === 'LEAD INFO' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Product / Course</div>
                        <div className="font-bold text-gray-900">{currentLead.product || 'Data Science'}</div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Campus Location</div>
                        <div className="font-bold text-gray-900">{currentLead.campus || 'Kochi'}</div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Email Address</div>
                        <div className="font-bold text-gray-900 font-mono">{currentLead.email || 'N/A'}</div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Country</div>
                        <div className="font-bold text-gray-900">{currentLead.country || 'India'}</div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Lead Source</div>
                        <div className="font-bold text-gray-900">{currentLead.source || 'Organic'}</div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Total Payments Received</div>
                        <div className="font-extrabold text-emerald-700 text-sm">₹{(currentLead.paidAmount || 0).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* STICKY BOTTOM SAVE ACTION BAR */}
          <div className="fixed bottom-14 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-gray-200 z-30 shadow-lg md:static md:p-0 md:bg-transparent md:border-0 md:shadow-none">
            <div className="max-w-4xl mx-auto flex items-center justify-end gap-3 px-3 md:px-0">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveLead(false)}
                className="flex-1 md:flex-none px-5 py-2.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Save className="h-4 w-4 text-gray-500" />
                <span>{saving ? 'Saving...' : 'SAVE'}</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveLead(true)}
                className="flex-1 md:flex-none px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg active:scale-98"
              >
                <span>{saving ? 'Processing...' : 'SAVE & NEXT'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. COMMON MODALS (KEYPAD DIALPAD, AUDIO PLAYER, ADD TAG, QUICK NOTE)      */}
      {/* ========================================================================= */}

      {/* FLOATING 9-DOT KEYPAD DIALER OVERLAY MODAL */}
      {showKeypadModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xs w-full p-6 text-white shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Phone Keypad Dialer</span>
              <button onClick={() => setShowKeypadModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Display Number */}
            <div className="flex items-center justify-between bg-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-700">
              <span className="font-mono text-lg font-bold text-white tracking-widest min-h-[28px] flex items-center">
                {keypadInput || <span className="text-slate-500 text-xs font-sans">Enter phone number...</span>}
              </span>
              {keypadInput && (
                <button onClick={() => setKeypadInput(prev => prev.slice(0, -1))} className="text-slate-400 hover:text-white p-1">
                  <Delete className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* 9-Dot Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 py-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(digit => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => setKeypadInput(prev => prev + digit)}
                  className="w-full h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg flex items-center justify-center transition-colors border border-slate-700/60 active:scale-95"
                >
                  {digit}
                </button>
              ))}
            </div>

            {/* Call Action Button */}
            <button
              type="button"
              disabled={!keypadInput.trim()}
              onClick={() => {
                setShowKeypadModal(false);
                handleStartCall(keypadInput.trim(), { id: 'manual', name: 'Manual Dialed Number', phone: keypadInput.trim() });
                setKeypadInput('');
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
            >
              <Phone className="h-4.5 w-4.5 fill-current" />
              <span>CALL NOW</span>
            </button>
          </div>
        </div>
      )}

      {/* AUDIO PLAYER MODAL */}
      {playingAudioUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2 font-bold text-xs text-gray-900">
                <Volume2 className="h-4 w-4 text-red-600" />
                <span>Call Recording Playback</span>
              </div>
              <button
                onClick={() => { setPlayingAudioUrl(null); setPlayingCallId(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <audio
              ref={audioRef}
              controls
              autoPlay
              src={playingAudioUrl}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* ADD TAG MODAL */}
      {showAddTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-gray-900">Add Lead Tag</h3>
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              placeholder="Tag name (e.g. VIP, Hot Lead)..."
              className="w-full p-2 border rounded-lg text-xs"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddTag}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
              >
                Add Tag
              </button>
              <button
                type="button"
                onClick={() => setShowAddTagModal(false)}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK NOTE MODAL */}
      {showQuickNoteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-purple-600" />
                Quick Note for {currentLead?.name}
              </h3>
              <button onClick={() => setShowQuickNoteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              rows={3}
              value={quickNoteContent}
              onChange={(e) => setQuickNoteContent(e.target.value)}
              placeholder="Enter activity note..."
              className="w-full p-2.5 border rounded-lg text-xs"
            />
            <button
              type="button"
              disabled={addingNote || !quickNoteContent.trim()}
              onClick={handleAddQuickNote}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
            >
              {addingNote ? 'Adding Note...' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* DEFAULT DIALER MODAL */}
      {showDefaultDialerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 mx-auto">
              <PhoneCall className="w-7 h-7" />
            </div>
            
            <h3 className="text-xl font-bold text-center text-slate-100 mb-2">
              Default Phone App Required
            </h3>
            
            <p className="text-xs text-slate-400 text-center leading-relaxed mb-6">
              To place calls directly, track exact talk duration, and record call audio natively, <strong className="text-amber-300 font-semibold">Academy Sales CRM</strong> must be configured as your default phone app.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowDefaultDialerModal(false);
                  if (window.AndroidCRM?.requestDefaultDialer) {
                    window.AndroidCRM.requestDefaultDialer();
                  }
                }}
                className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-black rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                <span>SET AS DEFAULT PHONE APP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDefaultDialerModal(false);
                  navigate('/salesperson/call-setup');
                }}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                <span>Open Telephony Setup Wizard</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDefaultDialerModal(false)}
                className="w-full py-2 text-slate-500 hover:text-slate-400 text-[11px] font-medium text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LeadQueueView;
