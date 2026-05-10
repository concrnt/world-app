import { useEffect, useState } from 'react'
import { type Summary, useUrlSummary } from '../contexts/UrlSummary'
import { CssVar } from '../types/Theme'

interface Props {
    url: string
}

export const UrlSummaryCard = (props: Props) => {
    const service = useUrlSummary()
    const [preview, setPreview] = useState<Summary | undefined>(undefined)
    const [errored, setErrored] = useState(false)

    useEffect(() => {
        if (!service) return
        service
            .getSummary(props.url)
            .then((summary) => {
                if (summary) setPreview(summary)
                else setErrored(true)
            })
            .catch(() => {
                setErrored(true)
            })
    }, [props.url, service])

    if (!service || errored) return null

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

    return (
        <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
                e.stopPropagation()
            }}
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
            {(preview.thumbnail || preview.icon) && (
                <div
                    style={{
                        width: '80px',
                        height: '80px',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundImage: `url(${preview.thumbnail || preview.icon})`,
                        flexShrink: 0
                    }}
                />
            )}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '8px',
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
                        lineHeight: 1.3
                    }}
                >
                    {preview.title || hostname}
                </div>
                <div
                    style={{
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
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
                        opacity: 0.5
                    }}
                >
                    {hostname}
                </div>
            </div>
        </a>
    )
}
