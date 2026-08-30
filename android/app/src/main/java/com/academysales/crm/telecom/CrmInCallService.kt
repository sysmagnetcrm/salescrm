package com.academysales.crm.telecom

import android.content.Intent
import android.net.Uri
import android.telecom.Call
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
        var currentPhoneNumber: String? = null
        var currentDirection: String = "outbound"
        var serverBaseUrl: String = "https://salescrm-7z2o.onrender.com"
        var userAuthToken: String? = null

        private var callStartTimeMillis: Long = 0L
        private var callConnectTimeMillis: Long = 0L
        private var lastStateProcessed: Int = -1
        private var isCompletedProcessed: Boolean = false

        fun resetSession(callLogId: String?, leadId: String?, phone: String?, direction: String = "outbound") {
            currentCallLogId = callLogId
            currentLeadId = leadId
            currentPhoneNumber = phone
            currentDirection = direction
            callStartTimeMillis = System.currentTimeMillis()
            callConnectTimeMillis = 0L
            lastStateProcessed = -1
            isCompletedProcessed = false
            logNativeEvent("CALL_SESSION_CREATED", callLogId ?: "null", leadId, phone, "Session initialized")
        }

        fun logNativeEvent(event: String, callSessionId: String, leadId: String?, phone: String?, details: String) {
            val timestamp = java.time.format.DateTimeFormatter.ISO_INSTANT.format(java.time.Instant.now())
            Log.i(TAG, "[$event] timestamp=$timestamp, callSessionId=$callSessionId, leadId=${leadId ?: "null"}, phone=${phone ?: "null"}, details=$details")
        }
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

        // Launch Native In-Call UI if enabled
        try {
            val intent = Intent(this, CrmCallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
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
                logNativeEvent("CALL_STATE_DIALING", callId, currentLeadId, currentPhoneNumber, "State: $state")
                sendBackendStateUpdate(callId, "initiated", mapOf("startedAt" to nowIso))
            }
            Call.STATE_RINGING -> {
                logNativeEvent("CALL_STATE_RINGING", callId, currentLeadId, currentPhoneNumber, "State: $state")
                sendBackendStateUpdate(callId, "ringing", mapOf("ringingAt" to nowIso))
            }
            Call.STATE_ACTIVE -> {
                if (callConnectTimeMillis == 0L) {
                    callConnectTimeMillis = System.currentTimeMillis()
                    logNativeEvent("CALL_STATE_ACTIVE", callId, currentLeadId, currentPhoneNumber, "State: ACTIVE")
                    sendBackendStateUpdate(callId, "connected", mapOf("connectedAt" to nowIso))
                }
            }
            Call.STATE_DISCONNECTING -> {
                logNativeEvent("CALL_STATE_DISCONNECTING", callId, currentLeadId, currentPhoneNumber, "State: DISCONNECTING")
            }
            Call.STATE_DISCONNECTED -> {
                logNativeEvent("CALL_STATE_DISCONNECTED", callId, currentLeadId, currentPhoneNumber, "State: DISCONNECTED")
                finalizeCompletedCall(call, "completed")
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

        finalizeCompletedCall(call, "completed")
    }

    private fun finalizeCompletedCall(call: Call, finalStatus: String) {
        if (isCompletedProcessed) return
        isCompletedProcessed = true

        val endedAtMillis = System.currentTimeMillis()
        val endedAtIso = java.time.format.DateTimeFormatter.ISO_INSTANT.format(java.time.Instant.ofEpochMilli(endedAtMillis))
        val talkSecs = if (callConnectTimeMillis > 0L) Math.max(0L, (endedAtMillis - callConnectTimeMillis) / 1000) else 0L
        val lifecycleSecs = if (callStartTimeMillis > 0L) Math.max(0L, (endedAtMillis - callStartTimeMillis) / 1000) else talkSecs

        val callId = currentCallLogId ?: return
        logNativeEvent("CALL_SESSION_COMPLETED", callId, currentLeadId, currentPhoneNumber, "talkSecs=$talkSecs, lifecycleSecs=$lifecycleSecs")

        // 1. Send Authoritative Backend State Update
        val payload = mapOf(
            "callStatus" to finalStatus,
            "endedAt" to endedAtIso,
            "durationSeconds" to talkSecs,
            "lifecycleDurationSeconds" to lifecycleSecs
        )
        sendBackendStateUpdate(callId, finalStatus, payload)

        // 2. Trigger OEM Recording Reconciliation Asynchronously
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
