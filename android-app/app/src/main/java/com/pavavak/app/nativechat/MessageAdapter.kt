package com.pavavak.app.nativechat

import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.pavavak.app.R

class MessageAdapter(
    private val items: MutableList<ChatMessage>,
    private val onLongPress: (ChatMessage) -> Unit
) : RecyclerView.Adapter<MessageAdapter.MessageVH>() {

    private var selectionMode = false
    private val selectedIds = linkedSetOf<String>()

    class MessageVH(view: View) : RecyclerView.ViewHolder(view) {
        val rowRoot: LinearLayout = view.findViewById(R.id.rowRoot)
        val bubble: LinearLayout = view.findViewById(R.id.messageBubble)
        val reply: TextView = view.findViewById(R.id.replyText)
        val body: TextView = view.findViewById(R.id.messageText)
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

        holder.rowRoot.gravity = if (item.isMine) Gravity.END else Gravity.START
        holder.bubble.setBackgroundResource(if (item.isMine) R.drawable.bg_bubble_mine else R.drawable.bg_bubble_other)
        holder.body.setTextColor(
            ContextCompat.getColor(
                holder.itemView.context,
                if (item.isMine) android.R.color.white else R.color.text_primary
            )
        )

        holder.reply.visibility = if (item.replyPreview.isNullOrBlank()) View.GONE else View.VISIBLE
        holder.reply.text = item.replyPreview ?: ""

        holder.body.text = item.text
        if (item.isMine) {
            holder.meta.text = item.time
            holder.meta.setTextColor(
                ContextCompat.getColor(
                    holder.itemView.context,
                    when {
                        item.time == "failed" -> android.R.color.holo_red_dark
                        else -> R.color.text_secondary
                    }
                )
            )
            holder.ticks.visibility = View.VISIBLE
            when {
                item.time == "failed" -> {
                    holder.ticks.text = "!"
                    holder.ticks.setTextColor(
                        ContextCompat.getColor(holder.itemView.context, android.R.color.holo_red_dark)
                    )
                }
                item.time == "sending..." -> {
                    holder.ticks.text = "✓"
                    holder.ticks.setTextColor(
                        ContextCompat.getColor(holder.itemView.context, R.color.text_secondary)
                    )
                }
                item.isRead -> {
                    holder.ticks.text = "✓✓"
                    holder.ticks.setTextColor(
                        ContextCompat.getColor(holder.itemView.context, R.color.accent_primary)
                    )
                }
                else -> {
                    // Any non-sending server message is treated as delivered in UI.
                    holder.ticks.text = "✓✓"
                    holder.ticks.setTextColor(
                        ContextCompat.getColor(holder.itemView.context, R.color.text_secondary)
                    )
                }
            }
        } else {
            holder.meta.text = item.time
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
}
