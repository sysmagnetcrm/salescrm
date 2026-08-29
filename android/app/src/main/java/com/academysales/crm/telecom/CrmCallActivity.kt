package com.academysales.crm.telecom

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.Call
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class CrmCallActivity : AppCompatActivity() {

    private lateinit var tvCallerName: TextView
    private lateinit var tvPhoneNumber: TextView
    private lateinit var tvCallState: TextView
    private lateinit var tvTimer: TextView
    private lateinit var btnEndCall: Button
    private lateinit var btnMute: Button
    private lateinit var btnSpeaker: Button

    private var secondsElapsed = 0
    private var handler = Handler(Looper.getMainLooper())
    private var isMuted = false
    private var isSpeakerOn = false

    private val timerRunnable = object : Runnable {
        override fun run() {
            secondsElapsed++
            val mins = secondsElapsed / 60
            val secs = secondsElapsed % 60
            tvTimer.text = String.format("%02d:%02d", mins, secs)
            handler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Build Native Call UI Programmatically (No XML layout dependency)
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            setPadding(48, 96, 48, 96)
            setBackgroundColor(0xFF1E293B.toInt()) // Dark Sleek Slate
        }

        tvCallerName = TextView(this).apply {
            text = "Academy Lead"
            textSize = 24f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }

        tvPhoneNumber = TextView(this).apply {
            text = "+91 98765 43210"
            textSize = 16f
            setTextColor(0xFF94A3B8.toInt())
            gravity = android.view.Gravity.CENTER
            setPadding(0, 8, 0, 32)
        }

        tvCallState = TextView(this).apply {
            text = "CONNECTED"
            textSize = 14f
            setTextColor(0xFF38BDF8.toInt()) // Sky Blue
            gravity = android.view.Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }

        tvTimer = TextView(this).apply {
            text = "00:00"
            textSize = 32f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
            typeface = android.graphics.Typeface.MONOSPACE
            setPadding(0, 0, 0, 48)
        }

        val buttonContainer = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER
            setPadding(0, 32, 0, 32)
        }

        btnMute = Button(this).apply {
            text = "MUTE"
            setOnClickListener {
                isMuted = !isMuted
                text = if (isMuted) "MUTED" else "MUTE"
            }
        }

        btnSpeaker = Button(this).apply {
            text = "SPEAKER"
            setOnClickListener {
                isSpeakerOn = !isSpeakerOn
                text = if (isSpeakerOn) "SPEAKER ON" else "SPEAKER"
            }
        }

        buttonContainer.addView(btnMute)
        buttonContainer.addView(btnSpeaker)

        btnEndCall = Button(this).apply {
            text = "END CALL"
            setBackgroundColor(0xFFEF4444.toInt()) // Red
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 16f
            setPadding(32, 16, 32, 16)
            setOnClickListener {
                CrmInCallService.activeCall?.disconnect()
                finish()
            }
        }

        layout.addView(tvCallerName)
        layout.addView(tvPhoneNumber)
        layout.addView(tvCallState)
        layout.addView(tvTimer)
        layout.addView(buttonContainer)
        layout.addView(btnEndCall)

        setContentView(layout)
        handler.postDelayed(timerRunnable, 1000)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(timerRunnable)
    }
}
