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

        val leadName = intent.getStringExtra("leadName") ?: CrmInCallService.currentLeadId ?: "Academy CRM Lead"
        val rawPhone = intent.getStringExtra("phone") ?: CrmInCallService.currentPhoneNumber ?: ""
        val callId = intent.getStringExtra("callId") ?: CrmInCallService.currentCallLogId ?: ""

        Log.d(TAG, "CrmCallActivity launched for leadName=$leadName, phone=$rawPhone, callId=$callId")

        // Build Modern Dark Sleek Slate In-Call UI Programmatically
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(64, 120, 64, 96)
            setBackgroundColor(0xFF0F172A.toInt()) // Deep Dark Slate #0F172A
        }

        // Live Audio Recording Pill Indicator
        tvRecStatus = TextView(this).apply {
            text = "🔴 LIVE RECORDING & TELEMETRY ACTIVE"
            textSize = 11f
            setTextColor(0xFFF43F5E.toInt()) // Rose
            gravity = Gravity.CENTER
            setPadding(24, 12, 24, 12)
            setBackgroundColor(0xFF881337.toInt()) // Dark Crimson
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }

        tvCallerName = TextView(this).apply {
            text = leadName
            textSize = 26f
            setTextColor(0xFFF8FAFC.toInt())
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 48, 0, 8)
        }

        tvPhoneNumber = TextView(this).apply {
            text = if (rawPhone.isNotEmpty()) rawPhone else "Cellular SIM Call"
            textSize = 16f
            setTextColor(0xFF94A3B8.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 48)
        }

        tvCallState = TextView(this).apply {
            text = "DIALING / RINGING..."
            textSize = 14f
            setTextColor(0xFFF59E0B.toInt()) // Amber
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, 16)
        }

        tvTimer = TextView(this).apply {
            text = "00:00"
            textSize = 44f
            setTextColor(0xFFF8FAFC.toInt())
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 0, 0, 64)
        }

        val buttonContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 48)
        }

        btnMute = Button(this).apply {
            text = "MUTE"
            textSize = 13f
            setTextColor(0xFFF8FAFC.toInt())
            setBackgroundColor(0xFF334155.toInt()) // Slate
            setOnClickListener {
                isMuted = !isMuted
                audioManager?.isMicrophoneMute = isMuted
                text = if (isMuted) "MUTED 🔇" else "MUTE 🎙️"
                setBackgroundColor(if (isMuted) 0xFFDC2626.toInt() else 0xFF334155.toInt())
            }
        }

        btnSpeaker = Button(this).apply {
            text = "SPEAKER"
            textSize = 13f
            setTextColor(0xFFF8FAFC.toInt())
            setBackgroundColor(0xFF334155.toInt()) // Slate
            setOnClickListener {
                isSpeakerOn = !isSpeakerOn
                audioManager?.isSpeakerphoneOn = isSpeakerOn
                text = if (isSpeakerOn) "SPEAKER ON 🔊" else "SPEAKER 🔈"
                setBackgroundColor(if (isSpeakerOn) 0xFF0284C7.toInt() else 0xFF334155.toInt())
            }
        }

        val param = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            setMargins(12, 0, 12, 0)
        }
        buttonContainer.addView(btnMute, param)
        buttonContainer.addView(btnSpeaker, param)

        btnEndCall = Button(this).apply {
            text = "☎ END CALL"
            textSize = 16f
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFFDC2626.toInt()) // Bright Red #DC2626
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(48, 28, 48, 28)
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
                }, 1500)
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
