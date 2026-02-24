import { type ReactNode, useMemo, useState } from 'react'
import { Codeblock } from './Codeblock'
import cfm from '@concrnt/cfm'
import { Link } from './Link'
import { Text } from './Text'

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

const RenderAst = ({ ast, emojis }: RenderAstProps): ReactNode => {
    if (Array.isArray(ast)) {
        return (
            <>
                {ast.map((node: any, i: number) => (
                    <RenderAst key={i} ast={node} emojis={emojis} />
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
                    <RenderAst ast={ast.body} emojis={emojis} />
                    <br />
                </>
            )
        case 'Text':
            return ast.body
        case 'Marquee': // TODO: implement marquee
            return <RenderAst ast={ast.body} emojis={emojis} />
        case 'Italic':
            return (
                <i>
                    <RenderAst ast={ast.body} emojis={emojis} />
                </i>
            )
        case 'Bold':
            return (
                <b>
                    <RenderAst ast={ast.body} emojis={emojis} />
                </b>
            )
        case 'Strike':
            return (
                <s>
                    <RenderAst ast={ast.body} emojis={emojis} />
                </s>
            )
        case 'URL':
            return <Link href={ast.body}>{ast.alt || ast.body}</Link>
        case 'Timeline': // TODO: implement TimelineChip
            return <Text>[Timeline: {ast.body}]</Text>
        case 'Spoiler':
            return (
                <Spoiler>
                    <RenderAst ast={ast.body} emojis={emojis} />
                </Spoiler>
            )
        case 'Quote':
            return (
                <blockquote style={{ margin: 0, paddingLeft: '1rem', borderLeft: '4px solid #ccc' }}>
                    <RenderAst ast={ast.body} emojis={emojis} />
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
                    <RenderAst ast={ast.body} emojis={emojis} />
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
                        maxWidth: '100%'
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        // mediaViewer.openSingle(ast.url)
                    }}
                />
            )
        case 'CodeBlock':
            return <Codeblock language={ast.lang}>{ast.body}</Codeblock>
        case 'EmojiPack': // TODO: implement EmojipackCard
            //return <EmojipackCard src={ast.body} icon={<ManageSearchIcon />} onClick={actions.openEmojipack} />
            return <Text>[Emoji Pack: {ast.body}]</Text>
        case 'Heading':
            return (
                <Text variant={`h${ast.level}` as any}>
                    <RenderAst ast={ast.body} emojis={emojis} />
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

    return (
        <div
            style={{
                whiteSpace: 'pre-wrap'
            }}
        >
            <RenderAst ast={ast} emojis={props.emojiDict} />
        </div>
    )
}
