package com.academysales.crm

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.setSupportZoom(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // Clear any old WebView cache or registered Service Workers from Vercel PWA
        webView.clearCache(true)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        // Register Native JavaScript Bridge for Controlled Android Capabilities
        webView.addJavascriptInterface(AndroidCRMBridge(), "AndroidCRM")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                return request?.url?.let { assetLoader.shouldInterceptRequest(it) }
            }

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

        // Load offline bundled frontend via virtual secure origin
        webView.loadUrl("https://appassets.androidplatform.net/index.html")
    }

    override fun onResume() {
        super.onResume()
        checkAndRequestAllFilesAccess()
        // Safety net fallback: active CallLog check on app resume/foregrounding
        try {
            com.academysales.crm.telecom.CrmInCallService.currentCallLogId?.let { callId ->
                com.academysales.crm.telecom.CrmInCallService.currentPhoneNumber?.let { phone ->
                    com.academysales.crm.telecom.NativeCallMonitor.startMonitoring(this, callId, null, phone)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun checkAndRequestAllFilesAccess() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            if (!android.os.Environment.isExternalStorageManager()) {
                try {
                    val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    val intent = Intent(android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                    startActivity(intent)
                }
            }
        }
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

        // Allow navigation within the app assets domain
        if (url.contains("appassets.androidplatform.net") || url.contains("salescrm-7z2o.onrender.com")) {
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
        fun setServerConfig(serverBaseUrl: String, authToken: String?) {
            if (serverBaseUrl.isNotEmpty()) {
                val cleanUrl = serverBaseUrl.trimEnd('/')
                com.academysales.crm.telecom.CrmInCallService.serverBaseUrl = cleanUrl
                getSharedPreferences("crm_prefs", Context.MODE_PRIVATE)
                    .edit()
                    .putString("server_base_url", cleanUrl)
                    .apply()
            }
            if (!authToken.isNullOrEmpty()) {
                com.academysales.crm.telecom.CrmInCallService.userAuthToken = authToken
                getSharedPreferences("crm_prefs", Context.MODE_PRIVATE)
                    .edit()
                    .putString("auth_token", authToken)
                    .apply()
            }
        }

        @android.webkit.JavascriptInterface
        fun placeTelecomCall(phoneNumber: String, leadId: String?, callId: String?) {
            runOnUiThread {
                try {
                    val sanitized = phoneNumber.replace(Regex("[^0-9+]"), "")
                    val uri = Uri.parse("tel:$sanitized")

                    com.academysales.crm.telecom.CrmInCallService.resetSession(callId, leadId, sanitized, "outbound")
                    
                    // Launch Foreground Service to ensure NativeCallMonitor stays alive in background
                    val monitorIntent = Intent(this@MainActivity, com.academysales.crm.telecom.CallMonitorService::class.java).apply {
                        putExtra("callId", callId)
                        putExtra("leadId", leadId)
                        putExtra("phone", sanitized)
                    }
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        startForegroundService(monitorIntent)
                    } else {
                        startService(monitorIntent)
                    }

                    val hasCallPhone = androidx.core.content.ContextCompat.checkSelfPermission(
                        this@MainActivity, android.Manifest.permission.CALL_PHONE
                    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                    
                    val hasReadCallLog = androidx.core.content.ContextCompat.checkSelfPermission(
                        this@MainActivity, android.Manifest.permission.READ_CALL_LOG
                    ) == android.content.pm.PackageManager.PERMISSION_GRANTED

                    if (hasCallPhone && hasReadCallLog) {
                        val intent = Intent(Intent.ACTION_CALL, uri).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        startActivity(intent)
                    } else {
                        androidx.core.app.ActivityCompat.requestPermissions(
                            this@MainActivity,
                            arrayOf(
                                android.Manifest.permission.CALL_PHONE,
                                android.Manifest.permission.READ_CALL_LOG
                            ),
                            101
                        )
                        val intent = Intent(Intent.ACTION_DIAL, uri).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        startActivity(intent)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    try {
                        val sanitized = phoneNumber.replace(Regex("[^0-9+]"), "")
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$sanitized")).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        startActivity(intent)
                    } catch (ex: Exception) {
                        ex.printStackTrace()
                    }
                }
            }
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
        fun startCallAgentService() {
            com.academysales.crm.telecom.CallAgentService.startService(this@MainActivity)
        }

        @android.webkit.JavascriptInterface
        fun stopCallAgentService() {
            com.academysales.crm.telecom.CallAgentService.stopService(this@MainActivity)
        }

        @android.webkit.JavascriptInterface
        fun getCallMonitorStatus(): String {
            val isRunning = com.academysales.crm.telecom.CallAgentService.isRunning
            val queueLength = com.academysales.crm.telecom.CallEventQueueManager.getPendingQueueLength(this@MainActivity)
            val isDialer = isDefaultDialer()
            val activeCall = com.academysales.crm.telecom.CrmInCallService.activeCall != null
            return "{\"serviceRunning\":$isRunning,\"offlineQueueLength\":$queueLength,\"isDefaultDialer\":$isDialer,\"hasActiveCall\":$activeCall}"
        }

        @android.webkit.JavascriptInterface
        fun forceSyncQueue(serverBaseUrl: String, authToken: String?) {
            com.academysales.crm.telecom.CallEventQueueManager.flushQueue(this@MainActivity, serverBaseUrl, authToken)
        }

        @android.webkit.JavascriptInterface
        fun openAutoStartSettings() {
            runOnUiThread {
                try {
                    val intent = Intent().apply {
                        component = android.content.ComponentName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.autostart.AutoStartManagementActivity"
                        )
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    try {
                        val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.fromParts("package", packageName, null)
                        }
                        startActivity(intent)
                    } catch (ex: Exception) {
                        ex.printStackTrace()
                    }
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun openBatteryOptimizationSettings() {
            runOnUiThread {
                try {
                    val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    try {
                        val intent = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        startActivity(intent)
                    } catch (ex: Exception) {
                        ex.printStackTrace()
                    }
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun getDeviceDiagnostics(): String {
            val brand = android.os.Build.BRAND
            val model = android.os.Build.MODEL
            val sdk = android.os.Build.VERSION.SDK_INT
            val manufacturer = android.os.Build.MANUFACTURER
            val isXiaomi = brand.lowercase().contains("xiaomi") || brand.lowercase().contains("redmi") || brand.lowercase().contains("poco")
            val isDialer = isDefaultDialer()

            val hasPhonePerm = androidx.core.content.ContextCompat.checkSelfPermission(
                this@MainActivity,
                android.Manifest.permission.CALL_PHONE
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED

            val hasAudioPerm = if (sdk >= 33) {
                androidx.core.content.ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    android.Manifest.permission.READ_MEDIA_AUDIO
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            } else {
                androidx.core.content.ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    android.Manifest.permission.READ_EXTERNAL_STORAGE
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            }

            val hasNotifPerm = if (sdk >= 33) {
                androidx.core.content.ContextCompat.checkSelfPermission(
                    this@MainActivity,
                    "android.permission.POST_NOTIFICATIONS"
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED
            } else {
                true
            }

            val powerManager = getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
            val isIgnoringBattery = if (sdk >= 23) {
                powerManager?.isIgnoringBatteryOptimizations(packageName) ?: false
            } else {
                true
            }

            val isAgentRunning = com.academysales.crm.telecom.CallAgentService.isRunning
            val queueLength = com.academysales.crm.telecom.CallEventQueueManager.getPendingQueueLength(this@MainActivity)
            val recCap = com.academysales.crm.telecom.CallRecordingCapabilityManager.getCapability(this@MainActivity).name

            val callTrackingStatus = if (isAgentRunning && hasPhonePerm) "PASS" else "RESTRICTED"
            val telecomAccessStatus = if (hasPhonePerm) "PASS" else "RESTRICTED"
            val defaultDialerStatus = if (isDialer) "PASS" else "RESTRICTED"
            val recordingCapStatus = if (recCap == "SUPPORTED") "SUPPORTED" else "UNAVAILABLE"
            val recordingAccessStatus = if (hasAudioPerm) "PASS" else "RESTRICTED"
            val bgExecutionStatus = if (isAgentRunning) "PASS" else "RESTRICTED"
            val batteryOptimizationStatus = if (isIgnoringBattery) "PASS" else "ACTION REQUIRED"
            val autoStartStatus = if (isXiaomi) "ACTION REQUIRED" else "SUPPORTED"
            val notifStatus = if (hasNotifPerm) "PASS" else "RESTRICTED"
            val networkSyncStatus = if (queueLength == 0) "PASS" else "AVAILABLE"
            val aiStatus = "AVAILABLE"

            return "{" +
                "\"brand\":\"$brand\"," +
                "\"model\":\"$model\"," +
                "\"sdk\":$sdk," +
                "\"manufacturer\":\"$manufacturer\"," +
                "\"isXiaomi\":$isXiaomi," +
                "\"callTracking\":\"$callTrackingStatus\"," +
                "\"telecomAccess\":\"$telecomAccessStatus\"," +
                "\"defaultDialer\":\"$defaultDialerStatus\"," +
                "\"recordingCapability\":\"$recordingCapStatus\"," +
                "\"recordingAccess\":\"$recordingAccessStatus\"," +
                "\"backgroundExecution\":\"$bgExecutionStatus\"," +
                "\"batteryOptimization\":\"$batteryOptimizationStatus\"," +
                "\"autoStart\":\"$autoStartStatus\"," +
                "\"notifications\":\"$notifStatus\"," +
                "\"networkSync\":\"$networkSyncStatus\"," +
                "\"aiAvailability\":\"$aiStatus\"," +
                "\"offlineQueueLength\":$queueLength" +
                "}"
        }

        @android.webkit.JavascriptInterface
        fun placeTelecomCall(phoneNumber: String, leadId: String, callId: String, authToken: String?) {
            runOnUiThread {
                try {
                    val formatted = phoneNumber.replace(Regex("[^0-9+]"), "")
                    com.academysales.crm.telecom.CrmInCallService.currentCallLogId = callId
                    com.academysales.crm.telecom.CrmInCallService.currentPhoneNumber = formatted
                    com.academysales.crm.telecom.CrmInCallService.userAuthToken = authToken

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
