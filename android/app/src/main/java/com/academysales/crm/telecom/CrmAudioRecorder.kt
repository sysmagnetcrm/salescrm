package com.academysales.crm.telecom

import android.content.Context
import android.media.AudioManager
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

object CrmAudioRecorder {

    private const val TAG = "CrmAudioRecorder"
    private var mediaRecorder: MediaRecorder? = null
    private var currentRecordingFile: File? = null
    private var activeCallId: String? = null

    /**
     * Start recording a call. Tries VOICE_RECOGNITION first (captures both parties on many
     * devices when speakerphone is active), then falls back to MIC (captures near-end at minimum).
     *
     * @return true if recording started successfully, false otherwise.
     */
    fun startRecording(context: Context, callId: String): Boolean {
        // Clean up any stale recorder before starting
        if (mediaRecorder != null) {
            stopRecording()
        }

        activeCallId = callId
        val fileName = "call_${callId}_${System.currentTimeMillis()}.m4a"
        val outFile = File(context.cacheDir, fileName)
        currentRecordingFile = outFile

        // Try the audio source chain: VOICE_RECOGNITION → VOICE_COMMUNICATION → MIC
        val sourcesToTry = listOf(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,    // Best: bypasses AGC, both parties on speaker
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,  // Mid: optimized for VoIP
            MediaRecorder.AudioSource.MIC                   // Last resort: near-end only
        )

        for (source in sourcesToTry) {
            if (tryStartWithSource(context, source, outFile)) {
                Log.d(TAG, "✅ Recording started with AudioSource=$source for callId=$callId → ${outFile.absolutePath}")
                return true
            }
            Log.w(TAG, "⚠️ AudioSource=$source failed, trying next...")
        }

        // All sources failed
        Log.e(TAG, "❌ All AudioSource attempts failed for callId=$callId")
        currentRecordingFile = null
        return false
    }

    private fun tryStartWithSource(context: Context, audioSource: Int, outFile: File): Boolean {
        return try {
            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder.apply {
                setAudioSource(audioSource)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(96000)
                setOutputFile(outFile.absolutePath)
                prepare()
                start()
            }

            mediaRecorder = recorder
            true
        } catch (e: Exception) {
            Log.w(TAG, "AudioSource=$audioSource failed: ${e.message}")
            try {
                mediaRecorder?.reset()
                mediaRecorder?.release()
            } catch (_: Exception) {}
            mediaRecorder = null
            // Delete partial file if exists
            try { if (outFile.exists() && outFile.length() == 0L) outFile.delete() } catch (_: Exception) {}
            false
        }
    }

    /**
     * Stops the active recording and returns the recorded File (or null if nothing was recorded).
     */
    fun stopRecording(): File? {
        val fileToReturn = currentRecordingFile
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            Log.d(TAG, "Recording stopped: ${fileToReturn?.absolutePath} (${fileToReturn?.length()} bytes)")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping MediaRecorder: ${e.message}")
        } finally {
            mediaRecorder = null
            currentRecordingFile = null
            activeCallId = null
        }
        return fileToReturn
    }

    /**
     * Public upload method callable by CrmInCallService after stopRecording().
     * Runs on a background thread.
     */
    fun uploadRecordingFile(context: Context, callId: String, file: File, uploadUrl: String, authToken: String?) {
        if (!file.exists() || file.length() == 0L) {
            Log.w(TAG, "uploadRecordingFile: file missing or empty for callId=$callId")
            return
        }
        thread {
            performMultipartUpload(file, callId, uploadUrl, authToken)
        }
    }

    /**
     * Convenience: stop recording and upload in one call (used from JS bridge path).
     */
    fun stopAndUpload(context: Context, callId: String, uploadUrl: String, authToken: String?) {
        val recordingFile = stopRecording()
        if (recordingFile == null || !recordingFile.exists() || recordingFile.length() == 0L) {
            Log.w(TAG, "stopAndUpload: no valid recording for callId=$callId")
            return
        }
        thread {
            performMultipartUpload(recordingFile, callId, uploadUrl, authToken)
        }
    }

    // ── Internal upload logic ──────────────────────────────────────────────────

    private fun performMultipartUpload(file: File, callId: String, uploadUrl: String, authToken: String?) {
        try {
            Log.d(TAG, "⬆️ Uploading recording (${file.length()} bytes) to: $uploadUrl")
            val boundary = "----CrmRecordingBoundary${System.currentTimeMillis()}"
            val url = URL(uploadUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.doInput = true
            conn.useCaches = false
            conn.connectTimeout = 30_000
            conn.readTimeout = 60_000
            conn.setRequestProperty("Connection", "Keep-Alive")
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            conn.setRequestProperty("x-client-version", "1.2.0")
            if (!authToken.isNullOrEmpty()) {
                conn.setRequestProperty(
                    "Authorization",
                    if (authToken.startsWith("Bearer ")) authToken else "Bearer $authToken"
                )
            }

            val os: OutputStream = conn.outputStream
            val writer = os.writer(Charsets.UTF_8)

            writer.append("--$boundary\r\n")
            writer.append("Content-Disposition: form-data; name=\"audio\"; filename=\"${file.name}\"\r\n")
            writer.append("Content-Type: audio/m4a\r\n\r\n")
            writer.flush()

            FileInputStream(file).use { fis ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (fis.read(buffer).also { bytesRead = it } != -1) {
                    os.write(buffer, 0, bytesRead)
                }
            }
            os.flush()

            writer.append("\r\n--$boundary--\r\n")
            writer.flush()
            writer.close()

            val responseCode = conn.responseCode
            if (responseCode in 200..299) {
                Log.d(TAG, "✅ Recording uploaded successfully for callId=$callId (HTTP $responseCode)")
            } else {
                Log.e(TAG, "❌ Recording upload failed for callId=$callId (HTTP $responseCode)")
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "❌ Upload thread error for callId=$callId: ${e.message}", e)
        }
    }
}
