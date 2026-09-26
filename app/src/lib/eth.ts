import { invoke } from '@tauri-apps/api/core'

// Ethereum鍵はRust側(src-tauri/src/eth.rs)がConcrntと同じmnemonicから m/44'/60'/0'/0/0 で派生する。
// 秘密鍵はJSに出てこない。ハッシュ計算・RLPエンコードはJS側の責務。

/** アカウントのEthereumアドレス(EIP-55)。端末認証は不要。 */
export const getEthAddress = (ccid?: string): Promise<`0x${string}`> =>
    invoke<`0x${string}`>('get_eth_address', { ccid })

/**
 * 32バイトのダイジェストに署名し `0x{r}{s}{v}` (v=27/28) を返す。端末認証が必須。
 * tx署名: viemの `keccak256(serializeTransaction(tx))` で得たハッシュを渡し、
 * 返った署名を `serializeTransaction(tx, parseSignature(sig))` に渡すと配布可能なraw txになる。
 */
export const signEthHash = (hash: string, ccid?: string): Promise<`0x${string}`> =>
    invoke<`0x${string}`>('sign_eth_hash', { hash, ccid })

/** EIP-191 personal_sign。端末認証が必須。 */
export const signEthMessage = (message: string, ccid?: string): Promise<`0x${string}`> =>
    invoke<`0x${string}`>('sign_eth_message', { message, ccid })
