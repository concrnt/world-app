import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useClient } from '../../contexts/Client'
import { useResource } from '../../hooks/useResource'
import { verifySuperReaction } from '../../lib/tipjar'
import { SuperReactionCard } from './SuperReactionCard'

// 表示用に平坦化した superreaction+upgrade の組(BigInt や class を含めない: useResource が JSON 比較するため)
export interface SuperReactionPair {
    ccfs: string
    author: string
    associate: string
    txhash: string
    username: string
    avatar?: string
    imageUrl: string
    message?: string
    declaredAmount: string
    createdAt: number
}

interface Props {
    pair: SuperReactionPair
    receiverDomain?: string
}

// 検証は tx hash 単位でモジュールストアにキャッシュされ、再レンダーや再マウントで再取得しない
const Verified = (props: Props) => {
    const { client } = useClient()
    const { pair } = props
    const verification = useResource(`tipverify:${pair.txhash}:${pair.ccfs}`, () =>
        verifySuperReaction(client, pair, { txhash: pair.txhash }, props.receiverDomain)
    )
    return (
        <SuperReactionCard
            author={pair.author}
            username={pair.username}
            avatar={pair.avatar}
            imageUrl={pair.imageUrl}
            message={pair.message}
            eth={verification.status === 'verified' ? verification.amountEth : pair.declaredAmount}
            status={verification.status}
            reason={verification.status === 'failed' ? verification.reason : undefined}
            txhash={pair.txhash}
        />
    )
}

export const SuperReactionItem = (props: Props) => {
    const { pair } = props
    const pending = (
        <SuperReactionCard
            author={pair.author}
            username={pair.username}
            avatar={pair.avatar}
            imageUrl={pair.imageUrl}
            message={pair.message}
            eth={pair.declaredAmount}
            status="pending"
            txhash={pair.txhash}
        />
    )
    return (
        <ErrorBoundary
            fallback={
                <SuperReactionCard
                    author={pair.author}
                    username={pair.username}
                    avatar={pair.avatar}
                    imageUrl={pair.imageUrl}
                    message={pair.message}
                    eth={pair.declaredAmount}
                    status="failed"
                    reason="verify-error"
                    txhash={pair.txhash}
                />
            }
        >
            <Suspense fallback={pending}>
                <Verified {...props} />
            </Suspense>
        </ErrorBoundary>
    )
}
