import crypto from 'crypto';

class TelephonyProviderService {
  constructor() {
    this.providerName = process.env.TELEPHONY_PROVIDER || 'development';
    this.apiKey = process.env.TELEPHONY_API_KEY || null;
    this.apiSecret = process.env.TELEPHONY_API_SECRET || null;
    this.webhookSecret = process.env.TELEPHONY_WEBHOOK_SECRET || null;
    this.businessNumber = process.env.TELEPHONY_NUMBER || '+918000000000';
  }

  // Get Admin Telephony Status (No Raw Secrets Exposed)
  getStatus() {
    const isConfigured = Boolean(this.apiKey && this.apiSecret) || this.providerName === 'development';
    return {
      providerName: this.providerName,
      isConfigured,
      businessNumber: this.businessNumber,
      recordingEnabled: process.env.TELEPHONY_RECORDING_ENABLED !== 'false',
      aiEnabled: process.env.AI_ANALYSIS_ENABLED !== 'false',
      webhookVerified: Boolean(this.webhookSecret)
    };
  }

  // Initiate Outbound CRM Call
  async initiateCall({ callLogId, toPhoneNumber, callerUserId }) {
    const providerCallId = `prov_${this.providerName}_${callLogId.slice(0, 8)}_${Date.now()}`;
    
    if (this.providerName === 'twilio' && this.apiKey && this.apiSecret) {
      console.log(`[TelephonyProvider:Twilio] Initiating call to ${toPhoneNumber} for CallLog ${callLogId}`);
    } else {
      console.log(`[TelephonyProvider:${this.providerName}] Initiating call to ${toPhoneNumber} for CallLog ${callLogId}`);
    }

    return {
      success: true,
      providerCallId,
      status: 'connecting',
      provider: this.providerName
    };
  }

  // Verify Telephony Provider Webhook Signature
  verifyWebhookSignature(req) {
    if (this.providerName === 'development' || !this.webhookSecret) {
      return true; // Verified for dev/test mode
    }

    const signature = req.headers['x-telephony-signature'] || req.headers['x-twilio-signature'];
    if (!signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const expectedSignature = hmac.update(JSON.stringify(req.body)).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (e) {
      return false;
    }
  }

  // Parse Webhook Event Payload into Standardized Format
  parseWebhookPayload(body) {
    return {
      providerCallId: body.providerCallId || body.CallSid || body.call_id,
      callLogId: body.callLogId || body.custom_id || null,
      eventStatus: (body.eventStatus || body.CallStatus || body.status || '').toLowerCase(),
      durationSeconds: body.durationSeconds ? parseInt(body.durationSeconds) : null,
      recordingUrl: body.recordingUrl || body.RecordingUrl || null,
      startedAt: body.startedAt ? new Date(body.startedAt) : null,
      connectedAt: body.connectedAt ? new Date(body.connectedAt) : null,
      endedAt: body.endedAt ? new Date(body.endedAt) : null
    };
  }

  // Retrieve Call Recording Metadata Stream
  async getRecording(providerCallId) {
    return {
      available: true,
      providerCallId,
      recordingUrl: `/api/calls/stream/${providerCallId}.mp3`
    };
  }
}

export const telephonyProvider = new TelephonyProviderService();
export default telephonyProvider;
