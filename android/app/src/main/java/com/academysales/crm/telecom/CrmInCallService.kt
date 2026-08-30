package com.academysales.crm.telecom

import android.content.Intent
import android.net.Uri
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.DisconnectCause
import android.telecom.InCallService
import android.util.Log
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class CrmInCallService : InCallService() {

    companion object {
        private const val TAG = "CrmInCallService"
        var activeCall: Call? = null
            private set
        var currentCallLogId: String? = null
        var currentLeadId: String? = null
        var currentLeadName: String? = null
        var currentPhoneNumber: String? = null
        var currentDirection: String = "outbound"
        var serverBaseUrl: String = "https://salescrm-7z2o.onrender.com"
        var userAuthToken: String? = null
        var instance: CrmInCallService? = null

        private var callStartTimeMillis: Long = 0L
        private var callConnectTimeMillis: Long = 0L
        private var lastStateProcessed: Int = -1
        private var isCompletedProcessed: Boolean = false

        fun resetSession(callLogId: String?, leadId: String?, phone: String?, leadName: String? = null, direction: String = "outbound") {
            currentCallLogId = callLogId
            currentLeadId = leadId
            currentLeadName = leadName
            currentPhoneNumber = phone
            currentDirection = direction
            callStartTimeMillis = System.currentTimeMillis()
            callConnectTimeMillis = 0L
            lastStateProcessed = -1
            isCompletedProcessed = false
            logNativeEvent("CALL_SESSION_CREATED", callLogId ?: "null", leadId, phone, "Session initialized for $leadName")
            
            CrmCallEventBridge.emitCallEvent(
                eventType = "CALL_CREATED",
                callId = callLogId,
                leadId = leadId,
                leadName = leadName,
                phone = phone,
                state = "CREATED"
            )
        }

        fun logNativeEvent(event: String, callSessionId: String, leadId: String?, phone: String?, details: String) {
            val timestamp = java.time.format.DateTimeFormatter.ISO_INSTANT.format(java.time.Instant.now())
            Log.i(TAG, "[$event] timestamp=$timestamp, callSessionId=$callSessionId, leadId=${leadId ?: "null"}, phone=${phone ?: "null"}, details=$details")
        }

        fun setMutedState(muted: Boolean) {
            try {
                instance?.setMuted(muted)
            } catch (e: Exception) {
                Log.w(TAG, "Error setting mute state: ${e.message}")
            }
        }

        fun setSpeakerState(speakerOn: Boolean) {
            try {
                val route = if (speakerOn) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE
                instance?.setAudioRoute(route)
            } catch (e: Exception) {
                Log.w(TAG, "Error setting speaker state: ${e.message}")
            }
        }

        fun setHoldState(holdOn: Boolean) {
            try {
                activeCall?.let {
                    if (holdOn) it.hold() else it.unhold()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error setting hold state: ${e.message}")
            }
        }

        fun playDtmfTone(digit: Char) {
            try {
                activeCall?.playDtmfTone(digit)
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    activeCall?.stopDtmfTone()
                }, 250)
            } catch (e: Exception) {
                Log.w(TAG, "Error playing DTMF tone: ${e.message}")
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
        }
    }

    override fun onCallAudioStateChanged(audioState: CallAudioState) {
        super.onCallAudioStateChanged(audioState)
        Log.i(TAG, "onCallAudioStateChanged: isMuted=${audioState.isMuted}, route=${audioState.route}")
        CrmCallEventBridge.emitCallEvent(
            eventType = "CALL_AUDIO_CHANGED",
            callId = currentCallLogId,
            leadId = currentLeadId,
            leadName = currentLeadName,
            phone = currentPhoneNumber,
            state = if (audioState.isMuted) "MUTED" else "UNMUTED",
            extra = mapOf(
                "isMuted" to audioState.isMuted,
                "isSpeakerOn" to (audioState.route == CallAudioState.ROUTE_SPEAKER)
            )
        )
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        activeCall = call
        if (callStartTimeMillis == 0L) {
            callStartTimeMillis = System.currentTimeMillis()
        }

        val handleUri = call.details.handle
        val phoneFromHandle = handleUri?.schemeSpecificPart ?: ""
        if (phoneFromHandle.isNotEmpty()) {
            currentPhoneNumber = phoneFromHandle.replace(Regex("[^0-9+]"), "")
        }
        currentDirection = if (call.details.callDirection == Call.Details.DIRECTION_INCOMING) "inbound" else "outbound"

        val callId = currentCallLogId ?: "telecom-${System.currentTimeMillis()}"
        logNativeEvent("CALL_TELECOM_ADDED", callId, currentLeadId, currentPhoneNumber, "CallHandle: ${call.details.handle}")

        // Inspect initial call state immediately
        handleCallStateChange(call, call.details.state)

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                super.onStateChanged(call, state)
                handleCallStateChange(call, state)
            }
        })

        // Launch Native In-Call UI Activity
        try {
            val intent = Intent(this, CrmCallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("leadName", currentLeadName)
                putExtra("phone", currentPhoneNumber)
                putExtra("callId", currentCallLogId)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.w(TAG, "Could not launch CrmCallActivity: ${e.message}")
        }
    }

    private fun handleCallStateChange(call: Call, state: Int) {
        if (state == lastStateProcessed) return
        lastStateProcessed = state

        val callId = currentCallLogId ?: return
        val nowIso = java.time.format.DateTimeFormatter.ISO_INSTANT.format(java.time.Instant.now())

        when (state) {
            Call.STATE_CONNECTING, Call.STATE_DIALING -> {
                logNativeEvent("CALL_STATE_DIALING", callId, currentLeadId, currentPhoneNumber, "State: DIALING ($state)")
                sendBackendStateUpdate(callId, "initiated", mapOf("startedAt" to nowIso))
                CrmCallEventBridge.emitCallEvent("CALL_DIALING", callId, currentLeadId, currentLeadName, currentPhoneNumber, "DIALING")
            }
            Call.STATE_RINGING -> {
                logNativeEvent("CALL_STATE_RINGING", callId, currentLeadId, currentPhoneNumber, "State: RINGING ($state)")
                sendBackendStateUpdate(callId, "ringing", mapOf("ringingAt" to nowIso))
                CrmCallEventBridge.emitCallEvent("CALL_RINGING", callId, currentLeadId, currentLeadName, currentPhoneNumber, "RINGING")
            }
            Call.STATE_ACTIVE -> {
                if (callConnectTimeMillis == 0L) {
                    callConnectTimeMillis = System.currentTimeMillis()
                    logNativeEvent("CALL_STATE_ACTIVE", callId, currentLeadId, currentPhoneNumber, "State: ACTIVE")
                    sendBackendStateUpdate(callId, "connected", mapOf("connectedAt" to nowIso))
                    CrmCallEventBridge.emitCallEvent("CALL_ACTIVE", callId, currentLeadId, currentLeadName, currentPhoneNumber, "CONNECTED", mapOf("connectedAt" to nowIso))
                }
            }
            Call.STATE_DISCONNECTING -> {
                logNativeEvent("CALL_STATE_DISCONNECTING", callId, currentLeadId, currentPhoneNumber, "State: DISCONNECTING")
            }
            Call.STATE_DISCONNECTED -> {
                val cause = call.details.disconnectCause
                logNativeEvent("CALL_STATE_DISCONNECTED", callId, currentLeadId, currentPhoneNumber, "State: DISCONNECTED (cause=${cause.code}, reason=${cause.reason})")
                val finalOutcome = determineOutcomeFromDisconnectCause(cause.code)
                finalizeCompletedCall(call, finalOutcome)
            }
        }
    }

    private fun determineOutcomeFromDisconnectCause(causeCode: Int): String {
        return if (callConnectTimeMillis > 0L) {
            "completed"
        } else {
            when (causeCode) {
                DisconnectCause.CANCELED -> "cancelled"
                DisconnectCause.BUSY -> "busy"
                DisconnectCause.REJECTED, DisconnectCause.MISSED -> "no-answer"
                else -> "no-answer"
            }
        }
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        val callId = currentCallLogId ?: "telecom-${System.currentTimeMillis()}"
        logNativeEvent("CALL_TELECOM_REMOVED", callId, currentLeadId, currentPhoneNumber, "Call removed from Telecom")

        if (activeCall == call) {
            activeCall = null
        }

        val causeCode = call.details?.disconnectCause?.code ?: DisconnectCause.UNKNOWN
        val finalOutcome = determineOutcomeFromDisconnectCause(causeCode)
        finalizeCompletedCall(call, finalOutcome)
    }

    private fun finalizeCompletedCall(call: Call, finalStatus: String) {
        if (isCompletedProcessed) return
        isCompletedProcessed = true

        val endedAtMillis = System.currentTimeMillis()
        val endedAtIso = java.time.format.DateTimeFormatter.ISO_INSTANT.format(java.time.Instant.ofEpochMilli(endedAtMillis))
        val talkSecs = if (callConnectTimeMillis > 0L) Math.max(0L, (endedAtMillis - callConnectTimeMillis) / 1000) else 0L
        val lifecycleSecs = if (callStartTimeMillis > 0L) Math.max(0L, (endedAtMillis - callStartTimeMillis) / 1000) else talkSecs

        val callId = currentCallLogId ?: return
        logNativeEvent("CALL_SESSION_COMPLETED", callId, currentLeadId, currentPhoneNumber, "status=$finalStatus, talkSecs=$talkSecs, lifecycleSecs=$lifecycleSecs")

        // 1. Broadcast native disconnect event to WebView JS
        CrmCallEventBridge.emitCallEvent(
            eventType = "CALL_DISCONNECTED",
            callId = callId,
            leadId = currentLeadId,
            leadName = currentLeadName,
            phone = currentPhoneNumber,
            state = "DISCONNECTED",
            extra = mapOf(
                "status" to finalStatus,
                "endedAt" to endedAtIso,
                "durationSeconds" to talkSecs,
                "lifecycleDurationSeconds" to lifecycleSecs
            )
        )

        // 2. Send Authoritative Backend State Update
        val payload = mapOf(
            "callStatus" to finalStatus,
            "endedAt" to endedAtIso,
            "durationSeconds" to talkSecs,
            "lifecycleDurationSeconds" to lifecycleSecs,
            "resolutionSource" to "IN_CALL_SERVICE"
        )
        sendBackendStateUpdate(callId, finalStatus, payload)

        // 3. Trigger OEM Recording Reconciliation Asynchronously
        val phoneToResolve = currentPhoneNumber ?: ""
        if (callId.isNotEmpty() && phoneToResolve.isNotEmpty()) {
            val uploadUrl = "$serverBaseUrl/api/calls/$callId/upload-audio"
            OemRecordingResolver.resolveAndUploadRecording(
                context = applicationContext,
                callLogId = callId,
                targetPhoneNumber = phoneToResolve,
                callDirection = currentDirection,
                talkDurationSeconds = talkSecs,
                endedAtMillis = endedAtMillis,
                serverUploadUrl = uploadUrl,
                authToken = userAuthToken
            )
        }
    }

    private fun sendBackendStateUpdate(callId: String, status: String, extraFields: Map<String, Any>) {
        Thread {
            try {
                val url = URL("$serverBaseUrl/api/calls/$callId/state")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "PATCH"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("x-client-version", "1.2.0")
                userAuthToken?.let { token ->
                    conn.setRequestProperty("Authorization", "Bearer $token")
                }
                conn.doOutput = true

                val json = JSONObject()
                json.put("callStatus", status)
                json.put("state", status)
                extraFields.forEach { (k, v) -> json.put(k, v) }

                val writer = OutputStreamWriter(conn.outputStream)
                writer.write(json.toString())
                writer.flush()
                writer.close()

                val code = conn.responseCode
                Log.d(TAG, "[BackendSync] PATCH /api/calls/$callId/state -> $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "[BackendSync] Failed to patch call state: ${e.message}")
            }
        }.start()
    }
}
