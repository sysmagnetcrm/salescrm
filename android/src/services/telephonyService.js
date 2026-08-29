import { androidApi } from './apiClient.js';

// Native Android Telephony Call Lifecycle Bridge
export class AndroidTelephonyService {
  constructor() {
    this.activeCall = null;
  }

  async initiateCall(leadId, phoneNumber) {
    if (this.activeCall) {
      throw new Error('Another call is currently active on device.');
    }

    const startedAt = new Date().toISOString();
    const res = await androidApi.request('/calls', {
      method: 'POST',
      body: {
        leadId,
        phoneNumber,
        callDirection: 'outbound',
        callStatus: 'initiated',
        startedAt
      }
    });

    if (res?.success && res.data) {
      this.activeCall = {
        id: res.data.id,
        leadId,
        phoneNumber,
        startedAt: new Date(startedAt),
        ringingAt: null,
        connectedAt: null,
        status: 'initiated'
      };
      return this.activeCall;
    }
    throw new Error('Failed to initiate call via telephony service.');
  }

  async updateState(status, extraData = {}) {
    if (!this.activeCall) {
      throw new Error('No active call found on device.');
    }

    const now = new Date();
    if (status === 'ringing' && !this.activeCall.ringingAt) {
      this.activeCall.ringingAt = now;
    } else if (status === 'connected' && !this.activeCall.connectedAt) {
      this.activeCall.connectedAt = now;
    }

    this.activeCall.status = status;

    const payload = {
      callStatus: status,
      ringingAt: this.activeCall.ringingAt,
      connectedAt: this.activeCall.connectedAt,
      endedAt: ['completed', 'no-answer', 'busy', 'failed', 'cancelled'].includes(status) ? now : undefined,
      ...extraData
    };

    const res = await androidApi.request(`/calls/${this.activeCall.id}`, {
      method: 'PUT',
      body: payload
    });

    if (['completed', 'no-answer', 'busy', 'failed', 'cancelled'].includes(status)) {
      this.activeCall = null;
    }

    return res;
  }

  getTalkTimeSeconds() {
    if (!this.activeCall || !this.activeCall.connectedAt) return 0;
    return Math.floor((Date.now() - this.activeCall.connectedAt.getTime()) / 1000);
  }
}

export const telephonyService = new AndroidTelephonyService();
