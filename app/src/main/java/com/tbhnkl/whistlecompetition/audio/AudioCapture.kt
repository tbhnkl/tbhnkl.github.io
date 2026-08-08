package com.tbhnkl.whistlecompetition.audio

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext

/**
 * Captures microphone audio for a fixed duration, running [PitchDetector] on
 * each frame and tracking the highest frequency sustained over a rolling
 * [windowMs] window (roughly half a second), so a single noise spike can't
 * win the round.
 */
class AudioCapture(
    private val sampleRate: Int = 44_100,
    private val frameSize: Int = 2048,
    private val windowMs: Long = 500L,
    private val minSamplesInWindow: Int = 6
) {

    @SuppressLint("MissingPermission") // caller is required to have checked RECORD_AUDIO
    suspend fun record(durationMs: Long, onUpdate: (Float?) -> Unit): Float? = withContext(Dispatchers.IO) {
        val minBufferSize = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        if (minBufferSize <= 0) return@withContext null

        val audioRecord = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            maxOf(minBufferSize, frameSize * 4)
        )

        if (audioRecord.state != AudioRecord.STATE_INITIALIZED) {
            audioRecord.release()
            return@withContext null
        }

        val buffer = ShortArray(frameSize)
        val recentPitches = ArrayDeque<Pair<Long, Float>>()
        var bestAverage: Float? = null

        try {
            audioRecord.startRecording()
            val startTime = System.currentTimeMillis()

            while (isActive && System.currentTimeMillis() - startTime < durationMs) {
                val read = audioRecord.read(buffer, 0, frameSize)
                if (read <= 0) continue

                val now = System.currentTimeMillis() - startTime
                val freq = PitchDetector.detectFrequency(buffer, sampleRate, read)
                if (freq != null) {
                    recentPitches.addLast(now to freq)
                }
                while (recentPitches.isNotEmpty() && now - recentPitches.first().first > windowMs) {
                    recentPitches.removeFirst()
                }

                if (recentPitches.size >= minSamplesInWindow) {
                    val avg = recentPitches.sumOf { it.second.toDouble() }.toFloat() / recentPitches.size
                    if (bestAverage == null || avg > bestAverage!!) bestAverage = avg
                    onUpdate(avg)
                } else {
                    onUpdate(null)
                }
            }
        } finally {
            audioRecord.stop()
            audioRecord.release()
        }

        bestAverage
    }
}
