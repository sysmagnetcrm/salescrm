package com.academysales.crm.telecom

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.util.Log
import androidx.core.content.ContextCompat
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
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
    private var isMonitoring: Boolean = false

    private var contentObserver: ContentObserver? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private val scheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
    private var timeoutFuture: ScheduledFuture<*>? = null

    fun startMonitoring(context: Context, callId: String?, leadId: String?, phone: String?) {
        if (callId.isNullOrEmpty() || phone.isNullOrEmpty()) return

        stopMonitoring(context)

        currentCallId = callId
        currentLeadId = leadId
        currentPhone = phone.replace(Regex("[^0-9+]"), "")
        startTimeMillis = System.currentTimeMillis()
        isMonitoring = true

        Log.d(TAG, "[ContentObserver] Started monitoring CallLog for callId=$callId, phone=$currentPhone, startTime=$startTimeMillis")

        // 1. Register ContentObserver on CallLog.Calls.CONTENT_URI
        val observer = object : ContentObserver(mainHandler) {
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                super.onChange(selfChange, uri)
                Log.d(TAG, "[ContentObserver] CallLog.onChange triggered. Checking for matching call...")
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

        // 2. Safety Net: 90-Second Timeout
        timeoutFuture?.cancel(true)
        timeoutFuture = scheduler.schedule({
            mainHandler.post {
                if (isMonitoring && currentCallId == callId) {
                    Log.w(TAG, "[ContentObserver] 90s Timeout reached for callId=$callId. Marking TIMEOUT_UNRESOLVED.")
                    stopMonitoring(context)
                    executor.execute {
                        sendBackendStateUpdate(context, callId, "no-answer", 0, "TIMEOUT_UNRESOLVED")
                    }
                }
            }
        }, 90, TimeUnit.SECONDS)
    }

    private fun checkCallLogForMatch(context: Context) {
        val callId = currentCallId ?: return
        val targetPhone = currentPhone ?: return
        val startThreshold = startTimeMillis - 5000L // 5s clock skew tolerance

        val hasPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
        if (!hasPerm) {
            Log.w(TAG, "[ContentObserver] READ_CALL_LOG permission not granted.")
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
                arrayOf(startThreshold.toString()),
                "${CallLog.Calls.DATE} DESC"
            )

            cursor?.use {
                val numIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
                val durIdx = it.getColumnIndex(CallLog.Calls.DURATION)
                val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)

                var rowCount = 0
                while (it.moveToNext() && rowCount < 10) {
                    rowCount++
                    val num = it.getString(numIdx) ?: ""
                    val dur = it.getLong(durIdx)
                    val type = it.getInt(typeIdx)
                    val date = it.getLong(dateIdx)

                    val normNum = num.replace(Regex("[^0-9]"), "")
                    val normTarget = targetPhone.replace(Regex("[^0-9]"), "")

                    if (normNum.isNotEmpty() && normTarget.isNotEmpty() &&
                        (normNum.endsWith(normTarget) || normTarget.endsWith(normNum) || normNum.contains(normTarget) || normTarget.contains(normNum))
                    ) {
                        Log.d(TAG, "[ContentObserver] MATCH FOUND! rawNum=$num, type=$type, dur=$dur, date=$date")

                        // Determine authoritative status and duration
                        val finalStatus: String
                        val talkDurationSecs: Long

                        val isConnectedType = (type == CallLog.Calls.OUTGOING_TYPE || type == CallLog.Calls.INCOMING_TYPE)
                        if (isConnectedType && dur > 0) {
                            finalStatus = "completed"
                            talkDurationSecs = dur
                        } else {
                            finalStatus = "no-answer" // NOT_CONNECTED / MISSED / REJECTED / BUSY
                            talkDurationSecs = 0L
                        }

                        // Match consumed — stop monitoring for this callId
                        mainHandler.post {
                            stopMonitoring(context)
                        }

                        sendBackendStateUpdate(context, callId, finalStatus, talkDurationSecs, "CALLLOG_OBSERVER_MATCH")

                        // Trigger audio recording resolution if applicable
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
                                endedAtMillis = System.currentTimeMillis(),
                                serverUploadUrl = serverUrl,
                                authToken = token
                            )
                        }
                        break
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "[ContentObserver] Error querying CallLog: ${e.message}")
        }
    }

    fun stopMonitoring(context: Context) {
        if (!isMonitoring) return
        isMonitoring = false
        timeoutFuture?.cancel(true)

        contentObserver?.let {
            try {
                context.contentResolver.unregisterContentObserver(it)
                Log.d(TAG, "[ContentObserver] Unregistered ContentObserver")
            } catch (e: Exception) {
                Log.e(TAG, "[ContentObserver] Error unregistering observer: ${e.message}")
            }
        }
        contentObserver = null
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
            Log.d(TAG, "[NativeCallMonitor] Dispatching state update ($status, dur: ${talkDurationSeconds}s, reason: $reason) via PUT to: $targetUrlStr")

            val url = URL(targetUrlStr)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "PUT"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("x-client-version", "1.2.0")

            if (!token.isNullOrEmpty()) {
                conn.setRequestProperty("Authorization", "Bearer $token")
                Log.d(TAG, "[NativeCallMonitor] Authorization header ATTACHED (length: ${token.length})")
            } else {
                Log.w(TAG, "[NativeCallMonitor] Authorization header MISSING (token is null/empty)")
            }
            conn.doOutput = true

            val endedAtIso = java.time.format.DateTimeFormatter.ISO_INSTANT.format(java.time.Instant.now())
            
            val json = JSONObject()
            json.put("callStatus", status)
            json.put("state", status)
            json.put("endedAt", endedAtIso)
            json.put("durationSeconds", talkDurationSeconds)
            json.put("talkDurationSeconds", talkDurationSeconds)
            json.put("resolutionReason", reason)

            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(json.toString())
            writer.flush()
            writer.close()

            val code = conn.responseCode
            Log.d(TAG, "[NativeCallMonitor] PUT /api/calls/$callId -> HTTP $code (status: $status, duration: ${talkDurationSeconds}s)")
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "[NativeCallMonitor] Failed to dispatch state update: ${e.message}")
        }
    }
}
