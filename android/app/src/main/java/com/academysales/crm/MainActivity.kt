package com.academysales.crm

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Secure AssetLoader to load offline Vite dist securely via virtual domain
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true

            // Attach native JS bridge object window.AndroidCRM
            addJavascriptInterface(WebAppInterface(), "AndroidCRM")
        }

        setContentView(webView)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): android.webkit.WebResourceResponse? {
                if (request == null) return null
                val response = assetLoader.shouldInterceptRequest(request.url)
                if (response != null) return response

                // SPA Fallback: If requesting an appassets route without file extension (e.g. /salesperson/queue), serve index.html
                val path = request.url.path ?: ""
                if (request.url.host == "appassets.androidplatform.net" && !path.contains(".")) {
                    val indexUri = Uri.parse("https://appassets.androidplatform.net/index.html")
                    return assetLoader.shouldInterceptRequest(indexUri)
                }
                return null
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

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    // Auto-recover from navigation/response errors by reloading index.html
                    view?.loadUrl("https://appassets.androidplatform.net/index.html")
                }
            }
        }

        // Modern Android Hardware Back Button navigation handling
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized) {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        val currentUrl = webView.url ?: ""
                        if (!currentUrl.endsWith("index.html") && !currentUrl.endsWith("/")) {
                            webView.loadUrl("https://appassets.androidplatform.net/index.html")
                        } else {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        // Register 401 auth error listener for offline event queue sync
        com.academysales.crm.telecom.CallEventQueueManager.onAuthErrorListener = {
            runOnUiThread {
                if (::webView.isInitialized) {
                    webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('crmAuthExpired'));", null)
                }
            }
        }

        com.academysales.crm.telecom.NativeCallMonitor.webViewRef = java.lang.ref.WeakReference(webView)

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
        if (url.startsWith("tel:")) {
            try {
                val intent = Intent(Intent.ACTION_CALL, Uri.parse(url))
                startActivity(intent)
            } catch (e: Exception) {
                try {
                    val intent = Intent(Intent.ACTION_DIAL, Uri.parse(url))
                    startActivity(intent)
                } catch (ex: Exception) {
                    ex.printStackTrace()
                }
            }
            return true
        }
        return false
    }

    inner class WebAppInterface {

        @android.webkit.JavascriptInterface
        fun requestRuntimePermission(permission: String) {
            runOnUiThread {
                try {
                    androidx.core.app.ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(permission),
                        102
                    )
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun openAppSettings() {
            runOnUiThread {
                try {
                    val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:$packageName")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun openAllFilesAccessSettings() {
            checkAndRequestAllFilesAccess()
        }

        @android.webkit.JavascriptInterface
        fun openXiaomiAutoStartSettings() {
            runOnUiThread {
                try {
                    val intent = Intent().apply {
                        component = android.content.ComponentName(
                            "com.miui.securitycenter",
                            "com.miui.permcenter.autostart.AutoStartManagementActivity"
                        )
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    openAppSettings()
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun isDefaultDialerHeld(): Boolean {
            return try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    val roleManager = getSystemService(Context.ROLE_SERVICE) as? android.app.role.RoleManager
                    roleManager?.isRoleHeld(android.app.role.RoleManager.ROLE_DIALER) == true
                } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    val telecomManager = getSystemService(Context.TELECOM_SERVICE) as? android.telecom.TelecomManager
                    telecomManager?.defaultDialerPackage == packageName
                } else {
                    false
                }
            } catch (e: Exception) {
                false
            }
        }

        @android.webkit.JavascriptInterface
        fun requestDefaultDialer() {
            runOnUiThread {
                try {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                        val roleManager = getSystemService(Context.ROLE_SERVICE) as? android.app.role.RoleManager
                        if (roleManager != null && roleManager.isRoleAvailable(android.app.role.RoleManager.ROLE_DIALER)) {
                            val intent = roleManager.createRequestRoleIntent(android.app.role.RoleManager.ROLE_DIALER)
                            startActivity(intent)
                        }
                    } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        val intent = Intent(android.telecom.TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                            putExtra(android.telecom.TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, packageName)
                        }
                        startActivity(intent)
                    }
                } catch (e: Exception) {
                    openAppSettings()
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun openNotificationListenerSettings() {
            runOnUiThread {
                try {
                    val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    openAppSettings()
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun requestBatteryOptimizationExemption() {
            runOnUiThread {
                try {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                            data = Uri.parse("package:$packageName")
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                        }
                        startActivity(intent)
                    }
                } catch (e: Exception) {
                    openAppSettings()
                }
            }
        }

        @android.webkit.JavascriptInterface
        fun setServerConfig(serverBaseUrl: String?, authToken: String?) {
            if (!serverBaseUrl.isNullOrEmpty() && !serverBaseUrl.contains("androidplatform.net")) {
                var cleanUrl = serverBaseUrl.trimEnd('/')
                if (!cleanUrl.endsWith("/api")) {
                    cleanUrl = "$cleanUrl/api"
                }
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
        fun endCall(callId: String?) {
            com.academysales.crm.telecom.NativeCallMonitor.endCall(this@MainActivity, callId)
        }

        @android.webkit.JavascriptInterface
        fun startCrmCall(phoneNumber: String, leadId: String?, callId: String?) {
            placeTelecomCall(phoneNumber, leadId, callId, null)
        }

        @android.webkit.JavascriptInterface
        fun placeTelecomCall(phoneNumber: String, leadId: String?, callId: String?) {
            placeTelecomCall(phoneNumber, leadId, callId, null)
        }

        @android.webkit.JavascriptInterface
        fun placeTelecomCall(phoneNumber: String, leadId: String?, callId: String?, authToken: String?) {
            runOnUiThread {
                try {
                    val sanitized = phoneNumber.replace(Regex("[^0-9+]"), "")
                    val uri = Uri.parse("tel:$sanitized")

                    if (!authToken.isNullOrEmpty()) {
                        getSharedPreferences("crm_prefs", Context.MODE_PRIVATE)
                            .edit()
                            .putString("auth_token", authToken)
                            .apply()
                        com.academysales.crm.telecom.CrmInCallService.userAuthToken = authToken
                    }

                    com.academysales.crm.telecom.CrmInCallService.resetSession(callId, leadId, sanitized, "outbound")

                    // Launch Foreground Service to ensure NativeCallMonitor stays alive in background and watches CallLog
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

                    // Launch Native In-Call CRM Dialer Activity
                    try {
                        val callUiIntent = Intent(this@MainActivity, com.academysales.crm.telecom.CrmCallActivity::class.java).apply {
                            putExtra("callId", callId)
                            putExtra("leadId", leadId)
                            putExtra("phone", sanitized)
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        }
                        startActivity(callUiIntent)
                    } catch (e: Exception) {
                        Log.w("MainActivity", "Could not launch CrmCallActivity: ${e.message}")
                    }

                    if (hasCallPhone && hasReadCallLog) {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                            val telecomManager = getSystemService(Context.TELECOM_SERVICE) as? android.telecom.TelecomManager
                            if (telecomManager != null) {
                                val isHeld = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                                    val roleManager = getSystemService(Context.ROLE_SERVICE) as? android.app.role.RoleManager
                                    roleManager?.isRoleHeld(android.app.role.RoleManager.ROLE_DIALER) == true
                                } else {
                                    telecomManager.defaultDialerPackage == packageName
                                }

                                if (!isHeld) {
                                    Log.e("MainActivity", "ROLE_DIALER is NOT held by $packageName. Refusing to place call via fallback.")
                                    requestDefaultDialer()
                                    return@runOnUiThread
                                }

                                val extras = Bundle()
                                val accounts = telecomManager.callCapablePhoneAccounts
                                val defaultAccount = telecomManager.getDefaultOutgoingPhoneAccount("tel")
                                    ?: accounts?.firstOrNull()
                                if (defaultAccount != null) {
                                    extras.putParcelable(android.telecom.TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, defaultAccount)
                                }
                                telecomManager.placeCall(uri, extras)
                                Log.d("MainActivity", "Successfully placed call via TelecomManager.placeCall directly!")
                            } else {
                                Log.e("MainActivity", "TelecomManager unavailable!")
                            }
                        }
                    } else {
                        androidx.core.app.ActivityCompat.requestPermissions(
                            this@MainActivity,
                            arrayOf(
                                android.Manifest.permission.CALL_PHONE,
                                android.Manifest.permission.READ_CALL_LOG
                            ),
                            101
                        )
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
        fun getDeviceDiagnostics(): String {
            val brand = android.os.Build.BRAND
            val model = android.os.Build.MODEL
            val sdk = android.os.Build.VERSION.SDK_INT
            val manufacturer = android.os.Build.MANUFACTURER

            val isXiaomi = manufacturer.equals("Xiaomi", ignoreCase = true) ||
                brand.equals("Xiaomi", ignoreCase = true) ||
                brand.equals("POCO", ignoreCase = true) ||
                brand.equals("Redmi", ignoreCase = true)

            val telecomManager = getSystemService(Context.TELECOM_SERVICE) as? android.telecom.TelecomManager
            val isDialer = telecomManager?.defaultDialerPackage == packageName

            val hasPhonePerm = androidx.core.content.ContextCompat.checkSelfPermission(
                this@MainActivity,
                android.Manifest.permission.CALL_PHONE
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED

            val hasCallLogPerm = androidx.core.content.ContextCompat.checkSelfPermission(
                this@MainActivity,
                android.Manifest.permission.READ_CALL_LOG
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED

            val hasPhoneStatePerm = androidx.core.content.ContextCompat.checkSelfPermission(
                this@MainActivity,
                android.Manifest.permission.READ_PHONE_STATE
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED

            val hasStorageAccess = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                android.os.Environment.isExternalStorageManager()
            } else if (android.os.Build.VERSION.SDK_INT >= 33) {
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

            val queueLength = com.academysales.crm.telecom.CallEventQueueManager.getPendingQueueLength(this@MainActivity)
            val recCap = com.academysales.crm.telecom.CallRecordingCapabilityManager.getCapability(this@MainActivity).name

            // Permission rationale flags (for detecting permanently denied / don't ask again state)
            val showPhoneRationale = androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, android.Manifest.permission.CALL_PHONE)
            val showCallLogRationale = androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, android.Manifest.permission.READ_CALL_LOG)
            val showPhoneStateRationale = androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, android.Manifest.permission.READ_PHONE_STATE)
            val showNotifRationale = if (sdk >= 33) androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(this@MainActivity, "android.permission.POST_NOTIFICATIONS") else false

            // Corrected audit logic reflecting Native Call Monitor architecture:
            val callTrackingStatus = if (hasPhonePerm && hasCallLogPerm && hasPhoneStatePerm) "PASS" else "RESTRICTED"
            val telecomAccessStatus = if (hasPhonePerm) "PASS" else "RESTRICTED"
            val defaultDialerStatus = if (isDialer) "PASS" else "SUPPORTED"
            val recordingCapStatus = if (recCap == "SUPPORTED") "SUPPORTED" else if (recCap == "RESTRICTED") "RESTRICTED" else "UNAVAILABLE"
            val recordingAccessStatus = if (hasStorageAccess) "PASS" else "RESTRICTED"
            val bgExecutionStatus = if (hasPhonePerm) "PASS" else "RESTRICTED"
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
                "\"hasCallPhone\":$hasPhonePerm," +
                "\"hasReadCallLog\":$hasCallLogPerm," +
                "\"hasReadPhoneState\":$hasPhoneStatePerm," +
                "\"hasPostNotif\":$hasNotifPerm," +
                "\"hasStorageAccess\":$hasStorageAccess," +
                "\"isIgnoringBattery\":$isIgnoringBattery," +
                "\"showPhoneRationale\":$showPhoneRationale," +
                "\"showCallLogRationale\":$showCallLogRationale," +
                "\"showPhoneStateRationale\":$showPhoneStateRationale," +
                "\"showNotifRationale\":$showNotifRationale," +
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
    }
}
