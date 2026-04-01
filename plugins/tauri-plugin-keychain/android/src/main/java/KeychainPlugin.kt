package com.plugin.keychain

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.JSArray
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import org.json.JSONArray
import android.content.Context
import android.accounts.Account
import android.accounts.AccountManager
import android.os.Build

@InvokeArg
class KeychainOptions {
    var key: String = ""
    var password: String? = ""
}

@TauriPlugin
class KeychainPlugin(private val activity: Activity): Plugin(activity) {

	private val deviceProtectedContext: Context

	init {
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
					val context = activity.applicationContext
					deviceProtectedContext = context.createDeviceProtectedStorageContext()
					if (!deviceProtectedContext.isDeviceProtectedStorage) {
							deviceProtectedContext.moveSharedPreferencesFrom(context, "secure_prefs")
							deviceProtectedContext.moveDatabaseFrom(context, "secure_db")
					}
			} else {
					throw UnsupportedOperationException("Device Protected Storage requires API 24 or above")
			}
	}
	
	private val accountType = "com.tauri.keychain" 
	@Command
	fun getItem(invoke: Invoke) {
		val args = invoke.parseArgs(KeychainOptions::class.java)
		val accountManager = AccountManager.get(activity.applicationContext)
		
		val accounts = accountManager.getAccountsByType(accountType)
		val targetAccount = accounts.firstOrNull { it.name == args.key }

		if (targetAccount != null) {
				val password = accountManager.getPassword(targetAccount)
				invoke.resolve(JSObject().apply { put("password", password ?: "") })
		} else {
				val sharedPreferences = deviceProtectedContext.getSharedPreferences("secure_prefs", Context.MODE_PRIVATE)
				val password = sharedPreferences.getString(args.key, null)
				invoke.resolve(JSObject().apply { put("password", password ?: "") })
		}
		
	}
	
	@Command
	fun saveItem(invoke: Invoke) {
		val args = invoke.parseArgs(KeychainOptions::class.java)
		val accountManager = AccountManager.get(activity.applicationContext)
		val existingAccounts = accountManager.getAccountsByType(accountType)
		val existingAccount = existingAccounts.firstOrNull { it.name == args.key }

		
		if (existingAccount != null) {
				accountManager.setPassword(existingAccount, args.password)
				invoke.resolve(JSObject().apply { put("status", "Password updated") })
		} else {
				// 添加新账户
				val newAccount = Account(args.key, accountType)
				val success = accountManager.addAccountExplicitly(newAccount, args.password, null)

				if (success) {
						invoke.resolve(JSObject().apply { put("status", "Account added") })
				} else {
						invoke.resolve(JSObject().apply { put("status", "") })
				}
		}
		val sharedPreferences = deviceProtectedContext.getSharedPreferences("secure_prefs", Context.MODE_PRIVATE)
		sharedPreferences.edit().putString(args.key, args.password).apply()
	}
	
	@Command
	fun removeItem(invoke: Invoke) {
		val args = invoke.parseArgs(KeychainOptions::class.java)
		val accountManager = AccountManager.get(activity.applicationContext)
		
		val accounts = accountManager.getAccountsByType(accountType)
		val targetAccount = accounts.firstOrNull { it.name == args.key }

		if (targetAccount != null) {
				val success = accountManager.removeAccountExplicitly(targetAccount)
				if (success) {
						invoke.resolve(JSObject().apply { put("status", "Account removed") })
				} else {
						invoke.resolve(JSObject().apply { put("status", "Account removed") })
				}
		} else {
			invoke.resolve(JSObject().apply { put("status", "Account removed") })
		}
		
		val sharedPreferences = deviceProtectedContext.getSharedPreferences("secure_prefs", Context.MODE_PRIVATE)
		sharedPreferences.edit().remove(args.key).apply()
	}

}
