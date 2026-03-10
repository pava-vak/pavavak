package com.pavavak.app.data.local

import android.content.Context
import androidx.room.Room

object LocalDatabaseProvider {
    @Volatile
    private var INSTANCE: AppLocalDatabase? = null

    fun get(context: Context): AppLocalDatabase {
        return INSTANCE ?: synchronized(this) {
            INSTANCE ?: Room.databaseBuilder(
                context.applicationContext,
                AppLocalDatabase::class.java,
                "pavavak_local.db"
            ).fallbackToDestructiveMigration()
                .build()
                .also { INSTANCE = it }
        }
    }
}

