import { createPublicClient, getAddress, http, isAddress, parseAbi, type Address, type PublicClient } from 'viem'
import { sepolia } from 'viem/chains'
import { CDID, NotFoundError, type Document } from '@concrnt/client'
import {
    Schemas,
    semantics,
    type Client,
    type Message,
    type SuperreactionAssociationSchema,
    type TipjarSchema
} from '@concrnt/worldlib'
import type { Emoji } from '../contexts/EmojiPicker'

// TipRouter プロトコル層(React非依存)。
// ユーザーは cckv://<ccid>/tipjar に受け取りアドレスを公開し、チップは eth-global-tokyo-2026/contract の
// TipSplitter.tip(targetURI, receiver, host, ratioBps) で送る。targetURI にはスーパーリアクション
// association の ccfs を入れ、tx とソーシャルアクションを相互に紐づける。

export const chain = sepolia
export const RPC_URL: string | undefined = import.meta.env.VITE_ETH_RPC_URL || undefined
export const TIP_SPLITTER_ADDRESS: Address | undefined =
    import.meta.env.VITE_TIPSPLITTER_ADDRESS && isAddress(import.meta.env.VITE_TIPSPLITTER_ADDRESS)
        ? getAddress(import.meta.env.VITE_TIPSPLITTER_ADDRESS)
        : undefined
export const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'
export const BPS_DENOMINATOR = 10000

// contract/src/TipSplitter.sol と同一
export const tipSplitterAbi = parseAbi([
    'function tip(string targetURI, address receiver, address host, uint16 ratioBps) payable',
    'function withdraw()',
    'function balances(address account) view returns (uint256)',
    'function BPS_DENOMINATOR() view returns (uint16)',
    'event Tipped(bytes32 indexed targetURIHash, address indexed receiver, address indexed host, address tipper, string targetURI, uint256 amount, uint256 receiverAmount, uint256 hostAmount)',
    'event Withdrawn(address indexed account, uint256 amount)',
    'error ZeroAmount()',
    'error InvalidRatio(uint16 ratio)',
    'error ZeroReceiver()',
    'error HostRequired()',
    'error NothingToWithdraw()',
    'error TransferFailed()'
])

export const explorerTxUrl = (txhash: string): string => `${chain.blockExplorers.default.url}/tx/${txhash}`

let publicClient: PublicClient | undefined
export const getPublicClient = (): PublicClient => {
    if (!RPC_URL) throw new Error('VITE_ETH_RPC_URL is not set')
    if (!publicClient) publicClient = createPublicClient({ chain, transport: http(RPC_URL) })
    return publicClient
}

// ユーザーの tipjar 文書から受け取りアドレスを取り出す。未公開/不正なら null
export const getTipjar = async (client: Client, ccid: string, hint?: string): Promise<Address | null> => {
    try {
        const doc = await client.api.getDocument<TipjarSchema>(semantics.tipjar(ccid), hint, { cache: 'no-cache' })
        const raw = doc.value?.tipjars?.ethereum
        if (typeof raw !== 'string' || !isAddress(raw, { strict: true })) return null
        const address = getAddress(raw)
        return address === ZERO_ADDRESS ? null : address
    } catch (e) {
        if (!(e instanceof NotFoundError)) console.error('failed to fetch tipjar:', e)
        return null
    }
}

export interface HostShare {
    host: Address
    ratioBps: number
}

// 受信者のホストサーバーが /.well-known/tip-router で広告する取り分。
// 無い/不正なら host=0x0・ユーザー100%(送信側と検証側で同じ規則を使うことが重要)
export const resolveHost = async (domain: string | undefined): Promise<HostShare> => {
    const none: HostShare = { host: ZERO_ADDRESS, ratioBps: BPS_DENOMINATOR }
    if (!domain) return none
    try {
        const res = await fetch(`https://${domain}/.well-known/tip-router`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
        })
        if (!res.ok) return none
        const json = (await res.json()) as { version?: unknown; feeBps?: unknown; tipjars?: Record<string, unknown> }
        if (json.version !== 1) return none
        const raw = json.tipjars?.ethereum
        if (typeof raw !== 'string' || !isAddress(raw, { strict: true })) return none
        const host = getAddress(raw)
        if (host === ZERO_ADDRESS) return none
        const feeBps = json.feeBps
        if (typeof feeBps !== 'number' || !Number.isInteger(feeBps) || feeBps < 0 || feeBps > BPS_DENOMINATOR)
            return none
        return { host, ratioBps: BPS_DENOMINATOR - feeBps }
    } catch {
        return none
    }
}

// スーパーリアクション association を組み立て、commit 前に ccfs を確定する。
// サーバーは keccak256(document文字列)[:10]+createdAt で CDID を作り、owner は associate 先(メッセージ作者)。
// api.commit は渡したオブジェクトをそのまま JSON.stringify するので、同じ doc を commit すれば一致する。
export const buildSuperreaction = (
    client: Client,
    message: Message<any>,
    emoji: Emoji,
    amountEth: string,
    text?: string
): { doc: Document<SuperreactionAssociationSchema>; ccfs: string } => {
    const profileURI =
        client.currentProfile && client.currentProfile !== 'main'
            ? semantics.profile(client.ccid, client.currentProfile)
            : undefined
    const doc: Document<SuperreactionAssociationSchema> = {
        kind: 'association',
        author: client.ccid,
        schema: Schemas.superreactionAssociation,
        associate: message.uri,
        associationVariant: emoji.imageURL,
        value: {
            imageUrl: emoji.imageURL,
            shortcode: emoji.shortcode,
            amount: amountEth,
            message: text,
            profileURI
        },
        distributes: [
            semantics.activityTimeline(client.ccid, client.currentProfile),
            semantics.notificationTimeline(message.author, message.authorProfileName || 'main')
        ],
        createdAt: new Date()
    }
    const cdid = CDID.newFromString(JSON.stringify(doc), doc.createdAt).toString()
    return { doc, ccfs: `ccfs://${message.author}/concrnt/${cdid}` }
}
