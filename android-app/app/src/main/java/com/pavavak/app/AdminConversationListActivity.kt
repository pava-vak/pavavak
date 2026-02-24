package com.pavavak.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.appbar.MaterialToolbar
import com.pavavak.app.nativechat.NativeApi
import kotlinx.coroutines.launch

class AdminConversationListActivity : AppCompatActivity() {

    private lateinit var progress: ProgressBar
    private lateinit var empty: TextView
    private lateinit var adapter: AdminConnectionAdapter
    private lateinit var swipeRefresh: SwipeRefreshLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_conversation_list)

        findViewById<MaterialToolbar>(R.id.adminConnToolbar).setNavigationOnClickListener { finish() }

        progress = findViewById(R.id.adminConnProgress)
        empty = findViewById(R.id.adminConnEmpty)
        swipeRefresh = findViewById(R.id.adminConnSwipeRefresh)
        swipeRefresh.setOnRefreshListener { load() }

        val rv = findViewById<RecyclerView>(R.id.adminConnRecycler)
        rv.layoutManager = LinearLayoutManager(this)
        adapter = AdminConnectionAdapter(emptyList()) { conn ->
            startActivity(
                Intent(this, AdminConversationActivity::class.java)
                    .putExtra("user1Id", conn.user1Id)
                    .putExtra("user2Id", conn.user2Id)
                    .putExtra("title", "${conn.user1Name} <> ${conn.user2Name}")
            )
        }
        rv.adapter = adapter
    }

    override fun onResume() {
        super.onResume()
        load()
    }

    private fun load() {
        progress.visibility = View.VISIBLE
        empty.visibility = View.GONE
        swipeRefresh.isRefreshing = false
        lifecycleScope.launch {
            val items = NativeApi.getAdminConnections()
            progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            adapter.submit(items)
            if (items.isEmpty()) {
                empty.visibility = View.VISIBLE
                empty.text = "No active connections found."
            }
        }
    }
}
