package com.pavavak.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.pavavak.app.nativechat.AdminUser

class AdminUsersAdapter(
    private var items: List<AdminUser>,
    private val onApprove: (AdminUser) -> Unit,
    private val onReject: (AdminUser) -> Unit
) : RecyclerView.Adapter<AdminUsersAdapter.VH>() {

    class VH(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.adminUserTitle)
        val subtitle: TextView = view.findViewById(R.id.adminUserSubtitle)
        val meta: TextView = view.findViewById(R.id.adminUserMeta)
        val actions: LinearLayout = view.findViewById(R.id.adminUserActions)
        val approve: MaterialButton = view.findViewById(R.id.adminUserApproveBtn)
        val reject: MaterialButton = view.findViewById(R.id.adminUserRejectBtn)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_admin_user, parent, false)
        return VH(view)
    }

    override fun onBindViewHolder(holder: VH, position: Int) {
        val user = items[position]
        holder.title.text = user.fullName.ifBlank { user.username }
        holder.subtitle.text = buildString {
            append("@${user.username}")
            if (user.email.isNotBlank()) append(" • ${user.email}")
        }
        holder.meta.text = buildString {
            append(if (user.isApproved) "Approved" else "Pending approval")
            append(" • ")
            append(if (user.isAdmin) "Admin" else "User")
            if (user.createdAt.isNotBlank()) append(" • ${user.createdAt}")
        }
        val pending = !user.isApproved
        holder.actions.visibility = if (pending) View.VISIBLE else View.GONE
        holder.approve.setOnClickListener { onApprove(user) }
        holder.reject.setOnClickListener { onReject(user) }
    }

    override fun getItemCount(): Int = items.size

    fun submit(newItems: List<AdminUser>) {
        items = newItems
        notifyDataSetChanged()
    }
}
