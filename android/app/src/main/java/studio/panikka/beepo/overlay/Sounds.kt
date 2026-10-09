package studio.panikka.beepo.overlay

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack

private const val RATE = 22_050
private const val VOLUME = 0.06f

/** Note frequency (0 = rest) and length in seconds. Same as content.js. */
private val SOUNDS = mapOf(
    "good" to listOf(660 to 0.08, 880 to 0.1),
    "party" to listOf(523 to 0.08, 659 to 0.08, 784 to 0.08, 1047 to 0.16),
    "warn" to listOf(440 to 0.1, 0 to 0.05, 440 to 0.1),
    "bad" to listOf(392 to 0.12, 311 to 0.2),
)
private val MOOD_SOUND = mapOf(
    "party" to "party", "happy" to "good", "proud" to "good",
    "neutral" to "warn", "worried" to "warn", "angry" to "bad", "sad" to "bad",
)

/** Beepo's 8-bit beeps (square waves), quiet like the page's. Silent when the phone is on silent or vibrate. */
class Sounds(context: Context) {
    private val audio = context.getSystemService(AudioManager::class.java)
    private val cache = mutableMapOf<String, ShortArray>()
    private var track: AudioTrack? = null

    fun play(mood: String) {
        val kind = MOOD_SOUND[mood] ?: return
        if (audio.ringerMode != AudioManager.RINGER_MODE_NORMAL) return
        val pcm = cache.getOrPut(kind) { render(SOUNDS.getValue(kind)) }
        runCatching {
            release()
            track = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build(),
                )
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(pcm.size * 2)
                .build()
                .apply {
                    write(pcm, 0, pcm.size)
                    play()
                }
        }
    }

    fun release() {
        track?.let { runCatching { it.stop() }; it.release() }
        track = null
    }

    private fun render(notes: List<Pair<Int, Double>>): ShortArray {
        val out = ShortArray(notes.sumOf { (RATE * it.second).toInt() })
        val amp = (Short.MAX_VALUE * VOLUME).toInt()
        var i = 0
        for ((f, d) in notes) {
            val n = (RATE * d).toInt()
            for (s in 0 until n) out[i + s] = if (f == 0) 0 else (if ((s * 2L * f / RATE) % 2 == 0L) amp else -amp).toShort()
            i += n
        }
        return out
    }
}
