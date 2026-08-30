package com.academysales.crm.telecom

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import android.util.Log
import androidx.core.content.ContextCompat
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

object CallLogSyncService {
    private const val TAG = "CallLogSyncService"
    private val executor = Executors.newSingleThreadExecutor()

    fun syncRecentDeviceCallLogs(context: Context, limit: Int = 50) {
        executor.execute {
            val hasPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
            if (!hasPerm) {
                Log.w(TAG, "[CallLogSync] READ_CALL_LOG permission not granted. Cannot sync CallLog.")
                return@execute
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
                    null,
                    null,
                    "${CallLog.Calls.DATE} DESC"
                )

                val callEntries = JSONArray()
                cursor?.use {
                    val numIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
                    val durIdx = it.getColumnIndex(CallLog.Calls.DURATION)
                    val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
                    val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)

                    var count = 0
                    while (it.moveToNext() && count < limit) {
                        count++
                        val number = it.getString(numIdx) ?: ""
                        val duration = it.getLong(durIdx)
                        val type = it.getInt(typeIdx)
                        val date = it.getLong(dateIdx)

                        val entry = JSONObject()
                        entry.put("phoneNumber", number)
                        entry.put("durationSeconds", duration)
                        entry.put("rawType", type)
                        entry.put("callType", if (type == CallLog.Calls.OUTGOING_TYPE) "outbound" else "inbound")
                        entry.put("timestamp", date)
                        callEntries.put(entry)
                    }
                }

                Log.d(TAG, "[CallLogSync] Fetched ${callEntries.length()} CallLog entries from device OS.")
                
                // Dispatch backfill list to server if token available
                val prefs = context.getSharedPreferences("crm_prefs", Context.MODE_PRIVATE)
                val baseUrl = CrmInCallService.serverBaseUrl.ifEmpty { prefs.getString("server_base_url", "") ?: "" }
                val token = CrmInCallService.userAuthToken ?: prefs.getString("auth_token", null)

                if (!baseUrl.isNullOrEmpty() && !token.isNullOrEmpty() && !baseUrl.contains("androidplatform.net")) {
                    var cleanBaseUrl = baseUrl.trimEnd('/')
                    if (!cleanBaseUrl.endsWith("/api")) {
                        cleanBaseUrl = "$cleanBaseUrl/api"
                    }

                    val targetUrlStr = "$cleanBaseUrl/calls/sync-device-log"
                    val url = URL(targetUrlStr)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.setRequestProperty("x-client-version", "1.2.0")
                    conn.setRequestProperty("Authorization", "Bearer $token")
                    conn.doOutput = true

                    val jsonPayload = JSONObject()
                    jsonPayload.put("logs", callEntries)

                    val writer = OutputStreamWriter(conn.outputStream)
                    writer.write(jsonPayload.toString())
                    writer.flush()
                    writer.close()

                    val code = conn.responseCode
                    Log.d(TAG, "[CallLogSync] POST /api/calls/sync-device-log -> HTTP $code (${callEntries.length()} logs synced)")
                    conn.disconnect()
                }
            } catch (e: Exception) {
                Log.e(TAG, "[CallLogSync] Error syncing device call logs: ${e.message}")
            }
        }
    }
}
