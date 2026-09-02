package com.academysales.crm.telecom

import android.content.Context
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.Call
import android.util.Log
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class CrmCallActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "CrmCallActivity"
    }

    private lateinit var tvInitials: TextView
    private lateinit var tvCallerName: TextView
    private lateinit var tvPhoneNumber: TextView
    private lateinit var tvCallState: TextView
    private lateinit var tvTimer: TextView
    private lateinit var tvRecStatus: TextView
    private lateinit var btnEndCall: Button
    private lateinit var btnMute: Button
    private lateinit var btnSpeaker: Button

    private var secondsElapsed = 0
    private var isTimerRunning = false
    private var handler = Handler(Looper.getMainLooper())
    private var isMuted = false
    private var isSpeakerOn = false
    private var audioManager: AudioManager? = null

    private val timerRunnable = object : Runnable {
        override fun run() {
            if (isTimerRunning) {
                secondsElapsed++
                val mins = secondsElapsed / 60
                val secs = secondsElapsed % 60
                tvTimer.text = String.format("%02d:%02d", mins, secs)
                handler.postDelayed(this, 1000)
            }
        }
    }

    private val callCallback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            super.onStateChanged(call, state)
            runOnUiThread {
                updateUiForState(state)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager

        var leadName = intent.getStringExtra("leadName")
        val rawPhone = intent.getStringExtra("phone") ?: CrmInCallService.currentPhoneNumber ?: ""
        val callId = intent.getStringExtra("callId") ?: CrmInCallService.currentCallLogId ?: ""

        // Sanitize lead name to avoid raw UUID display
        if (leadName.isNullOrEmpty() || leadName.matches(Regex("[0-9a-fA-F-]{30,}"))) {
            leadName = "Academy CRM Lead"
        }

        val formattedPhone = formatDisplayPhone(rawPhone)
        val initials = getInitials(leadName)

        Log.d(TAG, "CrmCallActivity initialized for leadName=$leadName, phone=$formattedPhone, callId=$callId")

        // Build Premium Dark Slate UI Programmatically
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(48, 80, 48, 64)
            setBackgroundColor(0xFF0F172A.toInt()) // Deep Dark Slate #0F172A
        }

        // Live Audio & Telemetry Active Badge
        tvRecStatus = TextView(this).apply {
            text = "CRM DIALER ACTIVE • REAL-TIME TELEMETRY"
            textSize = 10f
            setTextColor(0xFF38BDF8.toInt()) // Sky Blue
            gravity = Gravity.CENTER
            setPadding(20, 10, 20, 10)
            setBackgroundColor(0xFF1E293B.toInt()) // Dark Slate
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }

        // Initials Avatar Circle
        tvInitials = TextView(this).apply {
            text = initials
            textSize = 36f
            setTextColor(0xFF38BDF8.toInt()) // Sky Blue text
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            val size = 220
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                setMargins(0, 40, 0, 24)
                gravity = Gravity.CENTER
            }
            setBackgroundColor(0xFF1E293B.toInt()) // Slate Container
        }

        tvCallerName = TextView(this).apply {
            text = leadName
            textSize = 28f
            setTextColor(0xFFF8FAFC.toInt())
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 8, 0, 4)
        }

        tvPhoneNumber = TextView(this).apply {
            text = formattedPhone
            textSize = 17f
            setTextColor(0xFF94A3B8.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 36)
        }

        tvCallState = TextView(this).apply {
            text = "DIALING CELLULAR..."
            textSize = 14f
            setTextColor(0xFFF59E0B.toInt()) // Amber #F59E0B
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, 12)
        }

        tvTimer = TextView(this).apply {
            text = "00:00"
            textSize = 46f
            setTextColor(0xFFF8FAFC.toInt())
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 0, 0, 48)
        }

        val buttonContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 16, 0, 36)
        }

        btnMute = Button(this).apply {
            text = "MUTE"
            textSize = 13f
            setTextColor(0xFFF8FAFC.toInt())
            setBackgroundColor(0xFF334155.toInt())
            setOnClickListener {
                isMuted = !isMuted
                audioManager?.isMicrophoneMute = isMuted
                text = if (isMuted) "MUTED" else "MUTE"
                setBackgroundColor(if (isMuted) 0xFFDC2626.toInt() else 0xFF334155.toInt())
            }
        }

        btnSpeaker = Button(this).apply {
            text = "SPEAKER"
            textSize = 13f
            setTextColor(0xFFF8FAFC.toInt())
            setBackgroundColor(0xFF334155.toInt())
            setOnClickListener {
                isSpeakerOn = !isSpeakerOn
                audioManager?.isSpeakerphoneOn = isSpeakerOn
                text = if (isSpeakerOn) "SPEAKER ON" else "SPEAKER"
                setBackgroundColor(if (isSpeakerOn) 0xFF0284C7.toInt() else 0xFF334155.toInt())
            }
        }

        val btnParam = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            setMargins(12, 0, 12, 0)
        }
        buttonContainer.addView(btnMute, btnParam)
        buttonContainer.addView(btnSpeaker, btnParam)

        btnEndCall = Button(this).apply {
            text = "END CALL"
            textSize = 17f
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFFDC2626.toInt()) // Red #DC2626
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(48, 30, 48, 30)
            setOnClickListener {
                Log.d(TAG, "User clicked END CALL on CrmCallActivity")
                try {
                    CrmInCallService.activeCall?.disconnect()
                } catch (e: Exception) {
                    Log.e(TAG, "Error disconnecting activeCall: ${e.message}")
                }
                NativeCallMonitor.endCall(this@CrmCallActivity, callId)
                finish()
            }
        }

        layout.addView(tvRecStatus)
        layout.addView(tvInitials)
        layout.addView(tvCallerName)
        layout.addView(tvPhoneNumber)
        layout.addView(tvCallState)
        layout.addView(tvTimer)
        layout.addView(buttonContainer)
        layout.addView(btnEndCall)

        setContentView(layout)

        // Bind active Telecom call if available
        CrmInCallService.activeCall?.let { call ->
            call.registerCallback(callCallback)
            updateUiForState(call.details.state)
        }
    }

    private fun formatDisplayPhone(phone: String): String {
        if (phone.isEmpty()) return "Cellular SIM Call"
        val digits = phone.replace(Regex("[^0-9+]"), "")
        return if (digits.length == 10) {
            "+91 ${digits.substring(0, 5)} ${digits.substring(5)}"
        } else if (digits.startsWith("+91") && digits.length == 13) {
            "+91 ${digits.substring(3, 8)} ${digits.substring(8)}"
        } else {
            digits
        }
    }

    private fun getInitials(name: String): String {
        val parts = name.trim().split(" ").filter { it.isNotEmpty() }
        return when {
            parts.size >= 2 -> "${parts[0].first().uppercase()}${parts[1].first().uppercase()}"
            parts.isNotEmpty() && parts[0].isNotEmpty() -> parts[0].take(2).uppercase()
            else -> "AC"
        }
    }

    private fun updateUiForState(state: Int) {
        when (state) {
            Call.STATE_CONNECTING, Call.STATE_DIALING -> {
                tvCallState.text = "DIALING CELLULAR..."
                tvCallState.setTextColor(0xFFF59E0B.toInt()) // Amber
            }
            Call.STATE_RINGING -> {
                tvCallState.text = "RINGING..."
                tvCallState.setTextColor(0xFF38BDF8.toInt()) // Sky Blue
            }
            Call.STATE_ACTIVE -> {
                tvCallState.text = "CONNECTED"
                tvCallState.setTextColor(0xFF10B981.toInt()) // Emerald Green
                startTimer()
            }
            Call.STATE_DISCONNECTED, Call.STATE_DISCONNECTING -> {
                tvCallState.text = "CALL ENDED"
                tvCallState.setTextColor(0xFFEF4444.toInt()) // Red
                stopTimer()
                handler.postDelayed({
                    if (!isFinishing) finish()
                }, 1200)
            }
        }
    }

    private fun startTimer() {
        if (!isTimerRunning) {
            isTimerRunning = true
            handler.post(timerRunnable)
        }
    }

    private fun stopTimer() {
        isTimerRunning = false
        handler.removeCallbacks(timerRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        stopTimer()
        try {
            CrmInCallService.activeCall?.unregisterCallback(callCallback)
        } catch (e: Exception) {
            // Ignore callback unregister error
        }
    }
}
