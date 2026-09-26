import { createWalletClient, http, isAddressEqual, parseEther } from 'viem'
import { Schemas, type Client, type Message, type UpgradeAssociationSchema } from '@concrnt/worldlib'
import type { Document } from '@concrnt/client'
import type { Emoji } from '../contexts/EmojiPicker'
import { createTauriAccount } from './ethAccount'
import {
    buildSuperreaction,
    chain,
    getPublicClient,
    getTipjar,
    resolveHost,
    RPC_URL,
    TIP_SPLITTER_ADDRESS,
    tipSplitterAbi
} from './tipjar'

export type SuperReactionErrorCode =
    | 'not-configured'
    | 'no-sender-tipjar'
    | 'no-receiver-tipjar'
    | 'tipjar-mismatch'
    | 'tx-reverted'
    | 'commit-failed'

export class SuperReactionError extends Error {
    code: SuperReactionErrorCode
    txhash?: string
    constructor(code: SuperReactionErrorCode, message: string, txhash?: string) {
        super(message)
        this.name = 'SuperReactionError'
        this.code = code
        this.txhash = txhash
    }
}

// 送信シーケンス: tipjar 確認 → host 解決 → association 組立(ccfs 確定) → TipSplitter.tip 送信 →
// receipt 待ち → superreaction commit → upgrade(txhash) commit。
// tx を先に送るのは、途中で中断されたときに孤児 association を残さないため。
export const sendSuperReaction = async (params: {
    client: Client
    message: Message<any>
    emoji: Emoji
    amountEth: string
    text?: string
}): Promise<{ ccfs: string; txhash: `0x${string}` }> => {
    const { client, message, emoji, amountEth, text } = params
    if (!RPC_URL || !TIP_SPLITTER_ADDRESS)
        throw new SuperReactionError('not-configured', 'tip router is not configured')

    const [sender, receiver] = await Promise.all([
        getTipjar(client, client.ccid),
        getTipjar(client, message.author, message.authorUser?.domain)
    ])
    if (!sender) throw new SuperReactionError('no-sender-tipjar', 'sender tipjar is not enabled')
    if (!receiver) throw new SuperReactionError('no-receiver-tipjar', 'receiver tipjar is not enabled')

    const account = await createTauriAccount(client.ccid)
    if (!isAddressEqual(account.address, sender)) {
        throw new SuperReactionError('tipjar-mismatch', 'published tipjar does not match this device key')
    }

    const domain =
        message.authorUser?.domain ??
        (await client.api.getEntity(message.author, message.hint).then((e) => e?.value.domain))
    const { host, ratioBps } = await resolveHost(domain)

    const { doc, ccfs } = buildSuperreaction(client, message, emoji, amountEth, text)

    const publicClient = getPublicClient()
    const { request } = await publicClient.simulateContract({
        address: TIP_SPLITTER_ADDRESS,
        abi: tipSplitterAbi,
        functionName: 'tip',
        args: [ccfs, receiver, host, ratioBps],
        value: parseEther(amountEth),
        account
    })
    const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) })
    const txhash = await wallet.writeContract(request)

    const receipt = await publicClient.waitForTransactionReceipt({
        hash: txhash,
        pollingInterval: 4000,
        timeout: 180_000
    })
    if (receipt.status !== 'success')
        throw new SuperReactionError('tx-reverted', `transaction ${txhash} reverted`, txhash)

    try {
        const sd = await client.api.commit(doc, domain)
        if (sd.ccfs !== ccfs) console.warn('superreaction ccfs mismatch', { expected: ccfs, actual: sd.ccfs })
        const upgrade: Document<UpgradeAssociationSchema> = {
            kind: 'association',
            author: client.ccid,
            schema: Schemas.upgradeAssociation,
            associate: message.uri,
            associationVariant: ccfs,
            value: { txhash, target: ccfs, chainId: chain.id },
            distributes: [],
            createdAt: new Date()
        }
        await client.api.commit(upgrade, domain)
    } catch (e) {
        console.error('failed to commit superreaction:', e)
        throw new SuperReactionError('commit-failed', `tip sent (${txhash}) but commit failed`, txhash)
    }
    return { ccfs, txhash }
}
