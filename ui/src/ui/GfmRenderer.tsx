import type { ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Codeblock } from './Codeblock'
import { Link } from './Link'
import { Text } from './Text'
import { Divider } from './Divider'
import { useCfmActions } from '../contexts/CfmActions'
import { CCImage } from '../contexts/CCImage'
import type { EmojiLite } from './CfmRenderer'
import styles from './GfmRenderer.module.css'

export interface GfmRendererProps {
    messagebody: string
    emojiDict?: Record<string, EmojiLite>
}

// text/htmlノード中の :shortcode: を独自のemojiノードに分解するremarkプラグイン
const emojiRemarkPlugin = () => {
    const transform = (node: any, index: number | undefined, parent: any): void => {
        if (node.type === 'text' || node.type === 'html') {
            if (!parent || index === undefined || typeof node.value !== 'string') return
            const parts = node.value.split(/(:\w+:)/)
            if (parts.length === 1) return
            parent.children.splice(
                index,
                1,
                ...parts
                    .filter((part: string) => part.length > 0)
                    .map((part: string) =>
                        /^:\w+:$/.test(part)
                            ? { type: 'emoji', shortcode: part.slice(1, -1) }
                            : { type: node.type, value: part }
                    )
            )
            return
        }
        // インラインコード等のvalue系ノードには children が無いのでそのまま素通しになる
        const children = node.children
        if (!Array.isArray(children)) return
        for (let i = children.length - 1; i >= 0; i--) {
            transform(children[i], i, node)
        }
    }
    return (tree: any) => transform(tree, undefined, undefined)
}

// rehype-raw / rehype-sanitize を通しても emoji 要素と shortcode 属性が残るようにする
const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames ?? []), 'emoji'],
    attributes: {
        ...defaultSchema.attributes,
        emoji: ['shortcode']
    }
}

export const GfmRenderer = (props: GfmRendererProps): ReactNode => {
    const { openMedias } = useCfmActions()

    return (
        <div className={styles.body}>
            <Markdown
                remarkPlugins={[remarkBreaks, remarkGfm, emojiRemarkPlugin]}
                rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
                remarkRehypeOptions={{
                    // 独自ノードemojiはmdastの既知ノード型に無いためhandlersの型に乗らない
                    handlers: {
                        emoji: (_state: unknown, node: { shortcode: string }) => ({
                            type: 'element',
                            tagName: 'emoji',
                            properties: { shortcode: node.shortcode },
                            children: []
                        })
                    } as any
                }}
                components={
                    {
                        h1: ({ children }) => <Text variant="h1">{children}</Text>,
                        h2: ({ children }) => <Text variant="h2">{children}</Text>,
                        h3: ({ children }) => <Text variant="h3">{children}</Text>,
                        h4: ({ children }) => <Text variant="h4">{children}</Text>,
                        h5: ({ children }) => <Text variant="h5">{children}</Text>,
                        h6: ({ children }) => <Text variant="h6">{children}</Text>,
                        hr: () => <Divider style={{ margin: '0.5em 0' }} />,
                        table: ({ children }) => (
                            <div className={styles.tableWrapper}>
                                <table>{children}</table>
                            </div>
                        ),
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
                        ),
                        emoji: ({ shortcode }: { shortcode?: string }) => {
                            const emoji = shortcode ? props.emojiDict?.[shortcode] : undefined
                            return emoji ? (
                                <CCImage
                                    src={emoji.animURL ?? emoji.imageURL}
                                    alt={shortcode}
                                    maxHeight={128}
                                    style={{
                                        height: '2em',
                                        verticalAlign: 'middle'
                                    }}
                                />
                            ) : (
                                <span>:{shortcode}:</span>
                            )
                        }
                    } as Components
                }
            >
                {props.messagebody}
            </Markdown>
        </div>
    )
}
