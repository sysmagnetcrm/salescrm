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
        val manufacturer = Build.MANUFACTURER.lowercase()
        val brand = Build.BRAND.lowercase()
        val model = Build.MODEL.lowercase()
        val isXiaomiOem = manufacturer.contains("xiaomi") || brand.contains("xiaomi") || brand.contains("redmi") || brand.contains("poco") || model.contains("mi ")

        // Check if MediaStore audio permissions or OEM recording directories are accessible
        val hasStoragePermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_MEDIA_AUDIO) == android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_EXTERNAL_STORAGE) == android.content.pm.PackageManager.PERMISSION_GRANTED
        }

        return when {
            isXiaomiOem && hasStoragePermission -> RecordingCapability.SUPPORTED
            isXiaomiOem && !hasStoragePermission -> RecordingCapability.RESTRICTED
            hasStoragePermission -> RecordingCapability.SUPPORTED
            else -> RecordingCapability.RESTRICTED
        }
    }

    fun getCapabilityDescription(context: Context): String {
        val capability = getCapability(context)
        val manufacturer = Build.MANUFACTURER
        return when (capability) {
            RecordingCapability.SUPPORTED -> "Two-way OEM cellular call recording supported & accessible via MediaStore ($manufacturer)."
            RecordingCapability.UNSUPPORTED -> "Call recording unsupported on generic device without native OEM recorder."
            RecordingCapability.RESTRICTED -> "Storage/Media permission required to access native OEM call recordings."
            RecordingCapability.UNKNOWN -> "Device recording capability unknown."
        }
    }
}
