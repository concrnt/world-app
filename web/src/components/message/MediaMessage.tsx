import { MessageProps } from './types'
import { MediaMessageSchema } from '@concrnt/worldlib'

import { Avatar, CfmRenderer, CssVar } from '@concrnt/ui'

import { MessageLayout } from './MessageLayout'
import { MessageAuthor } from './MessageAuthor'
import { TimeDiff } from '../TimeDiff'
import { useNavigate } from 'react-router-dom'
import { renderUriTemplate } from '@concrnt/client'
import { useClient } from '../../contexts/Client'
import { MessageFooter } from './Footer'
import { AutoSummary } from '../AutoSummary'
import { MediaGallery } from '../MediaGallery/main'
import { CollapsibleBody } from './CollapsibleBody'

export const MediaMessage = (props: MessageProps<MediaMessageSchema>) => {
    const navigate = useNavigate()
    const { client } = useClient()

    const message = props.message

    return (
        <MessageLayout
            message={message}
            detail={props.detail}
            onClick={() => {
                navigate('/post/' + encodeURIComponent(message.uri))
            }}
            left={
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        navigate(
                            '/profile/' +
                                message.author +
                                (message.authorProfileName && message.authorProfileName !== 'main'
                                    ? '/' + message.authorProfileName
                                    : '')
                        )
                    }}
                >
                    <Avatar
                        ccid={message.author}
                        src={message.authorProfile?.avatar}
                        style={{ width: '48px', height: '48px' }}
                        badge={
                            // profileOverrideでアイコンが差し替えられた代理投稿(discord-bridge等)は、
                            // 差し替え前のアイコン(サービスアカウント自身)を右下に添えて出どころを示す
                            message.authorOriginalProfile && (
                                <Avatar
                                    ccid={message.author}
                                    src={message.authorOriginalProfile.avatar}
                                    style={{ width: '18px', height: '18px' }}
                                />
                            )
                        }
                        badgeColor={CssVar.contentBackground}
                        badgeSize={22}
                    />
                </div>
            }
            headerLeft={<MessageAuthor message={message} />}
            headerRight={<TimeDiff date={message.createdAt} />}
        >
            {message.value.body && (
                <CollapsibleBody forceExpanded={props.forceExpanded}>
                    <AutoSummary body={message.value.body}>
                        <CfmRenderer messagebody={message.value.body} emojiDict={message.value.emojis ?? {}} />
                    </AutoSummary>
                </CollapsibleBody>
            )}

            <MediaGallery medias={message.value.medias ?? []} messageURI={message.uri} />
            {(message.value.medias ?? [])
                .filter((m) => !m.flag && (m.mediaType.startsWith('image') || m.mediaType.startsWith('video')))
                .map((m) => {
                    // ゲスト表示ではMediaProxyProviderが無くccfs://のままなので、クローラー向けにresolveエンドポイントへ変換する
                    let src = m.mediaURL
                    if (src.startsWith('ccfs://')) {
                        src =
                            client.server && 'net.concrnt.core.resolve' in client.server.endpoints
                                ? `https://${client.api.defaultHost}${renderUriTemplate(client.server, 'net.concrnt.core.resolve', { uri: src })}`
                                : `https://${client.api.defaultHost}/api/v2/resolve?uri=${encodeURIComponent(src)}`
                    }
                    return (
                        <meta
                            key={m.mediaURL}
                            itemProp={m.mediaType.startsWith('video') ? 'video' : 'image'}
                            content={src}
                        />
                    )
                })}
            <MessageFooter message={message} rerouted={props.rerouted} />
        </MessageLayout>
    )
}
