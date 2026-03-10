package com.pavavak.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import java.io.ByteArrayOutputStream

object AvatarUtils {
    fun decodeBase64Avatar(base64: String?): Bitmap? {
        if (base64.isNullOrBlank()) return null
        return runCatching {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }.getOrNull()
    }

    fun encodeAvatarBase64(rawBytes: ByteArray): String? {
        if (rawBytes.isEmpty()) return null
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

        val maxDimension = 512
        var sample = 1
        var width = bounds.outWidth
        var height = bounds.outHeight
        while (width > maxDimension || height > maxDimension) {
            width /= 2
            height /= 2
            sample *= 2
        }

        val decoded = BitmapFactory.decodeByteArray(
            rawBytes,
            0,
            rawBytes.size,
            BitmapFactory.Options().apply { inSampleSize = sample.coerceAtLeast(1) }
        ) ?: return null

        val scaled = if (decoded.width > maxDimension || decoded.height > maxDimension) {
            val ratio = minOf(maxDimension.toFloat() / decoded.width, maxDimension.toFloat() / decoded.height)
            Bitmap.createScaledBitmap(
                decoded,
                (decoded.width * ratio).toInt().coerceAtLeast(1),
                (decoded.height * ratio).toInt().coerceAtLeast(1),
                true
            ).also {
                if (it != decoded) decoded.recycle()
            }
        } else {
            decoded
        }

        val out = ByteArrayOutputStream()
        var quality = 82
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        while (out.size() > 320 * 1024 && quality > 30) {
            out.reset()
            quality -= 8
            scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        }
        if (scaled != decoded) {
            scaled.recycle()
        } else {
            decoded.recycle()
        }
        if (out.size() > 350 * 1024) return null
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
}
