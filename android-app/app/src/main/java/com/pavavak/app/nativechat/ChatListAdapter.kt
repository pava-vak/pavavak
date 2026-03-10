package com.pavavak.app.nativechat

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.pavavak.app.R
import com.pavavak.app.AvatarUtils

class ChatListAdapter(
    private var items: List<ChatSummary>,
    private val onClick: (ChatSummary) -> Unit,
    private val onLongClick: (ChatSummary) -> Unit
) : RecyclerView.Adapter<ChatListAdapter.ChatListVH>() {

    class ChatListVH(view: View) : RecyclerView.ViewHolder(view) {
        val avatar: TextView = view.findViewById(R.id.chatAvatar)
        val avatarImage: ImageView = view.findViewById(R.id.chatAvatarImage)
        val name: TextView = view.findViewById(R.id.chatName)
        val message: TextView = view.findViewById(R.id.chatLastMessage)
        val ticks: TextView = view.findViewById(R.id.chatLastTicks)
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
        val avatarBitmap = AvatarUtils.decodeBase64Avatar(item.profilePhotoBase64)
        if (avatarBitmap != null) {
            holder.avatarImage.setImageBitmap(avatarBitmap)
            holder.avatarImage.visibility = View.VISIBLE
            holder.avatar.visibility = View.GONE
        } else {
            holder.avatarImage.setImageDrawable(null)
            holder.avatarImage.visibility = View.GONE
            holder.avatar.visibility = View.VISIBLE
        }
        holder.name.text = item.name
        holder.message.text = item.lastMessage
        holder.time.text = item.lastTime

        if (item.lastIsFromMe && item.lastMessage.isNotBlank()) {
            holder.ticks.visibility = View.VISIBLE
            holder.ticks.text = "\u2713\u2713"
            val color = if (item.lastIsRead) R.color.accent_primary else R.color.text_secondary
            holder.ticks.setTextColor(ContextCompat.getColor(holder.itemView.context, color))
        } else {
            holder.ticks.visibility = View.GONE
        }

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
