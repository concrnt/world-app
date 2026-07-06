package com.plugin.keychain

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.TimeUnit

@InvokeArg
class KeychainOptions {
    var key: String = ""
    var password: String? = ""
}

// 保存戦略:
//   正本: 通常コンテキストのSharedPreferences("keychain_prefs")
//     - Auto Backup(dataExtractionRules/backup_rules)の対象になるよう、
//       device-protectedではなく通常のcredential-protectedストレージを使う。
//     - Android Keystoreでの暗号化はしない(Keystore鍵はアンインストールで消え、
//       復元したバックアップが復号不能になるため)。
//   書き込みスルー: Google Play ServicesのBlock Store
//     - GMS内にデータが残るため、同一端末ならアンインストール→再インストールで復元できる。
//     - setShouldBackupToCloud(true)でクラウドバックアップ(画面ロックがあればE2E暗号化)。
//     - 1エントリ4KB制限があるためチャンク分割する。GMSなし端末では全てサイレント失敗し、
//       prefs + Auto Backupのみで動作する(advisory扱い)。
@TauriPlugin
class KeychainPlugin(private val activity: Activity): Plugin(activity) {

    companion object {
        private const val TAG = "KeychainPlugin"
        private const val PREFS_NAME = "keychain_prefs"
        // Block Storeの1エントリ上限は4KB。マージンを取って4000バイトで分割する。
        private const val CHUNK_SIZE = 4000
        private const val GMS_TIMEOUT_SECONDS = 5L
    }

    private val prefs: SharedPreferences =
        activity.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    @Command
    fun getItem(invoke: Invoke) {
        val args = invoke.parseArgs(KeychainOptions::class.java)
        var value = prefs.getString(args.key, null)

        if (value == null) {
            // prefsにない場合(再インストール直後など)はBlock Storeからの復元を試みる
            value = restoreFromBlockStore(args.key)
        }

        val result = JSObject()
        if (value != null) {
            result.put("password", value)
        }
        invoke.resolve(result)
    }

    @Command
    fun hasItem(invoke: Invoke) {
        val args = invoke.parseArgs(KeychainOptions::class.java)
        if (prefs.contains(args.key)) {
            invoke.resolveObject(true)
            return
        }
        invoke.resolveObject(restoreFromBlockStore(args.key) != null)
    }

    // 新規追加専用。既にアイテムが存在する場合は失敗させ、
    // サイレント上書きによる鍵の紛失を防ぐ。更新はupdateItemを使うこと。
    @Command
    fun saveItem(invoke: Invoke) {
        val args = invoke.parseArgs(KeychainOptions::class.java)

        // Block Store側にだけ残っているデータ(再インストール直後)も既存とみなす
        if (prefs.contains(args.key) || restoreFromBlockStore(args.key) != null) {
            invoke.resolveObject(false)
            return
        }

        prefs.edit().putString(args.key, args.password).apply()
        writeThroughToBlockStore(args.key, args.password ?: "")
        invoke.resolveObject(true)
    }

    // 既存アイテムのin-place更新専用。アイテムが存在しない場合は失敗する。
    // 削除→再追加はクラッシュ時にアイテムが消える時間窓ができるため行わない。
    @Command
    fun updateItem(invoke: Invoke) {
        val args = invoke.parseArgs(KeychainOptions::class.java)

        if (!prefs.contains(args.key) && restoreFromBlockStore(args.key) == null) {
            invoke.resolveObject(false)
            return
        }

        prefs.edit().putString(args.key, args.password).apply()
        writeThroughToBlockStore(args.key, args.password ?: "")
        invoke.resolveObject(true)
    }

    @Command
    fun removeItem(invoke: Invoke) {
        val args = invoke.parseArgs(KeychainOptions::class.java)
        prefs.edit().remove(args.key).apply()
        deleteFromBlockStore(args.key)
        invoke.resolveObject(true)
    }

    // --- Block Store helpers (全てadvisory: 失敗してもコマンド自体は失敗させない) ---

    private fun chunkKey(key: String, index: Int): String =
        if (index == 0) key else "$key#$index"

    private fun writeThroughToBlockStore(key: String, value: String) {
        try {
            val client = Blockstore.getClient(activity.applicationContext)
            val bytes = value.toByteArray(Charsets.UTF_8)
            val chunks = ArrayList<ByteArray>()
            var offset = 0
            while (offset < bytes.size) {
                val end = minOf(offset + CHUNK_SIZE, bytes.size)
                chunks.add(bytes.copyOfRange(offset, end))
                offset = end
            }
            if (chunks.isEmpty()) {
                chunks.add(ByteArray(0))
            }

            for ((index, chunk) in chunks.withIndex()) {
                val data = StoreBytesData.Builder()
                    .setBytes(chunk)
                    .setKey(chunkKey(key, index))
                    .setShouldBackupToCloud(true)
                    .build()
                Tasks.await(client.storeBytes(data), GMS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            }

            // 前回より短くなった場合の古い高インデックスチャンクを削除する
            val staleKeys = retrieveAllBlockStoreKeys()
                .filter { isChunkOf(key, it) }
                .filter { chunkIndexOf(key, it) >= chunks.size }
            if (staleKeys.isNotEmpty()) {
                val deleteRequest = DeleteBytesRequest.Builder().setKeys(staleKeys).build()
                Tasks.await(client.deleteBytes(deleteRequest), GMS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Block Store write failed (advisory, ignored)", e)
        }
    }

    private fun restoreFromBlockStore(key: String): String? {
        try {
            val client = Blockstore.getClient(activity.applicationContext)
            val request = RetrieveBytesRequest.Builder().setRetrieveAll(true).build()
            val response = Tasks.await(client.retrieveBytes(request), GMS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            val dataMap = response.blockstoreDataMap

            val chunkKeys = dataMap.keys.filter { isChunkOf(key, it) }
            if (chunkKeys.isEmpty()) return null

            val ordered = chunkKeys.sortedBy { chunkIndexOf(key, it) }
            // 欠落チャンクがある場合は壊れたデータを返さない
            for ((expected, actual) in ordered.withIndex()) {
                if (chunkIndexOf(key, actual) != expected) {
                    Log.w(TAG, "Block Store chunks for $key are incomplete; ignoring")
                    return null
                }
            }

            var totalSize = 0
            for (k in ordered) totalSize += dataMap[k]!!.bytes.size
            val merged = ByteArray(totalSize)
            var offset = 0
            for (k in ordered) {
                val chunk = dataMap[k]!!.bytes
                chunk.copyInto(merged, offset)
                offset += chunk.size
            }
            val value = String(merged, Charsets.UTF_8)

            // prefsへ再充填して以降のアクセスをローカルで完結させる
            prefs.edit().putString(key, value).apply()
            return value
        } catch (e: Exception) {
            Log.w(TAG, "Block Store restore failed (advisory, ignored)", e)
            return null
        }
    }

    private fun deleteFromBlockStore(key: String) {
        try {
            val client = Blockstore.getClient(activity.applicationContext)
            val targetKeys = retrieveAllBlockStoreKeys().filter { isChunkOf(key, it) }
            if (targetKeys.isEmpty()) return
            val request = DeleteBytesRequest.Builder().setKeys(targetKeys).build()
            Tasks.await(client.deleteBytes(request), GMS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        } catch (e: Exception) {
            Log.w(TAG, "Block Store delete failed (advisory, ignored)", e)
        }
    }

    private fun retrieveAllBlockStoreKeys(): List<String> {
        val client = Blockstore.getClient(activity.applicationContext)
        val request = RetrieveBytesRequest.Builder().setRetrieveAll(true).build()
        val response = Tasks.await(client.retrieveBytes(request), GMS_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        return response.blockstoreDataMap.keys.toList()
    }

    private fun isChunkOf(key: String, candidate: String): Boolean {
        if (candidate == key) return true
        if (!candidate.startsWith("$key#")) return false
        return candidate.substring(key.length + 1).toIntOrNull() != null
    }

    private fun chunkIndexOf(key: String, candidate: String): Int {
        if (candidate == key) return 0
        return candidate.substring(key.length + 1).toIntOrNull() ?: Int.MAX_VALUE
    }
}
