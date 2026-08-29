package com.academysales.crm.telecom

import android.content.Context
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

    fun startRecording(context: Context, callId: String): Boolean {
        return try {
            if (mediaRecorder != null) {
                stopRecording()
            }

            activeCallId = callId
            val fileName = "call_${callId}_${System.currentTimeMillis()}.m4a"
            currentRecordingFile = File(context.cacheDir, fileName)

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(96000)
                setOutputFile(currentRecordingFile!!.absolutePath)
                prepare()
                start()
            }
            Log.d(TAG, "Call recording started for callId: $callId -> ${currentRecordingFile?.absolutePath}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start call recording: ${e.message}", e)
            mediaRecorder?.reset()
            mediaRecorder?.release()
            mediaRecorder = null
            currentRecordingFile = null
            false
        }
    }

    fun stopRecording(): File? {
        val fileToReturn = currentRecordingFile
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            Log.d(TAG, "Call recording stopped cleanly: ${fileToReturn?.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping MediaRecorder: ${e.message}")
        } finally {
            mediaRecorder = null
        }
        return fileToReturn
    }

    fun stopAndUpload(context: Context, callId: String, uploadUrl: String, authToken: String?) {
        val recordingFile = stopRecording()
        if (recordingFile == null || !recordingFile.exists() || recordingFile.length() == 0L) {
            Log.w(TAG, "No valid recording file found to upload for callId: $callId")
            return
        }

        thread {
            try {
                Log.d(TAG, "Uploading call recording (${recordingFile.length()} bytes) to: $uploadUrl")
                val boundary = "----CrmRecordingBoundary${System.currentTimeMillis()}"
                val url = URL(uploadUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.doInput = true
                conn.useCaches = false
                conn.setRequestProperty("Connection", "Keep-Alive")
                conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
                conn.setRequestProperty("x-client-version", "1.2.0")
                if (!authToken.isNullOrEmpty()) {
                    conn.setRequestProperty("Authorization", if (authToken.startsWith("Bearer ")) authToken else "Bearer $authToken")
                }

                val os: OutputStream = conn.outputStream
                val writer = os.writer(Charsets.UTF_8)

                writer.append("--$boundary\r\n")
                writer.append("Content-Disposition: form-data; name=\"audio\"; filename=\"${recordingFile.name}\"\r\n")
                writer.append("Content-Type: audio/m4a\r\n\r\n")
                writer.flush()

                val fis = FileInputStream(recordingFile)
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
                Log.d(TAG, "Audio recording upload response status: $responseCode")
                if (responseCode in 200..299) {
                    Log.d(TAG, "✅ Audio recording uploaded successfully for callId: $callId")
                } else {
                    Log.e(TAG, "❌ Audio recording upload failed with response code: $responseCode")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Audio upload background thread error: ${e.message}", e)
            }
        }
    }
}
