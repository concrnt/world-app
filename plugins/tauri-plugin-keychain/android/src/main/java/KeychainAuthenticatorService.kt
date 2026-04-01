package com.plugin.keychain

import android.accounts.AbstractAccountAuthenticator
import android.accounts.AccountAuthenticatorResponse
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.os.Bundle

class KeychainAuthenticatorService : Service() {

    override fun onBind(intent: Intent?): IBinder? {
        return authenticator.iBinder
    }

    private val authenticator = object : AbstractAccountAuthenticator(this) {
        override fun editProperties(response: AccountAuthenticatorResponse?, accountType: String?): Bundle {
            throw UnsupportedOperationException()
        }

        override fun addAccount(
            response: AccountAuthenticatorResponse?,
            accountType: String?,
            authTokenType: String?,
            requiredFeatures: Array<out String>?,
            options: Bundle?
        ): Bundle? {
            return null // 不提供账户添加界面
        }

        override fun confirmCredentials(
            response: AccountAuthenticatorResponse?,
            account: android.accounts.Account?,
            options: Bundle?
        ): Bundle? {
            return null // 不提供凭据验证
        }

        override fun getAuthToken(
            response: AccountAuthenticatorResponse?,
            account: android.accounts.Account?,
            authTokenType: String?,
            options: Bundle?
        ): Bundle {
            throw UnsupportedOperationException()
        }

        override fun getAuthTokenLabel(authTokenType: String?): String {
            throw UnsupportedOperationException()
        }

        override fun updateCredentials(
            response: AccountAuthenticatorResponse?,
            account: android.accounts.Account?,
            authTokenType: String?,
            options: Bundle?
        ): Bundle? {
            return null // 不支持更新凭据
        }

        override fun hasFeatures(
            response: AccountAuthenticatorResponse?,
            account: android.accounts.Account?,
            features: Array<out String>?
        ): Bundle {
            return Bundle().apply { putBoolean("booleanResult", false) }
        }
    }
}