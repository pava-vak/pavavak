package com.pavavak.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.pavavak.app.nativechat.AdminConversationMessage

class AdminConversationMessageAdapter(
    private var items: List<AdminConversationMessage>,
    private val onLongPress: (AdminConversationMessage) -> Unit
) : RecyclerView.Adapter<AdminConversationMessageAdapter.VH>() {

    private var selectionMode = false
    private val selectedIds = linkedSetOf<Int>()

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val sender: TextView = view.findViewById(R.id.adminConvSender)
        val content: TextView = view.findViewById(R.id.adminConvContent)
        val meta: TextView = view.findViewById(R.id.adminConvMeta)
        val check: CheckBox = view.findViewById(R.id.adminConvCheck)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_conversation_message, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.sender.text = item.senderName
        holder.content.text = item.content
        holder.meta.text = "#${item.messageId}  ${item.sentAt}"
        holder.check.visibility = if (selectionMode) View.VISIBLE else View.GONE
        holder.check.isChecked = selectedIds.contains(item.messageId)

        holder.itemView.setOnLongClickListener {
            onLongPress(item)
            true
        }
        holder.itemView.setOnClickListener {
            if (selectionMode) toggleSelection(item.messageId)
        }
        holder.check.setOnClickListener {
            toggleSelection(item.messageId)
        }
    }

    override fun getItemCount(): Int = items.size

    fun submit(newItems: List<AdminConversationMessage>) {
        items = newItems
        if (selectionMode) {
            selectedIds.retainAll(newItems.map { it.messageId }.toSet())
        }
        notifyDataSetChanged()
    }

    fun enterSelection(initialMessageId: Int? = null) {
        selectionMode = true
        if (initialMessageId != null) selectedIds.add(initialMessageId)
        notifyDataSetChanged()
    }

    fun exitSelection() {
        selectionMode = false
        selectedIds.clear()
        notifyDataSetChanged()
    }

    fun isSelectionMode(): Boolean = selectionMode

    fun selectedCount(): Int = selectedIds.size

    fun selectedIds(): Set<Int> = selectedIds

    fun toggleSelection(messageId: Int) {
        if (!selectionMode) return
        if (selectedIds.contains(messageId)) selectedIds.remove(messageId) else selectedIds.add(messageId)
        notifyDataSetChanged()
    }
}
