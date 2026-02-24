package com.pavavak.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.AdminMessage

class AdminMessagesAdapter(
    private var items: List<AdminMessage>,
    private val onDelete: (AdminMessage) -> Unit
) : RecyclerView.Adapter<AdminMessagesAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val top: TextView = view.findViewById(R.id.adminMsgTop)
        val content: TextView = view.findViewById(R.id.adminMsgContent)
        val meta: TextView = view.findViewById(R.id.adminMsgMeta)
        val deleteBtn: MaterialButton = view.findViewById(R.id.adminMsgDelete)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_message, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val m = items[position]
        holder.top.text = "#${m.messageId}  ${m.from} → ${m.to}"
        holder.content.text = m.content
        holder.meta.text = m.sentAt
        holder.deleteBtn.setOnClickListener { onDelete(m) }
    }

    override fun getItemCount(): Int = items.size

    fun submit(newItems: List<AdminMessage>) {
        items = newItems
        notifyDataSetChanged()
    }
}
