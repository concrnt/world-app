import type { ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Codeblock } from './Codeblock'
import { Link } from './Link'
import { Text } from './Text'
import { Divider } from './Divider'
import { useCfmActions } from '../contexts/CfmActions'
import { CCImage } from '../contexts/CCImage'

export interface GfmRendererProps {
    messagebody: string
}

const tableBorder = '1px solid #ccc'

export const GfmRenderer = (props: GfmRendererProps): ReactNode => {
    const { openMedias } = useCfmActions()

    return (
        <div
            style={{
                width: '100%',
                wordBreak: 'break-word'
            }}
        >
            <Markdown
                remarkPlugins={[remarkBreaks, remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    p: ({ children }) => <p style={{ margin: '0.5em 0' }}>{children}</p>,
                    h1: ({ children }) => <Text variant="h1">{children}</Text>,
                    h2: ({ children }) => <Text variant="h2">{children}</Text>,
                    h3: ({ children }) => <Text variant="h3">{children}</Text>,
                    h4: ({ children }) => <Text variant="h4">{children}</Text>,
                    h5: ({ children }) => <Text variant="h5">{children}</Text>,
                    h6: ({ children }) => <Text variant="h6">{children}</Text>,
                    ul: ({ children }) => <ul style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>{children}</ol>,
                    blockquote: ({ children }) => (
                        <blockquote style={{ margin: 0, paddingLeft: '1rem', borderLeft: '4px solid #ccc' }}>
                            {children}
                        </blockquote>
                    ),
                    hr: () => <Divider style={{ margin: '0.5em 0' }} />,
                    table: ({ children }) => (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ border: tableBorder, borderCollapse: 'collapse' }}>{children}</table>
                        </div>
                    ),
                    th: ({ children }) => <th style={{ border: tableBorder, padding: '0.5rem' }}>{children}</th>,
                    td: ({ children }) => <td style={{ border: tableBorder, padding: '0.5rem' }}>{children}</td>,
                    a: ({ children, href }) => {
                        if (!href) return <></>
                        return <Link href={href}>{children}</Link>
                    },
                    code: ({ node, children }) => {
                        const language = node?.position
                            ? props.messagebody
                                  .slice(node.position.start.offset, node.position.end.offset)
                                  .split('\n')[0]
                                  .slice(3)
                            : ''

                        const inline = !node?.position || node.position.start.line === node.position.end.line
                        return inline ? (
                            <span
                                style={{
                                    fontFamily: 'Source Code Pro, monospace',
                                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                    borderRadius: 1,
                                    border: '0.5px solid #ddd',
                                    padding: '0 0.5rem',
                                    margin: '0 0.2rem'
                                }}
                            >
                                {children}
                            </span>
                        ) : (
                            <Codeblock language={language}>{String(children).replace(/\n$/, '')}</Codeblock>
                        )
                    },
                    img: ({ src, alt }) => {
                        if (!src) return <></>
                        return (
                            <CCImage
                                src={typeof src === 'string' ? src : undefined}
                                alt={alt}
                                style={{
                                    maxHeight: '20vh',
                                    borderRadius: '8px',
                                    maxWidth: '100%',
                                    cursor: openMedias ? 'pointer' : undefined
                                }}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    openMedias?.([
                                        {
                                            mediaURL: String(src),
                                            mediaType: 'image/*',
                                            altText: alt
                                        }
                                    ])
                                }}
                            />
                        )
                    },
                    details: ({ children }) => (
                        <details
                            onClick={(e) => {
                                e.stopPropagation()
                            }}
                        >
                            {children}
                        </details>
                    )
                }}
            >
                {props.messagebody}
            </Markdown>
        </div>
    )
}
