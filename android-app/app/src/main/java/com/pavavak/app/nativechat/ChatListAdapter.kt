package com.pavavak.app.nativechat

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.pavavak.app.R

class ChatListAdapter(
    private var items: List<ChatSummary>,
    private val onClick: (ChatSummary) -> Unit,
    private val onLongClick: (ChatSummary) -> Unit
) : RecyclerView.Adapter<ChatListAdapter.ChatListVH>() {

    class ChatListVH(view: View) : RecyclerView.ViewHolder(view) {
        val avatar: TextView = view.findViewById(R.id.chatAvatar)
        val name: TextView = view.findViewById(R.id.chatName)
        val message: TextView = view.findViewById(R.id.chatLastMessage)
        val time: TextView = view.findViewById(R.id.chatTime)
        val unreadBadge: TextView = view.findViewById(R.id.chatUnreadBadge)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatListVH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_chat_row, parent, false)
        return ChatListVH(v)
    }

    override fun onBindViewHolder(holder: ChatListVH, position: Int) {
        val item = items[position]
        holder.avatar.text = item.name.take(1).uppercase()
        holder.name.text = item.name
        holder.message.text = item.lastMessage
        holder.time.text = item.lastTime
        if (item.unreadCount > 0) {
            holder.unreadBadge.visibility = View.VISIBLE
            holder.unreadBadge.text = item.unreadCount.coerceAtMost(99).toString()
            holder.message.setTextColor(ContextCompat.getColor(holder.itemView.context, R.color.text_primary))
        } else {
            holder.unreadBadge.visibility = View.GONE
            holder.message.setTextColor(ContextCompat.getColor(holder.itemView.context, R.color.text_secondary))
        }
        holder.itemView.setOnClickListener { onClick(item) }
        holder.itemView.setOnLongClickListener {
            onLongClick(item)
            true
        }
    }

    override fun getItemCount(): Int = items.size

    fun submit(newItems: List<ChatSummary>) {
        items = newItems
        notifyDataSetChanged()
    }
}
