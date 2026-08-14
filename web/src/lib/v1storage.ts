import { LoadIdentity, LoadKey, LoadSubKey } from '@concrnt/client'

// concrnt.worldでv1クライアント(concrnt-world)から差し替えられた際に残るlocalStorage等の移行。
// v1はセッションキーをJSON.stringifyで保存し、SubKeyのプレフィックスもconcurrent-subkey
// (v2はconcrnt-subkey)のため、放置するとInMemoryAuthProviderの構築がthrowして起動できない。
// v2のQRログインもusePersistent経由でJSON形式のDomain/SubKeyを書くため、クォートの有無ではなく
// v1にしか無い痕跡(IdentityキーとSubKeyのプレフィックス)で判定する。
export const migrateV1Storage = (): void => {
    try {
        const unwrap = (value: string | null): string | null => {
            if (!value || value === 'undefined' || value === 'null') return null
            try {
                const parsed = JSON.parse(value)
                return typeof parsed === 'string' ? parsed : null
            } catch {
                return value
            }
        }

        const identityRaw = localStorage.getItem('Identity')
        const subKey = unwrap(localStorage.getItem('SubKey'))
        const isV1 = identityRaw !== null || (subKey?.startsWith('concurrent-subkey') ?? false)
        if (!isV1) return

        console.log('v1 (concrnt-world) storage detected. migrating...')

        // SubKey: "concurrent-subkey <hex> <ccid>@<domain> <name>" → v2形式の生文字列へ変換。
        // v1のsubkeyはenactがサーバー移行されないためv2では書き込み無効だが、セッションとしては
        // 引き継ぎ、起動後のcheckSubkeyStatusにinvalidを検知させて既存の再ログイン導線
        // (SubkeyInvalidDrawer+読み取り専用起動)に乗せる
        if (localStorage.getItem('SubKey') !== null) {
            const parsed = subKey ? LoadSubKey(subKey.replace(/^concurrent-subkey/, 'concrnt-subkey')) : null
            if (parsed) {
                localStorage.setItem(
                    'SubKey',
                    `concrnt-subkey ${parsed.keypair.privatekey} ${parsed.ccid}@${parsed.domain} -`
                )
            } else {
                // 鍵素材を無警告で消さない: パース不能でも生値を退避してから起動経路から外す
                localStorage.setItem('SubKey_broken', localStorage.getItem('SubKey') ?? '')
                localStorage.removeItem('SubKey')
            }
        }

        // Domain: JSON二重クォートを生文字列に正規化
        const domain = unwrap(localStorage.getItem('Domain'))
        if (localStorage.getItem('Domain') !== null) {
            if (domain) {
                localStorage.setItem('Domain', domain)
            } else {
                localStorage.removeItem('Domain')
            }
        }

        // PrivateKey(マスターキー): 鍵はv2でもそのまま有効なのでセッションを引き継ぐ。
        // 壊れ値("undefined"等)はthrowの元なので落とす
        const masterKey = unwrap(localStorage.getItem('PrivateKey'))
        if (localStorage.getItem('PrivateKey') !== null) {
            if (masterKey && LoadKey(masterKey)) {
                localStorage.setItem('PrivateKey', masterKey)
                // 自動移行されたentity(proof:none)の再コミットをClientProviderに依頼する。
                // ログイン画面を通る通常フロー(ensureEntityProof)の代替
                localStorage.setItem('V1EntityProofPending', 'true')
            } else {
                // マスターキーは絶対に無警告で消さない: 判定側のバグや壊れ値でも生値を退避して残す
                localStorage.setItem('PrivateKey_broken', localStorage.getItem('PrivateKey') ?? '')
                localStorage.removeItem('PrivateKey')
            }
        }

        // v1のIdentityからニーモニックをv2のMnemonicキーへ移行(ID画面のバックアップDLが使える)。
        // 別アカウントの残骸を誤ってバックアップさせないよう、現セッションの鍵と一致する時のみ
        if (identityRaw !== null) {
            try {
                const mnemonic = JSON.parse(identityRaw)?.mnemonic
                const loaded = typeof mnemonic === 'string' ? LoadIdentity(mnemonic) : null
                if (loaded && masterKey && loaded.privateKey === masterKey) {
                    localStorage.setItem('Mnemonic', loaded.mnemonic) // EN形へ正規化される
                }
            } catch (err) {
                console.error('failed to migrate v1 mnemonic', err)
            }
        }

        // v1固有キーと、v1スキーマが混入すると実害のある共有キーを削除。
        // preferenceはv1形のままだとcckvへ書き戻されてしまう(v2側設定はcckvから再同期される)
        const v1Keys = [
            'Identity',
            'theme',
            'preference',
            'preferredTimeline',
            'draft',
            'draftEmojis',
            'draftMedias',
            'FrequentEmojis',
            'AudioPlayerVolume',
            'openWhisperWarning',
            'migrator-dest-fqdn',
            'noloadsettings',
            'lastQuickFix'
        ]
        for (const key of Object.keys(localStorage)) {
            if (v1Keys.includes(key) || key.startsWith('emojiPackage:')) {
                localStorage.removeItem(key)
            }
        }

        // v1のキャッシュDBとService Workerキャッシュを掃除する(fire-and-forget)。
        // v2のSW登録はログイン後のみなのでこの時点での全キャッシュ削除は安全。
        // v1のSW自体はautoUpdateのため、デプロイされたv2のsw.jsに自動置換される
        try {
            indexedDB.deleteDatabase('concrnt-client')
        } catch (err) {
            console.error('failed to delete v1 cache db', err)
        }
        if ('caches' in window) {
            caches
                .keys()
                .then(async (keys) => await Promise.all(keys.map(async (key) => await caches.delete(key))))
                .catch(() => {})
        }
    } catch (err) {
        // 移行自体の失敗で起動を壊さない
        console.error('v1 storage migration failed', err)
    }
}
