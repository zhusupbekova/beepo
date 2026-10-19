package studio.panikka.beepo

import android.app.LocaleManager
import android.content.Context
import android.os.Build
import android.os.LocaleList
import studio.panikka.beepo.core.resolveLang

/**
 * Android 13+ lets you pick an app's language in system Settings → Apps. Beepo keeps its own
 * setting (`settings.lang`, shared with the extension); this keeps the two in step: a language
 * picked in the system wins on launch, one picked in Beepo is handed to the system.
 */
object AppLanguage {
    /** System tag for one of LANGUAGES (see res/xml/locales_config.xml). */
    private fun tag(lang: String) = if (lang == "yue") "zh-HK" else lang.replace('_', '-')

    /** The language picked for Beepo in system settings, as a LANGUAGES key; null if none. */
    fun fromSystem(context: Context): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return null
        val locales = context.getSystemService(LocaleManager::class.java)?.applicationLocales ?: return null
        return if (locales.isEmpty) null else resolveLang(null, locales[0].toLanguageTag())
    }

    /** Tells the system about a language picked in Beepo ("auto" = follow the phone). */
    fun toSystem(context: Context, lang: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        context.getSystemService(LocaleManager::class.java)?.applicationLocales =
            if (lang == "auto") LocaleList.getEmptyLocaleList() else LocaleList.forLanguageTags(tag(lang))
    }
}
