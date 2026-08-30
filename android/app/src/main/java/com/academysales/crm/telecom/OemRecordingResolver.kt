package com.academysales.crm.telecom

import android.content.Context
import android.database.Cursor
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

object OemRecordingResolver {

    private const val TAG = "OemRecordingResolver"

    enum class ReconciliationStatus {
        AVAILABLE,
        UNAVAILABLE,
        PROCESSING,
        AMBIGUOUS
    }

    data class CandidateRecording(
        val fileOrUri: String,
        val fileName: String,
        val durationSeconds: Long,
        val createdAtMillis: Long,
        val sizeBytes: Long,
        val confidenceScore: Int,
        val matchedPhoneNumber: String?
    )

    // Comprehensive OEM storage paths across Xiaomi HyperOS/MIUI, Samsung, OnePlus, Oppo, Vivo, RealMe
    private val OEM_RECORDING_PATHS = arrayOf(
        "/storage/emulated/0/MIUI/sound_recorder/call_rec/",
        "/sdcard/MIUI/sound_recorder/call_rec/",
        "/storage/emulated/0/Recordings/Call/",
        "/storage/emulated/0/Recordings/CallRec/",
        "/storage/emulated/0/Music/sound_recorder/call_rec/",
        "/storage/emulated/0/CallRecordings/",
        "/storage/emulated/0/Recorder/call_rec/",
        "/storage/emulated/0/Recordings/",
        "/storage/emulated/0/Sounds/",
        "/storage/emulated/0/Call/",
        "/storage/emulated/0/VoiceRecorder/",
        "/storage/emulated/0/recorder/",
        "/storage/emulated/0/Android/data/com.google.android.dialer/files/call_recordings/"
    )

    fun resolveAndUploadRecording(
        context: Context,
        callLogId: String,
        targetPhoneNumber: String,
        callDirection: String,
        talkDurationSeconds: Long,
        endedAtMillis: Long,
        serverUploadUrl: String,
        authToken: String?
    ) {
        thread {
            try {
                Log.d(TAG, "Starting OEM Recording Reconciliation for callLogId=$callLogId, targetPhone=$targetPhoneNumber, talkDuration=${talkDurationSeconds}s")

                // Wait 2.0 seconds to allow OEM system dialer to flush audio file
                Thread.sleep(2000)

                val candidates = findCandidateRecordings(context, targetPhoneNumber, endedAtMillis, talkDurationSeconds)

                val strongCandidates = candidates.filter { it.confidenceScore >= 45 }

                when {
                    strongCandidates.isNotEmpty() -> {
                        val winner = strongCandidates.maxByOrNull { it.confidenceScore }!!
                        Log.d(TAG, "✅ Recording match found: ${winner.fileName} (Score: ${winner.confidenceScore}%, path=${winner.fileOrUri})")
                        uploadRecordingFile(context, winner, callLogId, serverUploadUrl, authToken)
                    }
                    else -> {
                        Log.w(TAG, "❌ No OEM call recording matched candidate criteria for callLogId=$callLogId")
                        notifyServerStatus(callLogId, ReconciliationStatus.UNAVAILABLE, serverUploadUrl, authToken, "Recording unavailable")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in OEM Recording Reconciliation thread: ${e.message}", e)
            }
        }
    }

    private fun findCandidateRecordings(
        context: Context,
        targetPhoneNumber: String,
        endedAtMillis: Long,
        talkDurationSeconds: Long
    ): List<CandidateRecording> {
        val candidates = mutableListOf<CandidateRecording>()
        val normalizedTargetPhone = sanitizePhoneNumber(targetPhoneNumber)

        // 1. Search MediaStore Audio
        try {
            val projection = arrayOf(
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.DATE_ADDED,
                MediaStore.Audio.Media.DATE_MODIFIED,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.SIZE
            )

            // Search files added in last 2 hours
            val minDate = (endedAtMillis / 1000) - 7200
            val selection = "${MediaStore.Audio.Media.DATE_ADDED} >= ?"
            val selectionArgs = arrayOf(minDate.toString())
            val sortOrder = "${MediaStore.Audio.Media.DATE_ADDED} DESC"

            val cursor: Cursor? = context.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                sortOrder
            )

            cursor?.use { c ->
                val nameIdx = c.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
                val dataIdx = c.getColumnIndex(MediaStore.Audio.Media.DATA)
                val dateIdx = c.getColumnIndex(MediaStore.Audio.Media.DATE_ADDED)
                val durIdx = c.getColumnIndex(MediaStore.Audio.Media.DURATION)
                val sizeIdx = c.getColumnIndex(MediaStore.Audio.Media.SIZE)

                while (c.moveToNext()) {
                    val name = if (nameIdx != -1) c.getString(nameIdx) ?: "" else ""
                    val path = if (dataIdx != -1) c.getString(dataIdx) ?: "" else ""
                    val dateSec = if (dateIdx != -1) c.getLong(dateIdx) else 0L
                    val durMillis = if (durIdx != -1) c.getLong(durIdx) else 0L
                    val size = if (sizeIdx != -1) c.getLong(sizeIdx) else 0L

                    val durSec = durMillis / 1000
                    val fileTimeMillis = dateSec * 1000

                    val score = scoreCandidate(name, path, normalizedTargetPhone, fileTimeMillis, endedAtMillis, durSec, talkDurationSeconds)
                    if (score > 0) {
                        candidates.add(CandidateRecording(
                            fileOrUri = path,
                            fileName = name,
                            durationSeconds = durSec,
                            createdAtMillis = fileTimeMillis,
                            sizeBytes = size,
                            confidenceScore = score,
                            matchedPhoneNumber = normalizedTargetPhone
                        ))
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying MediaStore for recordings: ${e.message}")
        }

        // 2. Direct File Inspection for OEM storage directories
        for (dirPath in OEM_RECORDING_PATHS) {
            try {
                val dir = File(dirPath)
                if (dir.exists() && dir.isDirectory) {
                    val files = dir.listFiles()
                    files?.forEach { file ->
                        if (file.isFile && (file.extension == "mp3" || file.extension == "m4a" || file.extension == "amr" || file.extension == "wav" || file.extension == "aac" || file.extension == "3gp")) {
                            if (candidates.none { it.fileOrUri == file.absolutePath }) {
                                val fileTimeMillis = file.lastModified()
                                val durSec = getFileAudioDurationSeconds(file.absolutePath)
                                val score = scoreCandidate(file.name, file.absolutePath, normalizedTargetPhone, fileTimeMillis, endedAtMillis, durSec, talkDurationSeconds)
                                if (score > 0) {
                                    candidates.add(CandidateRecording(
                                        fileOrUri = file.absolutePath,
                                        fileName = file.name,
                                        durationSeconds = durSec,
                                        createdAtMillis = fileTimeMillis,
                                        sizeBytes = file.length(),
                                        confidenceScore = score,
                                        matchedPhoneNumber = normalizedTargetPhone
                                    ))
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error inspecting OEM directory $dirPath: ${e.message}")
            }
        }

        return candidates.sortedByDescending { it.confidenceScore }
    }

    private fun scoreCandidate(
        fileName: String,
        filePath: String,
        normalizedTargetPhone: String,
        fileTimeMillis: Long,
        endedAtMillis: Long,
        candidateDurSec: Long,
        targetTalkDurSec: Long
    ): Int {
        var score = 0
        val extractedDigits = sanitizePhoneNumber(fileName)
        val targetPhoneNorm = sanitizePhoneNumber(normalizedTargetPhone)

        // 1. Phone Number Matching (Up to 50 points)
        if (targetPhoneNorm.length >= 7) {
            val last7 = targetPhoneNorm.takeLast(7)
            if (extractedDigits.contains(last7) || fileName.contains(last7)) {
                score += 50
            }
        } else if (targetPhoneNorm.isNotEmpty() && (extractedDigits.contains(targetPhoneNorm) || fileName.contains(targetPhoneNorm))) {
            score += 50
        }

        // 2. Creation Time Proximity Matching (Up to 35 points)
        val timeDiffMillis = Math.abs(fileTimeMillis - endedAtMillis)
        if (timeDiffMillis <= 30000) { // Within 30 seconds
            score += 35
        } else if (timeDiffMillis <= 120000) { // Within 2 minutes
            score += 25
        } else if (timeDiffMillis <= 300000) { // Within 5 minutes
            score += 15
        }

        // 3. Audio Duration Matching (Up to 15 points)
        if (targetTalkDurSec > 0 && candidateDurSec > 0) {
            val durDiff = Math.abs(candidateDurSec - targetTalkDurSec)
            if (durDiff <= 5) {
                score += 15
            } else if (durDiff <= 15) {
                score += 10
            }
        } else {
            score += 10
        }

        return score
    }

    private fun sanitizePhoneNumber(phone: String): String {
        return phone.replace(Regex("[^0-9]"), "")
    }

    private fun getFileAudioDurationSeconds(filePath: String): Long {
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(filePath)
            val time = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
            retriever.release()
            time?.toLong()?.div(1000) ?: 0L
        } catch (e: Exception) {
            0L
        }
    }

    private fun uploadRecordingFile(
        context: Context,
        candidate: CandidateRecording,
        callLogId: String,
        uploadUrl: String,
        authToken: String?
    ) {
        try {
            val file = File(candidate.fileOrUri)
            if (!file.exists() || file.length() == 0L) {
                Log.e(TAG, "Recording file does not exist or is empty: ${candidate.fileOrUri}")
                notifyServerStatus(callLogId, ReconciliationStatus.UNAVAILABLE, uploadUrl, authToken, "File empty or missing")
                return
            }

            val boundary = "----CrmRecordingBoundary${System.currentTimeMillis()}"
            val targetEndpoint = if (uploadUrl.contains("/upload-audio")) uploadUrl else "$uploadUrl/upload-audio"
            Log.d(TAG, "Uploading audio file ${candidate.fileName} (${file.length()} bytes) to: $targetEndpoint")

            val url = URL(targetEndpoint)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.doInput = true
            conn.useCaches = false
            conn.setRequestProperty("Connection", "Keep-Alive")
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            if (!authToken.isNullOrEmpty()) {
                conn.setRequestProperty("Authorization", if (authToken.startsWith("Bearer ")) authToken else "Bearer $authToken")
            }

            val os: OutputStream = conn.outputStream
            val writer = os.writer(Charsets.UTF_8)

            writer.append("--$boundary\r\n")
            writer.append("Content-Disposition: form-data; name=\"audio\"; filename=\"${candidate.fileName}\"\r\n")
            writer.append("Content-Type: audio/mp3\r\n\r\n")
            writer.flush()

            val fis = FileInputStream(file)
            val buffer = ByteArray(4096)
            var bytesRead: Int
            while (fis.read(buffer).also { bytesRead = it } != -1) {
                os.write(buffer, 0, bytesRead)
            }
            os.flush()
            fis.close()

            writer.append("\r\n--$boundary--\r\n")
            writer.flush()
            writer.close()

            val responseCode = conn.responseCode
            Log.d(TAG, "Audio recording upload response code for callLogId=$callLogId: $responseCode")
            if (responseCode in 200..299) {
                notifyServerStatus(callLogId, ReconciliationStatus.AVAILABLE, uploadUrl, authToken, "Uploaded successfully (${candidate.fileName})")
            } else {
                notifyServerStatus(callLogId, ReconciliationStatus.UNAVAILABLE, uploadUrl, authToken, "Upload HTTP $responseCode")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to upload recording file: ${e.message}", e)
        }
    }

    private fun notifyServerStatus(
        callLogId: String,
        status: ReconciliationStatus,
        uploadUrl: String,
        authToken: String?,
        reason: String
    ) {
        try {
            val baseUrl = uploadUrl.replace(Regex("/api/calls/.*"), "")
            val url = URL("$baseUrl/api/calls/$callLogId")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "PUT"
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            if (!authToken.isNullOrEmpty()) {
                conn.setRequestProperty("Authorization", if (authToken.startsWith("Bearer ")) authToken else "Bearer $authToken")
            }
            conn.doOutput = true

            val jsonBody = "{\"recordingStatus\":\"${status.name.lowercase()}\",\"notes\":\"Recording Reconciliation: $reason\"}"
            conn.outputStream.write(jsonBody.toByteArray(Charsets.UTF_8))
            conn.outputStream.flush()
            conn.outputStream.close()

            val code = conn.responseCode
            Log.d(TAG, "Updated callLogId=$callLogId recordingStatus=${status.name} (Response: $code)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to notify server of recording status: ${e.message}")
        }
    }
}
