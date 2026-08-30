package com.academysales.crm.telecom

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

object NativeCallMonitor {
    private const val TAG = "NativeCallMonitor"

    private var currentCallId: String? = null
    private var currentLeadId: String? = null
    private var currentPhone: String? = null
    private var startTimeMillis: Long = 0L
    private var connectedAtMillis: Long = 0L
    @Volatile private var isMonitoring: Boolean = false
    @Volatile private var hasDispatchedConnected: Boolean = false

    private var contentObserver: ContentObserver? = null
    private var phoneStateListener: PhoneStateListener? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private val scheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
    private var timeoutFuture: ScheduledFuture<*>? = null
    private var pollFuture: ScheduledFuture<*>? = null

    fun startMonitoring(context: Context, callId: String?, leadId: String?, phone: String?) {
        if (callId.isNullOrEmpty() || phone.isNullOrEmpty()) return

        stopMonitoring(context)

        currentCallId = callId
        currentLeadId = leadId
        currentPhone = normalizePhone(phone)
        startTimeMillis = System.currentTimeMillis()
        connectedAtMillis = 0L
        hasDispatchedConnected = false
        isMonitoring = true

        Log.d(TAG, "[NativeCallMonitor] Monitoring started for callId=$callId, phone=$currentPhone, startTime=$startTimeMillis")

        // 1. ContentObserver on CallLog.Calls.CONTENT_URI
        val observer = object : ContentObserver(mainHandler) {
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                super.onChange(selfChange, uri)
                Log.d(TAG, "[ContentObserver] CallLog.onChange triggered. Checking CallLog...")
                executor.execute {
                    checkCallLogForMatch(context)
                }
            }
        }

        contentObserver = observer
        try {
            context.contentResolver.registerContentObserver(
                CallLog.Calls.CONTENT_URI,
                true,
                observer
            )
        } catch (e: Exception) {
            Log.e(TAG, "[ContentObserver] Failed to register ContentObserver: ${e.message}")
        }

        // 2. Register TelephonyManager Listener for Real-Time Offhook/Connected events
        try {
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            val listener = object : PhoneStateListener() {
                @Deprecated("Deprecated in Java")
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    super.onCallStateChanged(state, phoneNumber)
                    when (state) {
                        TelephonyManager.CALL_STATE_OFFHOOK -> {
                            Log.d(TAG, "[PhoneStateListener] CALL_STATE_OFFHOOK detected (Call Active/Connected).")
                            notifyCallConnectedFromNotification(context)
                        }
                        TelephonyManager.CALL_STATE_IDLE -> {
                            Log.d(TAG, "[PhoneStateListener] CALL_STATE_IDLE detected (Call Line Disconnected).")
                            executor.execute {
                                checkCallLogForMatch(context)
                            }
                        }
                    }
                }
            }
            phoneStateListener = listener
            telephonyManager?.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
        } catch (e: Exception) {
            Log.e(TAG, "[PhoneStateListener] Failed to register listener: ${e.message}")
        }

        // 3. High-Frequency 1-Second Poller
        pollFuture?.cancel(true)
        pollFuture = scheduler.scheduleAtFixedRate({
            if (isMonitoring) {
                executor.execute {
                    checkCallLogForMatch(context)
                }
            }
        }, 1, 1, TimeUnit.SECONDS)

        // 4. Safety Net 90-Second Timeout
        timeoutFuture?.cancel(true)
        timeoutFuture = scheduler.schedule({
            mainHandler.post {
                if (isMonitoring && currentCallId == callId) {
                    Log.w(TAG, "[NativeCallMonitor] 90s Timeout reached for callId=$callId.")
                    stopMonitoring(context)
                    executor.execute {
                        sendBackendStateUpdate(
                            context = context,
                            callId = callId,
                            status = "no-answer",
                            talkDurationSeconds = 0,
                            lifecycleSeconds = 90,
                            callDate = startTimeMillis,
                            reason = "TIMEOUT_UNRESOLVED"
                        )
                    }
                }
            }
        }, 90, TimeUnit.SECONDS)
    }

    fun notifyCallConnectedFromNotification(context: Context) {
        if (!isMonitoring || hasDispatchedConnected) return
        hasDispatchedConnected = true
        connectedAtMillis = System.currentTimeMillis()
        val callId = currentCallId ?: return

        Log.d(TAG, "[NativeCallMonitor] Signal CONNECTED for callId=$callId from Notification/Telephony Listener.")
        executor.execute {
            sendBackendStateUpdate(
                context = context,
                callId = callId,
                status = "connected",
                talkDurationSeconds = 0,
                lifecycleSeconds = 0,
                callDate = connectedAtMillis,
                reason = "TELEPHONY_OR_NOTIFICATION_CONNECTED"
            )
        }
    }

    fun notifyCallDisconnectedFromNotification(context: Context) {
        if (!isMonitoring) return
        Log.d(TAG, "[NativeCallMonitor] Signal DISCONNECTED from Notification Listener. Checking CallLog...")
        executor.execute {
            checkCallLogForMatch(context)
        }
    }

    fun endCall(context: Context, callId: String?) {
        val targetCallId = callId ?: currentCallId ?: return
        Log.d(TAG, "[NativeCallMonitor] endCall requested manually for callId=$targetCallId")
        executor.execute {
            checkCallLogForMatch(context)
            if (isMonitoring && currentCallId == targetCallId) {
                val talkSecs = Math.max(0L, (System.currentTimeMillis() - (if (connectedAtMillis > 0) connectedAtMillis else startTimeMillis)) / 1000L)
                sendBackendStateUpdate(
                    context = context,
                    callId = targetCallId,
                    status = "completed",
                    talkDurationSeconds = talkSecs,
                    lifecycleSeconds = talkSecs,
                    callDate = startTimeMillis,
                    reason = "MANUAL_UI_END_CALL"
                )
                mainHandler.post {
                    stopMonitoring(context)
                }
            }
        }
    }

    private fun checkCallLogForMatch(context: Context) {
        if (!isMonitoring) return
        val callId = currentCallId ?: return
        val targetPhone = currentPhone ?: return
        val toleranceMillis = 5000L // 5 seconds clock skew tolerance
        val queryStartTime = startTimeMillis - toleranceMillis

        val hasPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
        if (!hasPerm) {
            Log.w(TAG, "[NativeCallMonitor] READ_CALL_LOG permission not granted.")
            return
        }

        try {
            val cursor = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls._ID,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE
                ),
                "${CallLog.Calls.DATE} >= ?",
                arrayOf(queryStartTime.toString()),
                "${CallLog.Calls.DATE} DESC"
            )

            cursor?.use {
                val numIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
                val durIdx = it.getColumnIndex(CallLog.Calls.DURATION)
                val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)

                while (it.moveToNext()) {
                    val num = it.getString(numIdx) ?: ""
                    val callDuration = it.getInt(durIdx)
                    val callType = it.getInt(typeIdx)
                    val callDate = it.getLong(dateIdx)

                    val normalizedCallNumber = normalizePhone(num)
                    val isPhoneMatch = normalizedCallNumber == targetPhone ||
                        (normalizedCallNumber.length >= 7 && targetPhone.length >= 7 && 
                          (normalizedCallNumber.endsWith(targetPhone) || targetPhone.endsWith(normalizedCallNumber)))

                    if (isPhoneMatch && callDate >= queryStartTime) {
                        Log.d(TAG, "[NativeCallMonitor] Found matching call log: rawNum=$num, type=$callType, duration=${callDuration}s, date=$callDate")

                        val finalStatus = when {
                            callType == CallLog.Calls.OUTGOING_TYPE && callDuration > 0 -> "completed"
                            callType == CallLog.Calls.OUTGOING_TYPE && callDuration == 0 -> "no-answer"
                            callType == CallLog.Calls.MISSED_TYPE -> "no-answer"
                            callType == CallLog.Calls.REJECTED_TYPE -> "cancelled"
                            else -> "failed"
                        }

                        val talkDurationSecs = if (finalStatus == "completed") callDuration.toLong() else 0L
                        val endedAtMillis = callDate + (callDuration * 1000L)
                        val lifecycleSecs = Math.max(talkDurationSecs, (endedAtMillis - startTimeMillis) / 1000L)

                        mainHandler.post {
                            stopMonitoring(context)
                        }

                        sendBackendStateUpdate(
                            context = context,
                            callId = callId,
                            status = finalStatus,
                            talkDurationSeconds = talkDurationSecs,
                            lifecycleSeconds = lifecycleSecs,
                            callDate = callDate,
                            reason = "CALLLOG_OBSERVER_MATCH"
                        )

                        // Trigger OEM audio recording resolution
                        val prefs = context.getSharedPreferences("crm_prefs", Context.MODE_PRIVATE)
                        val baseUrl = CrmInCallService.serverBaseUrl.ifEmpty { prefs.getString("server_base_url", "") ?: "" }
                        val token = CrmInCallService.userAuthToken ?: prefs.getString("auth_token", null)

                        if (!baseUrl.isNullOrEmpty() && !baseUrl.contains("androidplatform.net")) {
                            val serverUrl = "$baseUrl/api/calls/$callId/upload-audio"
                            OemRecordingResolver.resolveAndUploadRecording(
                                context = context,
                                callLogId = callId,
                                targetPhoneNumber = targetPhone,
                                callDirection = "outbound",
                                talkDurationSeconds = talkDurationSecs,
                                endedAtMillis = endedAtMillis,
                                serverUploadUrl = serverUrl,
                                authToken = token
                            )
                        }
                        break
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "[NativeCallMonitor] Error querying CallLog: ${e.message}")
        }
    }

    private fun normalizePhone(phone: String?): String {
        if (phone.isNullOrEmpty()) return ""
        val digits = phone.replace(Regex("[^0-9]"), "")
        return if (digits.length >= 10) digits.takeLast(10) else digits
    }

    fun stopMonitoring(context: Context) {
        if (!isMonitoring) return
        isMonitoring = false
        timeoutFuture?.cancel(true)
        pollFuture?.cancel(true)

        contentObserver?.let {
            try {
                context.contentResolver.unregisterContentObserver(it)
                Log.d(TAG, "[ContentObserver] Unregistered ContentObserver")
            } catch (e: Exception) {
                Log.e(TAG, "[ContentObserver] Error unregistering observer: ${e.message}")
            }
        }
        contentObserver = null

        phoneStateListener?.let {
            try {
                val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
                telephonyManager?.listen(it, PhoneStateListener.LISTEN_NONE)
                Log.d(TAG, "[PhoneStateListener] Unregistered TelephonyManager listener")
            } catch (e: Exception) {
                Log.e(TAG, "[PhoneStateListener] Error unregistering listener: ${e.message}")
            }
        }
        phoneStateListener = null

        currentCallId = null
        currentLeadId = null
        currentPhone = null

        CallMonitorService.stop(context)
    }

    private fun sendBackendStateUpdate(
        context: Context,
        callId: String,
        status: String,
        talkDurationSeconds: Long,
        lifecycleSeconds: Long,
        callDate: Long,
        reason: String
    ) {
        try {
            val prefs = context.getSharedPreferences("crm_prefs", Context.MODE_PRIVATE)
            var baseUrl = CrmInCallService.serverBaseUrl
            if (baseUrl.isEmpty() || baseUrl.contains("androidplatform.net")) {
                baseUrl = prefs.getString("server_base_url", "") ?: ""
            }
            if (baseUrl.isEmpty() || baseUrl.contains("androidplatform.net")) {
                baseUrl = com.academysales.crm.BuildConfig.API_BASE_URL
            }

            var cleanBaseUrl = baseUrl.trimEnd('/')
            if (!cleanBaseUrl.endsWith("/api")) {
                cleanBaseUrl = "$cleanBaseUrl/api"
            }

            var token = CrmInCallService.userAuthToken
            if (token.isNullOrEmpty()) {
                token = prefs.getString("auth_token", null)
            }

            val targetUrlStr = "$cleanBaseUrl/calls/$callId"
            Log.d(TAG, "[NativeCallMonitor] Dispatching state update ($status, talk: ${talkDurationSeconds}s, total: ${lifecycleSeconds}s) via PUT to: $targetUrlStr")

            val url = URL(targetUrlStr)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "PUT"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("x-client-version", "1.2.0")

            if (!token.isNullOrEmpty()) {
                conn.setRequestProperty("Authorization", if (token.startsWith("Bearer ")) token else "Bearer $token")
            }
            conn.doOutput = true

            val endedAtMillis = callDate + (talkDurationSeconds * 1000L)
            val connectedAtMillis = if (talkDurationSeconds > 0 || status == "connected") callDate else null

            val isTerminal = status != "connected" && status != "ringing" && status != "initiated"
            val json = JSONObject().apply {
                put("callStatus", status)
                put("startedAt", DateTimeFormatter.ISO_INSTANT.format(Instant.ofEpochMilli(startTimeMillis)))
                if (connectedAtMillis != null) {
                    put("connectedAt", DateTimeFormatter.ISO_INSTANT.format(Instant.ofEpochMilli(connectedAtMillis)))
                }
                if (isTerminal) {
                    val endedAtMillis = callDate + (talkDurationSeconds * 1000L)
                    put("endedAt", DateTimeFormatter.ISO_INSTANT.format(Instant.ofEpochMilli(endedAtMillis)))
                    put("durationSeconds", talkDurationSeconds)
                    put("lifecycleDurationSeconds", lifecycleSeconds)
                }
                put("resolutionReason", reason)
            }

            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(json.toString())
            writer.flush()
            writer.close()

            val code = conn.responseCode
            Log.d(TAG, "[NativeCallMonitor] PUT /api/calls/$callId -> $code (status=$status, duration=${talkDurationSeconds}s)")
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "[NativeCallMonitor] Failed to dispatch state update: ${e.message}")
        }
    }
}
