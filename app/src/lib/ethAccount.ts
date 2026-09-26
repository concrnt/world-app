import { keccak256, parseSignature, serializeTransaction, type LocalAccount } from 'viem'
import { toAccount } from 'viem/accounts'
import { getEthAddress, signEthHash, signEthMessage } from './eth'

// viem の LocalAccount を Rust 側の鍵で構成する。秘密鍵は JS に出ず、
// signTransaction は署名ハッシュだけを sign_eth_hash(端末認証あり)へ渡す。
export const createTauriAccount = async (ccid: string): Promise<LocalAccount> => {
    const address = await getEthAddress(ccid)
    return toAccount({
        address,
        async signTransaction(tx, { serializer = serializeTransaction } = {}) {
            const hash = keccak256(await serializer(tx))
            const signature = await signEthHash(hash, ccid)
            return await serializer(tx, parseSignature(signature))
        },
        async signMessage({ message }) {
            if (typeof message !== 'string') throw new Error('raw message signing is not supported')
            return signEthMessage(message, ccid)
        },
        async signTypedData() {
            throw new Error('signTypedData is not supported')
        }
    })
}
