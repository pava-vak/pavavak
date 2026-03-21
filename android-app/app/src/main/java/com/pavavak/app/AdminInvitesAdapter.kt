package com.pavavak.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.AdminInvite

class AdminInvitesAdapter(
    private var items: List<AdminInvite>,
    private val onCopy: (AdminInvite) -> Unit,
    private val onDelete: (AdminInvite) -> Unit
) : RecyclerView.Adapter<AdminInvitesAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val code: TextView = view.findViewById(R.id.adminInviteCode)
        val meta: TextView = view.findViewById(R.id.adminInviteMeta)
        val copy: MaterialButton = view.findViewById(R.id.adminInviteCopyBtn)
        val delete: MaterialButton = view.findViewById(R.id.adminInviteDeleteBtn)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_invite, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val invite = items[position]
        holder.code.text = invite.code
        holder.meta.text = buildString {
            append(if (invite.used) "Used" else "Unused")
            if (!invite.usedByUsername.isNullOrBlank()) append(" • by @${invite.usedByUsername}")
            if (invite.createdAt.isNotBlank()) append(" • ${invite.createdAt}")
        }
        holder.copy.setOnClickListener { onCopy(invite) }
        holder.delete.setOnClickListener { onDelete(invite) }
    }

    override fun getItemCount(): Int = items.size

    fun submit(newItems: List<AdminInvite>) {
        items = newItems
        notifyDataSetChanged()
    }
}
