package com.pavavak.app

import android.graphics.Typeface
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.pavavak.app.nativechat.UserBroadcast

class BroadcastAdapter(
    private var items: List<UserBroadcast>,
    private val onClick: (UserBroadcast) -> Unit
) : RecyclerView.Adapter<BroadcastAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.broadcastTitle)
        val body: TextView = view.findViewById(R.id.broadcastBodyPreview)
        val meta: TextView = view.findViewById(R.id.broadcastMeta)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_broadcast, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.title.text = item.title
        holder.body.text = item.body
        holder.meta.text = buildString {
            append(item.createdAt)
            if (item.createdByUsername.isNotBlank()) append(" - @${item.createdByUsername}")
            append(if (item.isRead) " - Read" else " - Unread")
        }
        holder.title.setTypeface(null, if (item.isRead) Typeface.NORMAL else Typeface.BOLD)
        holder.body.alpha = if (item.isRead) 0.88f else 1f
        holder.itemView.setOnClickListener { onClick(item) }
    }

    override fun getItemCount(): Int = items.size

    fun submit(newItems: List<UserBroadcast>) {
        items = newItems
        notifyDataSetChanged()
    }
}
