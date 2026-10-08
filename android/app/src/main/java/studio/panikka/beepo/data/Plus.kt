package studio.panikka.beepo.data

import android.app.Activity
import android.content.Context
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Package
import com.revenuecat.purchases.PurchaseParams
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration
import com.revenuecat.purchases.PurchasesTransactionException
import com.revenuecat.purchases.awaitOfferings
import com.revenuecat.purchases.awaitPurchase
import com.revenuecat.purchases.awaitRestore
import studio.panikka.beepo.BuildConfig

/**
 * Beepo Plus through RevenueCat: a one-time unlock (entitlement "beepo_pro", the current offering's
 * lifetime package). The SDK keeps its own cache, so the answer is known offline too; every
 * answer goes to [Store.setPlus].
 */
object Plus {
    private const val ENTITLEMENT = "beepo_pro"

    /** False when the build has no RevenueCat key (release without `revenuecatKey`): no Plus UI. */
    val available get() = BuildConfig.REVENUECAT_KEY.isNotEmpty()

    fun init(context: Context, store: Store) {
        if (!available || Purchases.isConfigured) return
        Purchases.configure(PurchasesConfiguration.Builder(context.applicationContext, BuildConfig.REVENUECAT_KEY).build())
        // Called right away with the cached info, then on every change (purchase, restore, refund).
        Purchases.sharedInstance.updatedCustomerInfoListener = { info: CustomerInfo -> store.setPlus(info.active) }
    }

    /** What to buy, with its localized price. Null if offline or nothing is set up in RevenueCat. */
    suspend fun offer(): Package? = runCatching {
        val current = Purchases.sharedInstance.awaitOfferings().current
        current?.lifetime ?: current?.availablePackages?.firstOrNull()
    }.getOrNull()

    sealed interface Result {
        data object Done : Result
        data object Cancelled : Result
        data object Failed : Result
    }

    suspend fun buy(activity: Activity, pkg: Package, store: Store): Result = try {
        val info = Purchases.sharedInstance.awaitPurchase(PurchaseParams.Builder(activity, pkg).build()).customerInfo
        store.setPlus(info.active)
        if (info.active) Result.Done else Result.Failed
    } catch (e: PurchasesTransactionException) {
        if (e.userCancelled) Result.Cancelled else Result.Failed
    }

    /** True if Plus is active afterwards. */
    suspend fun restore(store: Store): Boolean = runCatching {
        Purchases.sharedInstance.awaitRestore().active.also(store::setPlus)
    }.getOrDefault(false)

    private val CustomerInfo.active get() = entitlements[ENTITLEMENT]?.isActive == true
}
