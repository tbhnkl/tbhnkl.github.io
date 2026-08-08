package com.tbhnkl.whistlecompetition.audio

/**
 * Estimates the fundamental frequency of a PCM frame using normalized
 * autocorrelation. Whistling produces a near-pure tone, which autocorrelation
 * tracks reliably without needing an FFT.
 */
object PitchDetector {

    private const val MIN_FREQUENCY_HZ = 400.0
    private const val MAX_FREQUENCY_HZ = 10_000.0

    // Below this RMS the frame is treated as silence/background noise.
    private const val SILENCE_RMS_THRESHOLD = 400.0

    // Minimum normalized autocorrelation peak to trust the estimate.
    private const val CONFIDENCE_THRESHOLD = 0.6

    fun detectFrequency(buffer: ShortArray, sampleRate: Int, frameSize: Int = buffer.size): Float? {
        val n = frameSize
        if (n < 4) return null

        var mean = 0.0
        for (i in 0 until n) mean += buffer[i]
        mean /= n

        val samples = DoubleArray(n)
        var energy = 0.0
        for (i in 0 until n) {
            val v = buffer[i] - mean
            samples[i] = v
            energy += v * v
        }

        val rms = Math.sqrt(energy / n)
        if (rms < SILENCE_RMS_THRESHOLD) return null

        val minLag = (sampleRate / MAX_FREQUENCY_HZ).toInt().coerceAtLeast(1)
        val maxLag = (sampleRate / MIN_FREQUENCY_HZ).toInt().coerceAtMost(n - 1)
        if (maxLag <= minLag + 1) return null

        val corrs = DoubleArray(maxLag - minLag + 1)
        for (lag in minLag..maxLag) {
            var corr = 0.0
            for (i in 0 until n - lag) corr += samples[i] * samples[i + lag]
            corrs[lag - minLag] = corr
        }

        // Raw autocorrelation is always highest at the very shortest lag we scan
        // (any real signal, periodic or not, is highly self-similar over a tiny time
        // offset) so picking the overall max would just return minLag/MAX_FREQUENCY_HZ
        // on every frame. Require a genuine interior local maximum instead - a real
        // periodic tone actually produces a bump in the correlation curve, noise/silence
        // does not.
        var bestIndex = -1
        for (i in 1 until corrs.size - 1) {
            if (corrs[i] >= corrs[i - 1] && corrs[i] >= corrs[i + 1]) {
                if (bestIndex == -1 || corrs[i] > corrs[bestIndex]) bestIndex = i
            }
        }
        if (bestIndex == -1) return null

        val bestCorr = corrs[bestIndex]
        val normalized = bestCorr / energy
        if (normalized < CONFIDENCE_THRESHOLD) return null

        // Parabolic interpolation around the peak for sub-sample lag accuracy.
        val y0 = corrs[bestIndex - 1]
        val y1 = corrs[bestIndex]
        val y2 = corrs[bestIndex + 1]
        val denom = y0 - 2 * y1 + y2
        val offset = if (denom != 0.0) 0.5 * (y0 - y2) / denom else 0.0
        val refinedLag = (minLag + bestIndex) + offset.coerceIn(-1.0, 1.0)

        if (refinedLag <= 0) return null
        return (sampleRate / refinedLag).toFloat()
    }
}
