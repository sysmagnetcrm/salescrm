package com.academysales.crm

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.setSupportZoom(false)

        // Register Native JavaScript Bridge for Controlled Android Capabilities
        webView.addJavascriptInterface(AndroidCRMBridge(), "AndroidCRM")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrlNavigation(view, url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url == null) return false
                return handleUrlNavigation(view, url)
            }
        }

        // Modern Android Hardware Back Button navigation handling
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // Always load production CRM (Vercel deployment)
        webView.loadUrl(BuildConfig.WEB_APP_URL)
    }

    private fun handleUrlNavigation(view: WebView?, url: String): Boolean {
        // Handle native telephony & external deep links
        if (url.startsWith("tel:") || url.startsWith("whatsapp:") || url.startsWith("mailto:") || url.startsWith("intent:")) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
                return true
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Allow navigation within the CRM web application domains
        if (url.contains("salescrm-theta.vercel.app") || url.contains("salescrm-7z2o.onrender.com")) {
            return false // Let WebView load internally
        }

        // Default: load inside WebView
        return false
    }

    inner class AndroidCRMBridge {
        @android.webkit.JavascriptInterface
        fun getDeviceInfo(): String {
            return "{\"os\":\"Android\",\"sdk\":${android.os.Build.VERSION.SDK_INT},\"model\":\"${android.os.Build.MODEL}\",\"brand\":\"${android.os.Build.BRAND}\"}"
        }

        @android.webkit.JavascriptInterface
        fun isDefaultDialer(): Boolean {
            return com.academysales.crm.telecom.DialerRoleManager.isDefaultDialer(this@MainActivity)
        }

        @android.webkit.JavascriptInterface
        fun requestDefaultDialer() {
            runOnUiThread {
                com.academysales.crm.telecom.DialerRoleManager.requestDefaultDialer(this@MainActivity)
            }
        }

        @android.webkit.JavascriptInterface
        fun getCallCapability(): String {
            val hasPhonePerm = androidx.core.content.ContextCompat.checkSelfPermission(
                this@MainActivity,
                android.Manifest.permission.CALL_PHONE
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            val isDialer = isDefaultDialer()

            return "{\"telephonySupported\":true,\"phonePermissionGranted\":$hasPhonePerm,\"isDefaultDialer\":$isDialer,\"callingMethod\":\"native_telecom\"}"
        }

        @android.webkit.JavascriptInterface
        fun getRecordingCapability(): String {
            val cap = com.academysales.crm.telecom.CallRecordingCapabilityManager.getCapability(this@MainActivity)
            val desc = com.academysales.crm.telecom.CallRecordingCapabilityManager.getCapabilityDescription(this@MainActivity)
            return "{\"recordingCapability\":\"${cap.name}\",\"description\":\"$desc\"}"
        }

        @android.webkit.JavascriptInterface
        fun startCallRecording(callId: String): Boolean {
            return com.academysales.crm.telecom.CrmAudioRecorder.startRecording(this@MainActivity, callId)
        }

        @android.webkit.JavascriptInterface
        fun stopAndUploadCallRecording(callId: String, uploadUrl: String, authToken: String) {
            com.academysales.crm.telecom.CrmAudioRecorder.stopAndUpload(this@MainActivity, callId, uploadUrl, authToken)
        }

        @android.webkit.JavascriptInterface
        fun placeTelecomCall(phoneNumber: String, leadId: String, callId: String) {
            runOnUiThread {
                try {
                    val formatted = phoneNumber.replace(Regex("[^0-9+]"), "")
                    val uri = Uri.parse("tel:$formatted")
                    val intent = Intent(Intent.ACTION_CALL, uri).apply {
                        putExtra("crm_lead_id", leadId)
                        putExtra("crm_call_id", callId)
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }
}
