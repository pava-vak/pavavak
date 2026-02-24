package com.pavavak.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.pavavak.app.nativechat.AdminConnection

class AdminConnectionAdapter(
    private var items: List<AdminConnection>,
    private val onClick: (AdminConnection) -> Unit
) : RecyclerView.Adapter<AdminConnectionAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.connTitle)
        val subtitle: TextView = view.findViewById(R.id.connSubtitle)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val v = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_connection, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.title.text = "${item.user1Name}  <>  ${item.user2Name}"
        holder.subtitle.text = "IDs: ${item.user1Id}, ${item.user2Id}"
        holder.itemView.setOnClickListener { onClick(item) }
    }

    override fun getItemCount(): Int = items.size

    fun submit(newItems: List<AdminConnection>) {
        items = newItems
        notifyDataSetChanged()
    }
}
