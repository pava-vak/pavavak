package com.pavavak.app.nativechat

import android.graphics.BitmapFactory
import android.content.res.ColorStateList
import android.util.Base64
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.pavavak.app.R
import com.pavavak.app.ThemeManager
import kotlin.math.roundToInt

class MessageAdapter(
    private val items: MutableList<ChatMessage>,
    private val onLongPress: (ChatMessage) -> Unit,
    private val onRetryTap: (ChatMessage) -> Unit,
    private val onRemoteMediaTap: (ChatMessage, Boolean) -> Unit
) : RecyclerView.Adapter<MessageAdapter.MessageVH>() {
    private enum class ImageLoadState { NONE, THUMBNAIL, FULL }

    private var selectionMode = false
    private val selectedIds = linkedSetOf<String>()
    private val imageStates = mutableMapOf<String, ImageLoadState>()

    class MessageVH(view: View) : RecyclerView.ViewHolder(view) {
        val rowRoot: LinearLayout = view.findViewById(R.id.rowRoot)
        val bubble: LinearLayout = view.findViewById(R.id.messageBubble)
        val reply: TextView = view.findViewById(R.id.replyText)
        val body: TextView = view.findViewById(R.id.messageText)
        val image: ImageView = view.findViewById(R.id.messageImage)
        val reaction: TextView = view.findViewById(R.id.reactionText)
        val meta: TextView = view.findViewById(R.id.messageMeta)
        val ticks: TextView = view.findViewById(R.id.messageTicks)
        val checkbox: CheckBox = view.findViewById(R.id.messageCheck)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MessageVH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_message, parent, false)
        return MessageVH(v)
    }

    override fun onBindViewHolder(holder: MessageVH, position: Int) {
        val item = items[position]
        val palette = ThemeManager.getChatColors(holder.itemView.context)

        holder.rowRoot.gravity = if (item.isMine) Gravity.END else Gravity.START
        holder.bubble.setBackgroundResource(if (item.isMine) R.drawable.bg_bubble_mine else R.drawable.bg_bubble_other)
        holder.bubble.backgroundTintList = ColorStateList.valueOf(
            if (item.isMine) palette.mineBubble else palette.otherBubble
        )
        holder.body.setTextColor(
            ContextCompat.getColor(
                holder.itemView.context,
                if (item.isMine) android.R.color.white else R.color.text_primary
            )
        )

        holder.reply.visibility = if (item.replyPreview.isNullOrBlank()) View.GONE else View.VISIBLE
        holder.reply.text = item.replyPreview ?: ""

        val imageBase64 = extractInlineImageBase64(item.text)
        val remoteMediaId = item.remoteMediaId ?: extractRemoteMediaId(item.text)
        if (imageBase64 != null || remoteMediaId != null) {
            val state = imageStates[item.id] ?: ImageLoadState.NONE
            val remoteBase64 = when (state) {
                ImageLoadState.NONE -> null
                ImageLoadState.THUMBNAIL -> item.remotePreviewBase64
                ImageLoadState.FULL -> item.remoteFullBase64 ?: item.remotePreviewBase64
            }
            val effectiveBase64 = imageBase64 ?: remoteBase64
            if (state == ImageLoadState.NONE) {
                holder.image.visibility = View.GONE
                holder.image.setImageDrawable(null)
                holder.body.visibility = View.VISIBLE
                holder.body.text = "Image received - tap to preview"
            } else if (effectiveBase64.isNullOrBlank()) {
                holder.image.visibility = View.GONE
                holder.image.setImageDrawable(null)
                holder.body.visibility = View.VISIBLE
                holder.body.text = if (state == ImageLoadState.THUMBNAIL) {
                    "Loading preview..."
                } else {
                    "Downloading full image..."
                }
            } else {
                val decoded = decodeInlineImage(
                    base64 = effectiveBase64,
                    maxDimension = if (state == ImageLoadState.THUMBNAIL) 280 else 1600
                )
                if (decoded != null) {
                    holder.body.visibility = View.VISIBLE
                    holder.body.text = if (state == ImageLoadState.THUMBNAIL) {
                        "Preview loaded - tap to download full image"
                    } else {
                        "Full image loaded"
                    }
                    holder.image.visibility = View.VISIBLE
                    holder.image.setImageBitmap(decoded)
                } else {
                    holder.image.visibility = View.GONE
                    holder.image.setImageDrawable(null)
                    holder.body.visibility = View.VISIBLE
                    holder.body.text = "Image unavailable"
                }
            }
        } else {
            holder.image.visibility = View.GONE
            holder.image.setImageDrawable(null)
            holder.body.visibility = View.VISIBLE
            holder.body.text = item.text
        }
        if (item.isMine) {
            holder.meta.text = if (item.isEdited && item.time.isNotBlank()) "${item.time} · edited" else item.time
            if (item.time == "failed") {
                holder.meta.setTextColor(
                    ContextCompat.getColor(holder.itemView.context, android.R.color.holo_red_dark)
                )
            } else {
                // Keep meta/ticks readable on dark blue sent bubble.
                val white = ContextCompat.getColor(holder.itemView.context, android.R.color.white)
                holder.meta.setTextColor(adjustAlpha(white, 0.88f))
            }
            holder.ticks.visibility = View.VISIBLE
            when {
                item.time == "failed" -> {
                    holder.ticks.text = "!"
                    holder.ticks.setTextColor(
                        ContextCompat.getColor(holder.itemView.context, android.R.color.holo_red_dark)
                    )
                }
                item.time == "sending..." -> {
                    holder.ticks.text = "..."
                    holder.ticks.setTextColor(
                        adjustAlpha(ContextCompat.getColor(holder.itemView.context, android.R.color.white), 0.72f)
                    )
                }
                item.time == "queued" -> {
                    holder.ticks.text = "Q"
                    holder.ticks.setTextColor(
                        adjustAlpha(ContextCompat.getColor(holder.itemView.context, android.R.color.white), 0.82f)
                    )
                }
                item.isRead -> {
                    holder.ticks.text = "\u2713\u2713"
                    holder.ticks.setTextColor(
                        ContextCompat.getColor(holder.itemView.context, R.color.accent_primary)
                    )
                }
                else -> {
                    // Any non-sending server message is treated as delivered in UI.
                    holder.ticks.text = "\u2713\u2713"
                    holder.ticks.setTextColor(
                        adjustAlpha(ContextCompat.getColor(holder.itemView.context, android.R.color.white), 0.82f)
                    )
                }
            }
        } else {
            holder.meta.text = if (item.isEdited && item.time.isNotBlank()) "${item.time} · edited" else item.time
            holder.meta.setTextColor(ContextCompat.getColor(holder.itemView.context, R.color.text_secondary))
            holder.ticks.visibility = View.GONE
        }

        if (item.reaction.isNullOrBlank()) {
            holder.reaction.visibility = View.GONE
        } else {
            holder.reaction.visibility = View.VISIBLE
            holder.reaction.text = item.reaction
        }

        holder.checkbox.visibility = if (selectionMode) View.VISIBLE else View.GONE
        holder.checkbox.isChecked = selectedIds.contains(item.id)

        holder.itemView.setOnLongClickListener {
            onLongPress(item)
            true
        }

        holder.itemView.setOnClickListener {
            if (selectionMode) {
                toggleSelection(item.id)
                return@setOnClickListener
            }
            if (imageBase64 != null || remoteMediaId != null) {
                val current = imageStates[item.id] ?: ImageLoadState.NONE
                val next = when (current) {
                    ImageLoadState.NONE -> ImageLoadState.THUMBNAIL
                    ImageLoadState.THUMBNAIL -> ImageLoadState.FULL
                    ImageLoadState.FULL -> ImageLoadState.FULL
                }
                imageStates[item.id] = next
                if (remoteMediaId != null) {
                    val needFull = next == ImageLoadState.FULL && item.remoteFullBase64.isNullOrBlank()
                    val needPreview = next == ImageLoadState.THUMBNAIL && item.remotePreviewBase64.isNullOrBlank()
                    if (needFull || needPreview) {
                        onRemoteMediaTap(item, needFull)
                    }
                }
                notifyItemChanged(position)
                return@setOnClickListener
            }
            if (item.isMine && (item.time == "failed" || item.time == "queued")) {
                onRetryTap(item)
            }
        }

        holder.checkbox.setOnClickListener {
            toggleSelection(item.id)
        }
    }

    override fun getItemCount(): Int = items.size

    fun itemAt(position: Int): ChatMessage? =
        if (position in 0 until items.size) items[position] else null

    fun refresh() = notifyDataSetChanged()

    fun enterSelection(initialId: String? = null) {
        selectionMode = true
        if (initialId != null) selectedIds.add(initialId)
        notifyDataSetChanged()
    }

    fun exitSelection() {
        selectionMode = false
        selectedIds.clear()
        notifyDataSetChanged()
    }

    fun isSelectionMode(): Boolean = selectionMode

    fun selectedCount(): Int = selectedIds.size

    fun selectedIds(): Set<String> = selectedIds

    fun toggleSelection(id: String) {
        if (!selectionMode) return
        if (selectedIds.contains(id)) selectedIds.remove(id) else selectedIds.add(id)
        notifyDataSetChanged()
    }

    fun removeById(id: String) {
        val index = items.indexOfFirst { it.id == id }
        if (index >= 0) {
            items.removeAt(index)
            notifyItemRemoved(index)
        }
    }

    fun removeSelected() {
        if (selectedIds.isEmpty()) return
        items.removeAll { selectedIds.contains(it.id) }
        selectedIds.clear()
        selectionMode = false
        notifyDataSetChanged()
    }

    fun clearAll() {
        items.clear()
        selectedIds.clear()
        selectionMode = false
        notifyDataSetChanged()
    }

    private fun adjustAlpha(color: Int, factor: Float): Int {
        val alpha = (android.graphics.Color.alpha(color) * factor).roundToInt()
        val red = android.graphics.Color.red(color)
        val green = android.graphics.Color.green(color)
        val blue = android.graphics.Color.blue(color)
        return android.graphics.Color.argb(alpha, red, green, blue)
    }

    private fun decodeInlineImage(base64: String, maxDimension: Int): android.graphics.Bitmap? {
        return try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                null
            } else {
                var sample = 1
                while ((bounds.outWidth / sample) > maxDimension || (bounds.outHeight / sample) > maxDimension) {
                    sample *= 2
                }
                val opts = BitmapFactory.Options().apply { inSampleSize = sample.coerceAtLeast(1) }
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
            }
        } catch (_: Throwable) {
            null
        }
    }
}

