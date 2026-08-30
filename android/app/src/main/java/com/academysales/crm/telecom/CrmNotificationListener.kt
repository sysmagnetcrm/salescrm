package com.academysales.crm.telecom

import android.app.Notification
import android.content.Context
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class CrmNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "CrmNotifListener"

        private val DIALER_PACKAGES = setOf(
            "com.google.android.dialer",
            "com.android.incallui",
            "com.miui.incallui",
            "com.samsung.android.incallui",
            "com.samsung.android.dialer",
            "com.android.phone",
            "com.oneplus.dialer",
            "com.coloros.selectmaint",
            "com.vivo.incallui"
        )
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "NotificationListener connected successfully.")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val pkg = sbn.packageName ?: ""
        val notification = sbn.notification ?: return

        // Check if notification is from a phone dialer app or category is CALL
        val isDialerApp = DIALER_PACKAGES.contains(pkg) || pkg.contains("dialer") || pkg.contains("incall")
        val isCallCategory = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            notification.category == Notification.CATEGORY_CALL
        } else {
            false
        }

        if (isDialerApp || isCallCategory) {
            val extras = notification.extras
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
            val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
            val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: ""

            val combined = "$title $text $subText".lowercase()
            Log.d(TAG, "Dialer Notification Posted [pkg=$pkg]: title='$title', text='$text'")

            // Signal NativeCallMonitor that call is active/connected
            if (combined.contains("ongoing") || combined.contains("connected") || 
                combined.contains("in call") || combined.contains("00:") || 
                combined.contains("calling") || isCallCategory) {
                NativeCallMonitor.notifyCallConnectedFromNotification(applicationContext)
            }
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
        if (sbn == null) return

        val pkg = sbn.packageName ?: ""
        val notification = sbn.notification

        val isDialerApp = DIALER_PACKAGES.contains(pkg) || pkg.contains("dialer") || pkg.contains("incall")
        val isCallCategory = notification != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && notification.category == Notification.CATEGORY_CALL

        if (isDialerApp || isCallCategory) {
            Log.d(TAG, "Dialer Notification Removed [pkg=$pkg]. Signal call disconnect check.")
            NativeCallMonitor.notifyCallDisconnectedFromNotification(applicationContext)
        }
    }
}
