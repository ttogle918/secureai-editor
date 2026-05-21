package io.secureai.android.security

import android.content.Context
import java.io.File

object RootDetector {

    private val ROOT_BINARIES = listOf(
        "/system/bin/su", "/system/xbin/su", "/sbin/su",
        "/system/app/SuperSU", "/system/app/SuperSU.apk",
        "/data/local/xbin/su", "/data/local/bin/su", "/data/local/su",
    )

    private val ROOT_PACKAGES = listOf(
        "com.noshufou.android.su",
        "com.thirdparty.superuser",
        "eu.chainfire.supersu",
        "com.koushikdutta.superuser",
        "com.zachspong.temprootremovejb",
        "com.ramdroid.appquarantine",
        "com.topjohnwu.magisk",
    )

    fun isRooted(context: Context): Boolean =
        hasSuBinary() || hasRootPackage(context)

    private fun hasSuBinary(): Boolean =
        ROOT_BINARIES.any { File(it).exists() }

    private fun hasRootPackage(context: Context): Boolean {
        val pm = context.packageManager
        return ROOT_PACKAGES.any { pkg ->
            runCatching { pm.getPackageInfo(pkg, 0) }.isSuccess
        }
    }
}
