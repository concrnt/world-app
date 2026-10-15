import { type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import cfm from '@concrnt/cfm'
import { CCImage, Codeblock, CssVar, EmojipackCard, IconButton, migrateTheme, Text, ThemeCard } from '@concrnt/ui'
import { useThemeLibrary } from '../contexts/Theme'
import { EmojiPickerContext, type EmojiPackage } from '../contexts/EmojiPicker'
import { useMediaViewer } from '../contexts/MediaViewer'
import { useRenderedBody } from '../contexts/RenderedBody'
import { CCUserChip } from './CCUserChip'
import { TimelineChip } from './TimelineChip'
import { ExternalLink } from './ExternalLink'

const ThemeCodeBlock = ({ body, lang }: { body: string; lang: string }): ReactNode => {
    // ThemeProviderの外(guest/welcome)ではundefined: 取込ボタンを出さない
    const { importTheme } = useThemeLibrary()

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
    // EmojiPickerProviderの外(guest/welcome)ではundefined: カードは出さずテキスト表示に落とす
    const picker = useContext(EmojiPickerContext)
    const loadEmojiPackage = picker?.loadEmojiPackage
    const [pack, setPack] = useState<EmojiPackage | null>(null)
    const body = useRenderedBody()
    const updateBody = body?.update

    useEffect(() => {
        if (!loadEmojiPackage) return
        let cancelled = false
        loadEmojiPackage(url)
            .then((p) => {
                if (!cancelled) setPack(p)
            })
            .catch((e) => {
                console.error(e)
            })
        return () => {
            cancelled = true
        }
    }, [url, loadEmojiPackage])

    // 「[Emoji Pack: url]」のテキストがカードに置き換わると本文の innerText からURLが消えるので配り直す
    useEffect(() => {
        updateBody?.()
    }, [pack, updateBody])

    if (!pack || !picker) {
        return <Text>[Emoji Pack: {url}]</Text>
    }

    const added = picker.packageURLs.includes(url)

    return (
        <EmojipackCard
            pack={pack}
            action={
                <IconButton
                    disabled={added}
                    onClick={(e) => {
                        e.stopPropagation()
                        picker.addEmojiPackage(url)
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
    oneline?: boolean
}

export interface RenderAstProps {
    ast: any
    emojis: Record<string, EmojiLite>
    imageNodes: any[]
    oneline?: boolean
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

const RenderAst = ({ ast, emojis, imageNodes, oneline }: RenderAstProps): ReactNode => {
    const { open: openMedias } = useMediaViewer()
    const body = useRenderedBody()

    if (Array.isArray(ast)) {
        return (
            <>
                {ast.map((node: any, i: number) => (
                    <RenderAst key={i} ast={node} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
                ))}
            </>
        )
    }

    if (!ast) return <>null</>
    switch (ast.type) {
        case 'newline':
            return oneline ? null : <br />
        case 'Line':
            return (
                <>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
                    {!oneline && <br />}
                </>
            )
        case 'Text':
            return ast.body
        case 'Marquee': // TODO: implement marquee
            return <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
        case 'Italic':
            return (
                <i>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
                </i>
            )
        case 'Bold':
            return (
                <b>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
                </b>
            )
        case 'Strike':
            return (
                <s>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
                </s>
            )
        case 'URL':
            return (
                <ExternalLink href={ast.body} style={{ color: CssVar.contentLink }}>
                    {ast.alt || ast.body}
                </ExternalLink>
            )
        case 'Timeline':
            return <TimelineChip fqid={ast.body} style={{ display: 'inline-flex', verticalAlign: 'middle' }} />
        case 'Spoiler':
            return (
                <Spoiler>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
                </Spoiler>
            )
        case 'Quote':
            if (oneline) {
                return (
                    <>
                        &quot;
                        <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
                        &quot;
                    </>
                )
            }
            return (
                <blockquote style={{ margin: 0, paddingLeft: '1rem', borderLeft: `4px solid ${CssVar.divider}` }}>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
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
                                border: `1px solid ${CssVar.divider}`,
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
            if (ast.body.startsWith('con1') && ast.body.length === 42) {
                return <CCUserChip ccid={ast.body} style={{ display: 'inline-flex', verticalAlign: 'middle' }} />
            } else {
                return <span>@{ast.body}</span>
            }
        }
        case 'Emoji': {
            const emoji = emojis[ast.body]
            return emoji ? (
                <CCImage
                    src={emoji?.imageURL}
                    maxHeight={128}
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
            if (oneline) return <span>[Details]</span>
            return (
                <details
                    onClick={(e) => e.stopPropagation()}
                    onToggle={() => {
                        // 閉じた details の中身は innerText に含まれないので、開閉で本文を配り直す
                        body?.update()
                    }}
                >
                    <summary>{ast.summary.body}</summary>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
                </details>
            )
        case 'InlineCode':
            return (
                <span
                    style={{
                        fontFamily: 'Source Code Pro, monospace',
                        backgroundColor: `rgb(from ${CssVar.contentText} r g b / 0.08)`,
                        borderRadius: 1,
                        border: `0.5px solid ${CssVar.divider}`,
                        padding: '0 0.5rem',
                        margin: '0 0.2rem'
                    }}
                >
                    {ast.body}
                </span>
            )
        case 'Image':
            if (oneline) return <span>[Image: {ast.alt}]</span>
            return (
                <CCImage
                    src={ast.url}
                    alt={ast.alt}
                    style={{
                        maxHeight: '20vh',
                        borderRadius: '8px',
                        maxWidth: '100%',
                        cursor: 'pointer'
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        openMedias(
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
            if (oneline) return <span>[Codeblock]</span>
            if (ast.lang === 'theme') {
                return <ThemeCodeBlock body={String(ast.body)} lang={ast.lang} />
            }
            return <Codeblock language={ast.lang}>{ast.body}</Codeblock>
        case 'EmojiPack':
            if (oneline) return <span>[EmojiPack]</span>
            return <EmojiPackBlock url={String(ast.body)} />
        case 'Heading':
            if (oneline) return <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
            return (
                <Text variant={`h${ast.level}` as any}>
                    <RenderAst ast={ast.body} emojis={emojis} imageNodes={imageNodes} oneline={oneline} />
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
            style={
                props.oneline
                    ? {
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0
                      }
                    : {
                          whiteSpace: 'pre-wrap'
                      }
            }
        >
            <RenderAst ast={ast} emojis={props.emojiDict} imageNodes={imageNodes} oneline={props.oneline} />
        </div>
    )
}
