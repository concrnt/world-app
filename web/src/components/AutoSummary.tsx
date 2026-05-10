import { ReactNode, useMemo } from 'react'
import { UrlSummaryCard } from './UrlSummaryCard'

interface Props {
    body: string
    limit?: number
    children: ReactNode
}

function extractUrls(text: string): string[] {
    // strip markdown image syntax
    let replaced = text.replace(/!\[.*?\]\(.*?\)/g, '')

    // strip codeblock
    replaced = replaced.replace(/```[\s\S]*?```/g, '')

    // strip inline code
    replaced = replaced.replace(/`[\s\S]*?`/g, '')

    // strip img tag
    replaced = replaced.replace(/<img.*?>/g, '')

    // strip social tag
    replaced = replaced.replace(/<social.*?>.*?<\/social>/g, '')

    // strip emojipack tag
    replaced = replaced.replace(/<emojipack.*?\/>/g, '')

    // replace markdown link syntax to just URL
    replaced = replaced.replace(/\[.*?\]\((.*?)\)/g, '$1')

    // strip a tag body
    replaced = replaced.replace(/<a(.*?)>.*?<\/a>/g, '$1')

    // extract urls
    const urls = replaced.match(/(https?:\/\/[\w.\-?=/&%#,@+:!~]+)/g) ?? []

    // deduplicate
    return [...new Set(urls)]
}

export const AutoSummary = (props: Props) => {
    const limit = props.limit ?? 1

    const urls = useMemo(() => {
        if (limit <= 0) return []
        return extractUrls(props.body)
    }, [props.body, limit])

    return (
        <>
            {props.children}
            {urls.slice(0, limit).map((url, i) => {
                // YouTube embed
                let matchYoutube = url.match(/https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)
                if (!matchYoutube) matchYoutube = url.match(/https:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/)
                if (matchYoutube) {
                    return (
                        <div
                            key={i}
                            style={{
                                aspectRatio: '16 / 9',
                                overflow: 'hidden',
                                width: '100%',
                                borderRadius: '8px',
                                marginTop: '4px',
                                maxWidth: '500px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <iframe
                                allowFullScreen
                                src={`https://www.youtube.com/embed/${matchYoutube[1]}`}
                                title="YouTube video player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                            />
                        </div>
                    )
                }

                // Spotify embed
                const matchSpotify = url.match(
                    /https:\/\/open\.spotify\.com\/([-a-zA-Z0-9]+\/)?(track|album|playlist)\/([a-zA-Z0-9]+)/
                )
                if (matchSpotify) {
                    const type = matchSpotify[2]
                    const id = matchSpotify[3]
                    return (
                        <div
                            key={i}
                            style={{
                                overflow: 'hidden',
                                width: '100%',
                                height: '152px',
                                borderRadius: '8px',
                                marginTop: '4px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <iframe
                                allowFullScreen
                                src={`https://open.spotify.com/embed/${type}/${id}`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            />
                        </div>
                    )
                }

                // Apple Music embed
                const matchAppleMusic = url.match(/https:\/\/music\.apple\.com\/([^\s]+)/)
                if (matchAppleMusic) {
                    return (
                        <div
                            key={i}
                            style={{
                                overflow: 'hidden',
                                width: '100%',
                                height: '152px',
                                borderRadius: '8px',
                                marginTop: '4px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <iframe
                                allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
                                sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
                                src={`https://embed.music.apple.com/${matchAppleMusic[1]}`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                            />
                        </div>
                    )
                }

                // SoundCloud embed
                const matchSoundcloud = url.match(/https:\/\/soundcloud\.com\/([^\s]+)/)
                if (matchSoundcloud) {
                    return (
                        <div
                            key={i}
                            style={{
                                overflow: 'hidden',
                                width: '100%',
                                height: '152px',
                                borderRadius: '8px',
                                marginTop: '4px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <iframe
                                allowFullScreen
                                src={`https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/${matchSoundcloud[1]}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                            />
                        </div>
                    )
                }

                // Default: URL summary card
                return <UrlSummaryCard key={i} url={url} />
            })}
        </>
    )
}
