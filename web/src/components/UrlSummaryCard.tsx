import { useEffect, useState } from 'react'
import { type Summary, useUrlSummary } from '../contexts/UrlSummary'
import { useMediaProxy } from '../contexts/MediaProxy'
import { CssVar } from '../types/Theme'
import { ExternalLink } from './ExternalLink'

interface Props {
    url: string
    summary?: Partial<Summary>
}

export const UrlSummaryCard = (props: Props) => {
    const service = useUrlSummary()
    const { getImageURL } = useMediaProxy()
    const [fetched, setFetched] = useState<Summary | undefined>(undefined)
    const [errored, setErrored] = useState(false)

    const given = props.summary

    useEffect(() => {
        if (given || !service) return
        service
            .getSummary(props.url)
            .then((summary) => {
                if (summary) setFetched(summary)
                else setErrored(true)
            })
            .catch(() => {
                setErrored(true)
            })
    }, [props.url, service, given])

    const preview = given ?? fetched
    if (errored || (!service && !preview)) return null

    let hostname = ''
    try {
        hostname = new URL(props.url).hostname
    } catch {
        hostname = props.url
    }

    if (!preview) {
        return (
            <div
                style={{
                    display: 'flex',
                    height: '80px',
                    width: '100%',
                    overflow: 'hidden',
                    borderRadius: CssVar.round(1),
                    border: `1px solid ${CssVar.divider}`
                }}
            >
                <div
                    style={{
                        width: '80px',
                        height: '80px',
                        flexShrink: 0,
                        backgroundColor: CssVar.divider
                    }}
                />
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        padding: '8px',
                        flex: 1,
                        overflow: 'hidden'
                    }}
                >
                    <div
                        style={{
                            height: '14px',
                            width: '60%',
                            backgroundColor: CssVar.divider,
                            borderRadius: '4px'
                        }}
                    />
                    <div
                        style={{
                            height: '12px',
                            width: '90%',
                            backgroundColor: CssVar.divider,
                            borderRadius: '4px'
                        }}
                    />
                    <div
                        style={{
                            height: '12px',
                            width: '40%',
                            backgroundColor: CssVar.divider,
                            borderRadius: '4px'
                        }}
                    />
                </div>
            </div>
        )
    }

    const image = preview.thumbnail || preview.icon

    return (
        <ExternalLink
            href={props.url}
            style={{
                display: 'flex',
                height: '80px',
                width: '100%',
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                borderRadius: CssVar.round(1),
                border: `1px solid ${CssVar.divider}`
            }}
        >
            {image && (
                <div
                    style={{
                        width: '80px',
                        height: '80px',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundImage: `url(${getImageURL(image, { maxWidth: 512 })})`,
                        flexShrink: 0
                    }}
                />
            )}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '6px 8px',
                    height: '80px',
                    overflow: 'hidden',
                    flex: 1,
                    gap: '2px',
                    boxSizing: 'border-box'
                }}
            >
                <div
                    style={{
                        fontWeight: 'bold',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                        flexShrink: 0
                    }}
                >
                    {preview.title || hostname}
                </div>
                <div
                    style={{
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flexShrink: 0,
                        lineHeight: 1.3,
                        opacity: 0.7,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                    }}
                >
                    {preview.description || ''}
                </div>
                <div
                    style={{
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        opacity: 0.5,
                        lineHeight: 1.3,
                        marginTop: 'auto',
                        flexShrink: 0
                    }}
                >
                    {hostname}
                </div>
            </div>
        </ExternalLink>
    )
}
