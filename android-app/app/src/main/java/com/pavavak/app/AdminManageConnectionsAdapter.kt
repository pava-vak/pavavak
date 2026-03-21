package com.pavavak.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.AdminConnection

class AdminManageConnectionsAdapter(
    private var items: List<AdminConnection>,
    private val onOpen: (AdminConnection) -> Unit,
    private val onDelete: (AdminConnection) -> Unit
) : RecyclerView.Adapter<AdminManageConnectionsAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.adminManageConnTitle)
        val meta: TextView = view.findViewById(R.id.adminManageConnMeta)
        val open: MaterialButton = view.findViewById(R.id.adminManageConnOpenBtn)
        val delete: MaterialButton = view.findViewById(R.id.adminManageConnDeleteBtn)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_manage_connection, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = items[position]
        holder.title.text = "${item.user1Name} <> ${item.user2Name}"
        holder.meta.text = "Connection #${item.connectionId} • IDs: ${item.user1Id}, ${item.user2Id}"
        holder.open.setOnClickListener { onOpen(item) }
        holder.delete.setOnClickListener { onDelete(item) }
    }

    override fun getItemCount(): Int = items.size

    fun submit(newItems: List<AdminConnection>) {
        items = newItems
        notifyDataSetChanged()
    }
}
