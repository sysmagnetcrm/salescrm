package com.academysales.crm.telecom

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.academysales.crm.activeMainActivityInstance
import org.json.JSONObject

object CrmCallEventBridge {
    private const val TAG = "CrmCallEventBridge"

    fun emitCallEvent(eventType: String, callId: String?, leadId: String?, leadName: String?, phone: String?, state: String, extra: Map<String, Any> = emptyMap()) {
        val payload = JSONObject().apply {
            put("eventType", eventType)
            put("callId", callId ?: "")
            put("leadId", leadId ?: "")
            put("leadName", leadName ?: "")
            put("phone", phone ?: "")
            put("state", state)
            put("timestamp", java.time.format.DateTimeFormatter.ISO_INSTANT.format(java.time.Instant.now()))
            extra.forEach { (k, v) -> put(k, v) }
        }

        Log.d(TAG, "Emitting native event to WebView JS: $payload")

        Handler(Looper.getMainLooper()).post {
            val activity = activeMainActivityInstance
            if (activity != null) {
                try {
                    val wv = activity.webView
                    val script = "window.dispatchEvent(new CustomEvent('crmCallStateChanged', { detail: $payload }));"
                    wv.evaluateJavascript(script, null)
                } catch (e: Exception) {
                    Log.w(TAG, "Error evaluating javascript: ${e.message}")
                }
            }
        }
    }
}
