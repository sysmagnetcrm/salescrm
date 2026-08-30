package com.academysales.crm.telecom

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

object CallEventQueueManager {

    private const val TAG = "CallEventQueueManager"
    private const val PREFS_NAME = "crm_call_event_queue"
    private const val KEY_QUEUE = "pending_call_events"

    var onAuthErrorListener: (() -> Unit)? = null

    @Synchronized
    fun enqueueEvent(context: Context, eventJson: JSONObject) {
        try {
            val prefs = getPrefs(context)
            val existingArrayStr = prefs.getString(KEY_QUEUE, "[]") ?: "[]"
            val array = JSONArray(existingArrayStr)

            // Duplicate prevention check by callId
            val newCallId = eventJson.optString("callId", "")
            for (i in 0 until array.length()) {
                val item = array.getJSONObject(i)
                if (newCallId.isNotEmpty() && item.optString("callId") == newCallId) {
                    Log.d(TAG, "Duplicate event skipped for callId: $newCallId")
                    return
                }
            }

            array.put(eventJson)
            prefs.edit().putString(KEY_QUEUE, array.toString()).apply()
            Log.d(TAG, "Enqueued call event. Total offline queue size: ${array.length()}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enqueue call event: ${e.message}", e)
        }
    }

    @Synchronized
    fun getPendingQueueLength(context: Context): Int {
        return try {
            val prefs = getPrefs(context)
            val arrayStr = prefs.getString(KEY_QUEUE, "[]") ?: "[]"
            JSONArray(arrayStr).length()
        } catch (e: Exception) {
            0
        }
    }

    @Synchronized
    fun flushQueue(context: Context, serverBaseUrl: String, authToken: String?) {
        thread {
            try {
                val prefs = getPrefs(context)
                val arrayStr = prefs.getString(KEY_QUEUE, "[]") ?: "[]"
                val array = JSONArray(arrayStr)

                if (array.length() == 0) {
                    Log.d(TAG, "Offline call event queue is empty.")
                    return@thread
                }

                Log.d(TAG, "Flushing ${array.length()} pending call events to server...")
                val remainingArray = JSONArray()
                var hadAuthError = false

                for (i in 0 until array.length()) {
                    val event = array.getJSONObject(i)
                    val resultCode = syncSingleEventCode(event, serverBaseUrl, authToken)
                    if (resultCode == 401) {
                        hadAuthError = true
                        remainingArray.put(event)
                    } else if (resultCode !in 200..299) {
                        remainingArray.put(event)
                    }
                }

                prefs.edit().putString(KEY_QUEUE, remainingArray.toString()).apply()
                Log.d(TAG, "Flush completed. Remaining queued events: ${remainingArray.length()}")

                if (hadAuthError) {
                    Log.w(TAG, "HTTP 401 Auth error detected during sync. Event preserved in queue. Triggering re-auth prompt.")
                    onAuthErrorListener?.invoke()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error flushing call event queue: ${e.message}", e)
            }
        }
    }

    private fun syncSingleEventCode(event: JSONObject, serverBaseUrl: String, authToken: String?): Int {
        return try {
            val endpointUrl = if (event.has("callLogId")) {
                "$serverBaseUrl/api/calls/${event.getString("callLogId")}"
            } else {
                "$serverBaseUrl/api/calls"
            }

            val url = URL(endpointUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = if (event.has("callLogId")) "PUT" else "POST"
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            if (!authToken.isNullOrEmpty()) {
                conn.setRequestProperty("Authorization", if (authToken.startsWith("Bearer ")) authToken else "Bearer $authToken")
            }
            conn.doOutput = true

            val os: OutputStream = conn.outputStream
            os.write(event.toString().toByteArray(Charsets.UTF_8))
            os.flush()
            os.close()

            val code = conn.responseCode
            Log.d(TAG, "Synced call event to $endpointUrl -> HTTP $code")
            code
        } catch (e: Exception) {
            Log.w(TAG, "Failed to sync event: ${e.message}")
            -1
        }
    }

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
}
