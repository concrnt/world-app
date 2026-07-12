import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Codeblock } from './Codeblock'
import cfm from '@concrnt/cfm'
import { Link } from './Link'
import { Text } from './Text'
import { ThemeCard } from './ThemeCard'
import { EmojipackCard, type EmojipackLite } from './EmojipackCard'
import { IconButton } from './IconButton'
import { migrateTheme, CssVar } from '../types/Theme'
import { useCfmActions } from '../contexts/CfmActions'

const ThemeCodeBlock = ({ body, lang }: { body: string; lang: string }): ReactNode => {
    const { importTheme } = useCfmActions()

    const theme = useMemo(() => {
        try {
            return migrateTheme(JSON.parse(body))
        } catch (e) {
            console.error(e)
            return null
        }
    }, [body])

    if (!theme) {
        return <Codeblock language={lang}>{body}</Codeblock>
    }

    return (
        <ThemeCard
            theme={theme}
            action={
                importTheme && (
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation()
                            importTheme(theme)
                        }}
                        style={{ color: theme.content.text }}
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                    </IconButton>
                )
            }
        />
    )
}

const EmojiPackBlock = ({ url }: { url: string }): ReactNode => {
    const { loadEmojipack, addEmojipack, emojipackURLs } = useCfmActions()
    const [pack, setPack] = useState<EmojipackLite | null>(null)

    useEffect(() => {
        if (!loadEmojipack) return
        let cancelled = false
        loadEmojipack(url)
            .then((p) => {
                if (!cancelled) setPack(p)
            })
            .catch((e) => {
                console.error(e)
            })
        return () => {
            cancelled = true
        }
    }, [url, loadEmojipack])

    if (!pack) {
        return <Text>[Emoji Pack: {url}]</Text>
    }

    const added = emojipackURLs?.includes(url) ?? false

    return (
        <EmojipackCard
            pack={pack}
            action={
                addEmojipack && (
                    <IconButton
                        disabled={added}
                        onClick={(e) => {
                            e.stopPropagation()
                            addEmojipack(url)
                        }}
                        style={{ color: CssVar.contentText, opacity: added ? 0.4 : 1 }}
                    >
                        {added ? (
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        )}
                    </IconButton>
                )
            }
        />
    )
}

export interface EmojiLite {
    imageURL?: string
    animURL?: string
}

export interface CfmRendererProps {
    messagebody: string
    emojiDict: Record<string, EmojiLite>
}

export interface RenderAstProps {
    ast: any
    emojis: Record<string, EmojiLite>
    imageNodes: any[]
}

const collectImageNodes = (ast: any, result: any[]): any[] => {
    if (Array.isArray(ast)) {
        for (const node of ast) collectImageNodes(node, result)
        return result
    }
    if (!ast || typeof ast !== 'object') return result
    if (ast.type === 'Image') {
        result.push(ast)
        return result
    }
    collectImageNodes(ast.body, result)
    return result
}

const Spoiler = ({ children }: { children: ReactNode }) => {
    const [open, setOpen] = useState(false)

    return (
        <span
            style={{
                color: open ? 'text.disabled' : 'transparent',
                backgroundColor: open ? 'transparent' : 'text.primary'
            }}
            onClick={(e) => {
                setOpen(!open)
                e.stopPropagation()
            }}
        >
            {children}
        </span>
    )
}

const RenderAst = ({ ast, emojis, imageNodes }: RenderAstProps): ReactNode => {
    const { openMedias } = useCfmActions()

    if (Array.isArray(ast)) {
        return (
            <>
                {ast.map((node: any, i: number) => (
                    <RenderAst key={i} ast={node} emojis={emojis} imageNodes={imageNodes} />
                ))}
            </>
        )
    }

    if (!ast) return <>null</>
    switch (ast.type) {
        case 'newline':
            return <br />
        case 'Line':
            return (
                <>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
                    <br />
                </>
            )
        case 'Text':
            return ast.body
        case 'Marquee': // TODO: implement marquee
            return <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
        case 'Italic':
            return (
                <i>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
                </i>
            )
        case 'Bold':
            return (
                <b>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
                </b>
            )
        case 'Strike':
            return (
                <s>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
                </s>
            )
        case 'URL':
            return <Link href={ast.body}>{ast.alt || ast.body}</Link>
        case 'Timeline': // TODO: implement TimelineChip
            return <Text>[Timeline: {ast.body}]</Text>
        case 'Spoiler':
            return (
                <Spoiler>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
                </Spoiler>
            )
        case 'Quote':
            return (
                <blockquote style={{ margin: 0, paddingLeft: '1rem', borderLeft: '4px solid #ccc' }}>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
                </blockquote>
            )
        case 'Tag':
            if (ast.body.match(/[0-9a-fA-F]{6}$/)) {
                return (
                    <>
                        <span>{ast.body}</span>
                        <span
                            style={{
                                backgroundColor: '#' + ast.body,
                                width: '1em',
                                height: '1em',
                                display: 'inline-block',
                                marginLeft: '0.25em',
                                borderRadius: '0.2em',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                verticalAlign: '-0.1em',
                                cursor: 'pointer'
                            }}
                            onClick={(e) => {
                                e.stopPropagation()
                                navigator.clipboard.writeText(ast.body)
                            }}
                        />
                    </>
                )
            }
            return <span>#{ast.body}</span>
        case 'Mention': {
            // TODO: implement CCUserChip
            if (ast.body.startsWith('con1') && ast.body.length === 42) {
                //return <CCUserChip ccid={ast.body} />
                return <Text>@{ast.body}</Text>
            } else {
                return <span>@{ast.body}</span>
            }
        }
        case 'Emoji': {
            const emoji = emojis[ast.body]
            return emoji ? (
                <img
                    src={emoji?.imageURL}
                    style={{
                        height: '1.25em',
                        verticalAlign: '-0.45em',
                        marginBottom: '4px'
                    }}
                />
            ) : (
                <span>:{ast.body}:</span>
            )
        }
        case 'Details':
            return (
                <details
                    onClick={(e) => e.stopPropagation()}
                    onToggle={() => {
                        //summary.update()
                    }}
                >
                    <summary>{ast.summary.body}</summary>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
                </details>
            )
        case 'InlineCode':
            return (
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
                    {ast.body}
                </span>
            )
        case 'Image':
            return (
                <img
                    src={ast.url}
                    alt={ast.alt}
                    style={{
                        maxHeight: '20vh',
                        borderRadius: '8px',
                        maxWidth: '100%',
                        cursor: openMedias ? 'pointer' : undefined
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        openMedias?.(
                            imageNodes.map((node) => ({
                                mediaURL: node.url,
                                mediaType: 'image/*',
                                altText: node.alt
                            })),
                            imageNodes.indexOf(ast)
                        )
                    }}
                />
            )
        case 'CodeBlock':
            if (ast.lang === 'theme') {
                return <ThemeCodeBlock body={String(ast.body)} lang={ast.lang} />
            }
            return <Codeblock language={ast.lang}>{ast.body}</Codeblock>
        case 'EmojiPack':
            return <EmojiPackBlock url={String(ast.body)} />
        case 'Heading':
            return (
                <Text variant={`h${ast.level}` as any}>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} />
                </Text>
            )
        default:
            return <>unknown ast type: {ast.type}</>
    }
}

export const CfmRenderer = (props: CfmRendererProps): ReactNode => {
    const ast = useMemo(() => {
        if (props.messagebody === '') {
            return []
        }
        try {
            return cfm.parse(props.messagebody)
        } catch (e) {
            console.error(e)
            return [
                {
                    type: 'Text',
                    body: props.messagebody
                },
                {
                    type: 'Text',
                    body: 'error: ' + JSON.stringify(e)
                }
            ]
        }
    }, [props.messagebody])

    const imageNodes = useMemo(() => collectImageNodes(ast, []), [ast])

    return (
        <div
            style={{
                whiteSpace: 'pre-wrap'
            }}
        >
            <RenderAst ast={ast} emojis={props.emojiDict} imageNodes={imageNodes} />
        </div>
    )
}
