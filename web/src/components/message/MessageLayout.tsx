import { ReactNode } from 'react'
import { Message } from '@concrnt/worldlib'
import { Timestamp } from './Timestamp'

interface Props {
    onClick?: () => void
    detail?: boolean
    left: ReactNode
    headerLeft: ReactNode
    headerRight?: ReactNode
    children?: ReactNode
    // web専用(app版と意図的な差分): クローラー向けに schema.org/SocialMediaPosting のmicrodataを出す。
    // 投稿本体(markdown/gfm/mfm/plaintext/media/reply)だけが渡し、カード型(FollowAck等)は渡さない
    message?: Message<any>
}

// app版との意図的な差分(web): テキストの部分選択コピーを妨げないよう、メッセージ全体クリックでは
// 遷移せず、headerRight(時刻)のクリックで詳細ビューへ遷移する。
// headerRightが無いカード型の利用(FollowAck / RerouteAssociation等)は従来どおり全体クリック。
export const MessageLayout = (props: Props) => {
    const timestampNav = !props.detail && props.onClick !== undefined && Boolean(props.headerRight)
    const message = props.message
    // どのドメインで配信されても同じ投稿なので、canonicalと構造化データのURLはconcrnt.worldに統一する
    const origin = 'https://concrnt.world'
    const authorPath = message
        ? '/profile/' +
          message.author +
          (message.authorProfileName && message.authorProfileName !== 'main' ? '/' + message.authorProfileName : '')
        : ''
    return (
        <div
            itemScope={message ? true : undefined}
            itemType={message ? 'https://schema.org/SocialMediaPosting' : undefined}
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                overflow: 'hidden',
                userSelect: 'text',
                WebkitUserSelect: 'text'
            }}
            onClick={(e) => {
                e.stopPropagation()
                if (!props.detail && !timestampNav) props.onClick?.()
            }}
        >
            {message && (
                <>
                    {/* itemProp付きの<meta>はReact 19でもheadにhoistされず、このitemScope内に留まる */}
                    <meta itemProp="identifier" content={message.uri} />
                    <meta itemProp="url" content={origin + '/post/' + encodeURIComponent(message.uri)} />
                    <meta itemProp="datePublished" content={new Date(message.createdAt).toISOString()} />
                    {typeof message.value?.body === 'string' && message.value.body !== '' && (
                        <meta itemProp="text" content={message.value.body} />
                    )}
                    {/* display:noneにしないと空のflexアイテムになりgap分だけアバターがずれる */}
                    <span itemProp="author" itemScope itemType="https://schema.org/Person" style={{ display: 'none' }}>
                        <meta itemProp="identifier" content={message.author} />
                        <meta itemProp="url" content={origin + authorPath} />
                        {message.authorProfile?.username && (
                            <meta itemProp="name" content={message.authorProfile.username} />
                        )}
                        {message.authorUser?.alias && (
                            <meta itemProp="alternateName" content={message.authorUser.alias} />
                        )}
                    </span>
                </>
            )}
            <div style={{ flexShrink: 0, marginTop: '5px' }}>{props.left}</div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    flex: 1,
                    overflow: 'hidden'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                    }}
                >
                    {props.headerLeft}
                    {timestampNav ? (
                        <Timestamp onClick={props.onClick}>{props.headerRight}</Timestamp>
                    ) : (
                        props.headerRight
                    )}
                </div>
                {props.children}
            </div>
        </div>
    )
}
