package com.academysales.crm.telecom

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject

class CallAgentService : Service() {

    companion object {
        private const val TAG = "CallAgentService"
        private const val CHANNEL_ID = "crm_call_agent_channel"
        private const val NOTIF_ID = 2001

        var isRunning = false
            private set

        fun startService(context: Context) {
            try {
                val intent = Intent(context, CallAgentService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error starting CallAgentService: ${e.message}")
            }
        }

        fun stopService(context: Context) {
            try {
                val intent = Intent(context, CallAgentService::class.java)
                context.stopService(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping CallAgentService: ${e.message}")
            }
        }

        fun recordCompletedCall(
            context: Context,
            phoneNumber: String,
            direction: String,
            callStatus: String,
            startedAtMillis: Long,
            ringingAtMillis: Long,
            connectedAtMillis: Long,
            endedAtMillis: Long,
            talkDurationSeconds: Long,
            lifecycleDurationSeconds: Long,
            callLogId: String?,
            serverUrl: String,
            authToken: String?
        ) {
            val normalizedPhone = normalizePhoneNumber(phoneNumber)
            val eventPayload = JSONObject().apply {
                if (!callLogId.isNullOrEmpty()) {
                    put("callLogId", callLogId)
                }
                put("phoneNumber", normalizedPhone)
                put("callDirection", direction)
                put("callStatus", callStatus)
                put("startedAt", startedAtMillis)
                put("ringingAt", if (ringingAtMillis > 0) ringingAtMillis else startedAtMillis)
                put("connectedAt", if (connectedAtMillis > 0) connectedAtMillis else null)
                put("endedAt", endedAtMillis)
                put("durationSeconds", talkDurationSeconds)
                put("lifecycleDurationSeconds", lifecycleDurationSeconds)
                put("recordedAt", endedAtMillis)
            }

            CallEventQueueManager.enqueueEvent(context, eventPayload)
            CallEventQueueManager.flushQueue(context, serverUrl, authToken)

            // Trigger OEM Recording Reconciliation
            OemRecordingResolver.resolveAndUploadRecording(
                context = context,
                callLogId = callLogId ?: "temp_${System.currentTimeMillis()}",
                targetPhoneNumber = normalizedPhone,
                callDirection = direction,
                talkDurationSeconds = talkDurationSeconds,
                endedAtMillis = endedAtMillis,
                serverUploadUrl = "$serverUrl/api/calls/upload-audio",
                authToken = authToken
            )
        }

        fun normalizePhoneNumber(phone: String): String {
            val digits = phone.replace(Regex("[^0-9+]"), "")
            return if (digits.startsWith("+91") && digits.length == 13) {
                digits
            } else if (digits.length == 10) {
                "+91$digits"
            } else if (digits.startsWith("0") && digits.length == 11) {
                "+91${digits.substring(1)}"
            } else {
                digits
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification("Academy CRM Call Agent active (Telecom tracking enabled)"))
        Log.d(TAG, "CallAgentService created and running in foreground.")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        Log.d(TAG, "CallAgentService destroyed.")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Academy CRM Telephony Agent",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors native SIM calls and synchronizes CRM call logs"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Academy CRM Call Agent")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }
}
