package com.academysales.crm.telecom

import android.content.Intent
import android.telecom.Call
import android.telecom.InCallService
import android.util.Log

class CrmInCallService : InCallService() {

    companion object {
        private const val TAG = "CrmInCallService"
        var activeCall: Call? = null
            private set
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        Log.d(TAG, "onCallAdded: ${call.details.handle}")
        activeCall = call

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                super.onStateChanged(call, state)
                Log.d(TAG, "onStateChanged: state = $state")
            }
        })

        // Launch Native In-Call UI
        val intent = Intent(this, CrmCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        startActivity(intent)
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        Log.d(TAG, "onCallRemoved")
        if (activeCall == call) {
            activeCall = null
        }
    }
}
