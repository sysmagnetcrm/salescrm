package com.academysales.crm.telecom

import android.content.Context
import android.os.Build

object CallRecordingCapabilityManager {

    enum class RecordingCapability {
        SUPPORTED,
        UNSUPPORTED,
        RESTRICTED,
        UNKNOWN
    }

    fun getCapability(context: Context): RecordingCapability {
        // Modern Android (Android 10 / API 29+) enforces strict platform privacy restrictions
        // that prevent non-system applications from recording cellular voice audio streams.
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            RecordingCapability.UNSUPPORTED
        } else {
            RecordingCapability.RESTRICTED
        }
    }

    fun getCapabilityDescription(context: Context): String {
        val capability = getCapability(context)
        return when (capability) {
            RecordingCapability.SUPPORTED -> "Two-way cellular call recording supported."
            RecordingCapability.UNSUPPORTED -> "Call recording is unsupported on this device (Android 10+ cellular privacy restrictions)."
            RecordingCapability.RESTRICTED -> "Call recording is restricted by device hardware or carrier policy."
            RecordingCapability.UNKNOWN -> "Device recording capability unknown."
        }
    }
}
