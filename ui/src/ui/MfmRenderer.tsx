import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import * as mfm from 'mfm-js'
import { Codeblock } from './Codeblock'
import { Link } from './Link'
import { type EmojiLite } from './CfmRenderer'
import { CCImage } from '../contexts/CCImage'

// mfm-renderer-reactはMUI/emotion/React18に依存しておりこのmonorepoでは使えないため、
// パーサ(mfm-js)だけ借りてレンダラは自前実装している。アニメーション定義はv1の
// mfm-renderer-react 0.0.9と同一。
const MFM_KEYFRAMES = `
@keyframes mfm-tada {
	from { transform: scale3d(1, 1, 1); }
	10%, 20% { transform: scale3d(0.91, 0.91, 0.91) rotate3d(0, 0, 1, -2deg); }
	30%, 70% { transform: scale3d(1.09, 1.09, 1.09) rotate3d(0, 0, 1, 2deg); }
	50%, 90% { transform: scale3d(1.09, 1.09, 1.09) rotate3d(0, 0, 1, -2deg); }
	to { transform: scale3d(1, 1, 1); }
}
@keyframes mfm-jelly {
	from { transform: scale3d(1, 1, 1); }
	30% { transform: scale3d(1.25, 0.75, 1); }
	40% { transform: scale3d(0.75, 1.25, 1); }
	50% { transform: scale3d(1.15, 0.85, 1); }
	65% { transform: scale3d(0.95, 1.05, 1); }
	75% { transform: scale3d(1.05, 0.95, 1); }
	to { transform: scale3d(1, 1, 1); }
}
@keyframes mfm-twitch {
	0% { transform: translate(7px, -2px) }
	5% { transform: translate(-3px, 1px) }
	10% { transform: translate(-7px, -1px) }
	15% { transform: translate(0px, -1px) }
	20% { transform: translate(-8px, 6px) }
	25% { transform: translate(-4px, -3px) }
	30% { transform: translate(-4px, -6px) }
	35% { transform: translate(-8px, -8px) }
	40% { transform: translate(4px, 6px) }
	45% { transform: translate(-3px, 1px) }
	50% { transform: translate(2px, -10px) }
	55% { transform: translate(-7px, 0px) }
	60% { transform: translate(-2px, 4px) }
	65% { transform: translate(3px, -8px) }
	70% { transform: translate(6px, 7px) }
	75% { transform: translate(-7px, -2px) }
	80% { transform: translate(-7px, -8px) }
	85% { transform: translate(9px, 3px) }
	90% { transform: translate(-3px, -2px) }
	95% { transform: translate(-10px, 2px) }
	100% { transform: translate(-2px, -6px) }
}
@keyframes mfm-shake {
	0% { transform: translate(-3px, -1px) rotate(-8deg) }
	5% { transform: translate(0px, -1px) rotate(-10deg) }
	10% { transform: translate(1px, -3px) rotate(0deg) }
	15% { transform: translate(1px, 1px) rotate(11deg) }
	20% { transform: translate(-2px, 1px) rotate(1deg) }
	25% { transform: translate(-1px, -2px) rotate(-2deg) }
	30% { transform: translate(-1px, 2px) rotate(-3deg) }
	35% { transform: translate(2px, 1px) rotate(6deg) }
	40% { transform: translate(-2px, -3px) rotate(-9deg) }
	45% { transform: translate(0px, -1px) rotate(-12deg) }
	50% { transform: translate(1px, 2px) rotate(10deg) }
	55% { transform: translate(0px, -3px) rotate(8deg) }
	60% { transform: translate(1px, -1px) rotate(8deg) }
	65% { transform: translate(0px, -1px) rotate(-7deg) }
	70% { transform: translate(-1px, -3px) rotate(6deg) }
	75% { transform: translate(0px, -2px) rotate(4deg) }
	80% { transform: translate(-2px, -1px) rotate(3deg) }
	85% { transform: translate(1px, -3px) rotate(-10deg) }
	90% { transform: translate(1px, 0px) rotate(3deg) }
	95% { transform: translate(-2px, 0px) rotate(-3deg) }
	100% { transform: translate(2px, 1px) rotate(2deg) }
}
@keyframes mfm-spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}
@keyframes mfm-spin-x {
	0% { transform: perspective(128px) rotateX(0deg); }
	100% { transform: perspective(128px) rotateX(360deg); }
}
@keyframes mfm-spin-y {
	0% { transform: perspective(128px) rotateY(0deg); }
	100% { transform: perspective(128px) rotateY(360deg); }
}
@keyframes mfm-jump {
	0% { transform: translateY(0); }
	25% { transform: translateY(-16px); }
	50% { transform: translateY(0); }
	75% { transform: translateY(-8px); }
	100% { transform: translateY(0); }
}
@keyframes mfm-bounce {
	0% { transform: translateY(0) scale(1, 1); }
	25% { transform: translateY(-16px) scale(1, 1); }
	50% { transform: translateY(0) scale(1, 1); }
	75% { transform: translateY(0) scale(1.5, 0.75); }
	100% { transform: translateY(0) scale(1, 1); }
}
@keyframes mfm-rainbow {
	0% { filter: hue-rotate(0deg) contrast(150%) saturate(150%); }
	100% { filter: hue-rotate(360deg) contrast(150%) saturate(150%); }
}
@keyframes mfm-sparkle {
	0% { rotate: 0deg; scale: 0; }
	50% { scale: var(--size); }
	100% { rotate: 360deg; scale: 0; }
}
`

let mfmStylesInjected = false
const ensureMfmStyles = (): void => {
    if (mfmStylesInjected || typeof document === 'undefined') return
    const style = document.createElement('style')
    style.textContent = MFM_KEYFRAMES
    document.head.appendChild(style)
    mfmStylesInjected = true
}

const normalizeColor = (color: string): string => {
    if (color[0] === '#') return color
    return color.replace(/([0-9a-f]{3,6})/g, '#$1')
}

const Blur = ({ children }: { children: ReactNode }): ReactNode => {
    const [hover, setHover] = useState(false)
    return (
        <span
            style={{
                display: 'inline-block',
                filter: hover ? 'blur(0px)' : 'blur(6px)',
                transition: 'filter 0.3s'
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            {children}
        </span>
    )
}

interface SparkleStar {
    id: string
    x: number
    y: number
    size: number
    dur: number
    color: string
}

const sparkleColors = ['#FF1493', '#00FFFF', '#FFE202', '#FFE202', '#FFE202']
const sparklePath =
    'M29.427,2.011C29.721,0.83 30.782,0 32,0C33.218,0 34.279,0.83 34.573,2.011L39.455,21.646C39.629,22.347 39.991,22.987 40.502,23.498C41.013,24.009 41.653,24.371 42.354,24.545L61.989,29.427C63.17,29.721 64,30.782 64,32C64,33.218 63.17,34.279 61.989,34.573L42.354,39.455C41.653,39.629 41.013,39.991 40.502,40.502C39.991,41.013 39.629,41.653 39.455,42.354L34.573,61.989C34.279,63.17 33.218,64 32,64C30.782,64 29.721,63.17 29.427,61.989L24.545,42.354C24.371,41.653 24.009,41.013 23.498,40.502C22.987,39.991 22.347,39.629 21.646,39.455L2.011,34.573C0.83,34.279 0,33.218 0,32C0,30.782 0.83,29.721 2.011,29.427L21.646,24.545C22.347,24.371 22.987,24.009 23.498,23.498C24.009,22.987 24.371,22.347 24.545,21.646L29.427,2.011Z'

const Sparkle = ({ children }: { children: ReactNode }): ReactNode => {
    const ref = useRef<HTMLSpanElement>(null)
    const [stars, setStars] = useState<SparkleStar[]>([])
    const [width, setWidth] = useState(0)
    const [height, setHeight] = useState(0)

    useEffect(() => {
        let cancelled = false
        const observer = new ResizeObserver(() => {
            if (ref.current) {
                setWidth(ref.current.offsetWidth + 64)
                setHeight(ref.current.offsetHeight + 64)
            }
        })
        if (ref.current) observer.observe(ref.current)

        const spawn = (): void => {
            if (cancelled) return
            const rand = Math.random()
            const star: SparkleStar = {
                id: Math.random().toString(),
                x: Math.random() * (width - 64),
                y: Math.random() * (height - 64),
                size: 0.2 + (rand / 10) * 3,
                dur: 1000 + rand * 1000,
                color: sparkleColors[Math.floor(Math.random() * sparkleColors.length)]
            }
            setStars((prev) => [...prev, star])
            window.setTimeout(() => {
                setStars((prev) => prev.filter((s) => s.id !== star.id))
            }, star.dur - 100)
            window.setTimeout(
                () => {
                    spawn()
                },
                500 + Math.random() * 500
            )
        }
        spawn()

        return () => {
            observer.disconnect()
            cancelled = true
        }
    }, [width, height])

    return (
        <span style={{ position: 'relative', display: 'inline-block' }}>
            <span ref={ref} style={{ display: 'inline-block' }}>
                {children}
            </span>
            {stars.map((star) => (
                <svg
                    key={star.id}
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                        position: 'absolute',
                        top: '-32px',
                        left: '-32px',
                        pointerEvents: 'none'
                    }}
                >
                    <path
                        style={
                            {
                                transformOrigin: 'center',
                                transformBox: 'fill-box',
                                translate: `${star.x}px ${star.y}px`,
                                animation: `mfm-sparkle ${star.dur}ms linear infinite`,
                                '--size': star.size
                            } as CSSProperties
                        }
                        fill={star.color}
                        d={sparklePath}
                    />
                </svg>
            ))}
        </span>
    )
}

const Search = ({ query }: { query: string }): ReactNode => {
    return (
        <span style={{ display: 'flex', margin: '8px 0' }}>
            <span
                style={{
                    flexShrink: 1,
                    padding: '10px',
                    width: '100%',
                    height: '40px',
                    fontSize: '16px',
                    border: 'solid 1px #ddd',
                    borderRadius: '4px 0 0 4px',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis'
                }}
            >
                {query}
            </span>
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    const params = new URLSearchParams()
                    params.append('q', query)
                    window.open(`https://www.google.com/search?${params.toString()}`, '_blank', 'noopener')
                }}
                style={{
                    flexShrink: 0,
                    margin: 0,
                    padding: '0 16px',
                    border: 'solid 1px #ddd',
                    borderLeft: 'none',
                    borderRadius: '0 4px 4px 0',
                    background: 'none',
                    color: 'inherit',
                    cursor: 'pointer'
                }}
            >
                検索
            </button>
        </span>
    )
}

const AnimatedFn = ({
    animation,
    speed,
    delay,
    style,
    children
}: {
    animation: string
    speed: string
    delay: string
    style?: CSSProperties
    children: ReactNode
}): ReactNode => {
    return (
        <span
            style={{
                display: 'inline-block',
                animation: `${animation} ${speed}`,
                animationDelay: delay,
                ...style
            }}
        >
            {children}
        </span>
    )
}

interface RenderMfmProps {
    ast: any
    emojis: Record<string, EmojiLite>
}

const RenderMfm = ({ ast, emojis }: RenderMfmProps): ReactNode => {
    if (Array.isArray(ast)) {
        return (
            <>
                {ast.map((node: any, i: number) => (
                    <RenderMfm key={i} ast={node} emojis={emojis} />
                ))}
            </>
        )
    }

    if (!ast) return <>null</>
    switch (ast.type) {
        case 'text':
            return ast.props.text
        case 'bold':
            return (
                <b>
                    <RenderMfm ast={ast.children} emojis={emojis} />
                </b>
            )
        case 'italic':
            return (
                <i>
                    <RenderMfm ast={ast.children} emojis={emojis} />
                </i>
            )
        case 'strike':
            return (
                <s>
                    <RenderMfm ast={ast.children} emojis={emojis} />
                </s>
            )
        case 'small':
            return (
                <span style={{ fontSize: '80%', opacity: 0.7 }}>
                    <RenderMfm ast={ast.children} emojis={emojis} />
                </span>
            )
        case 'center':
            return (
                <div style={{ textAlign: 'center' }}>
                    <RenderMfm ast={ast.children} emojis={emojis} />
                </div>
            )
        case 'fn': {
            const args = ast.props.args ?? {}
            switch (ast.props.name) {
                case 'tada':
                    return (
                        <AnimatedFn
                            animation="mfm-tada"
                            speed={`${args.speed ?? '1s'} linear infinite both`}
                            delay={args.delay ?? '0s'}
                            style={{ fontSize: '150%' }}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </AnimatedFn>
                    )
                case 'jelly':
                    return (
                        <AnimatedFn
                            animation="mfm-jelly"
                            speed={`${args.speed ?? '1s'} linear infinite both`}
                            delay={args.delay ?? '0s'}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </AnimatedFn>
                    )
                case 'twitch':
                    return (
                        <AnimatedFn
                            animation="mfm-twitch"
                            speed={`${args.speed ?? '1s'} linear infinite`}
                            delay={args.delay ?? '0s'}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </AnimatedFn>
                    )
                case 'shake':
                    return (
                        <AnimatedFn
                            animation="mfm-shake"
                            speed={`${args.speed ?? '1s'} ease infinite`}
                            delay={args.delay ?? '0s'}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </AnimatedFn>
                    )
                case 'spin': {
                    const direction = args.left ? 'reverse' : args.alternate ? 'alternate' : 'normal'
                    const animation = args.x ? 'mfm-spin-x' : args.y ? 'mfm-spin-y' : 'mfm-spin'
                    return (
                        <AnimatedFn
                            animation={animation}
                            speed={`${args.speed ?? '1.5s'} linear infinite`}
                            delay={args.delay ?? '0s'}
                            style={{ animationDirection: direction }}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </AnimatedFn>
                    )
                }
                case 'jump':
                    return (
                        <AnimatedFn
                            animation="mfm-jump"
                            speed={`${args.speed ?? '1s'} linear infinite`}
                            delay={args.delay ?? '0s'}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </AnimatedFn>
                    )
                case 'bounce':
                    return (
                        <AnimatedFn
                            animation="mfm-bounce"
                            speed={`${args.speed ?? '1s'} linear infinite`}
                            delay={args.delay ?? '0s'}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </AnimatedFn>
                    )
                case 'rainbow':
                    return (
                        <AnimatedFn
                            animation="mfm-rainbow"
                            speed={`${args.speed ?? '1s'} linear infinite`}
                            delay={args.delay ?? '0s'}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </AnimatedFn>
                    )
                case 'sparkle':
                    return (
                        <Sparkle>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </Sparkle>
                    )
                case 'flip': {
                    const transform = args.h && args.v ? 'scale(-1, -1)' : args.v ? 'scaleY(-1)' : 'scaleX(-1)'
                    return (
                        <span style={{ display: 'inline-block', transform }}>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                }
                case 'x2':
                    return (
                        <span style={{ fontSize: '200%' }}>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                case 'x3':
                    return (
                        <span style={{ fontSize: '400%' }}>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                case 'x4':
                    return (
                        <span style={{ fontSize: '600%' }}>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                case 'font': {
                    const family = args.serif
                        ? 'serif'
                        : args.monospace
                          ? 'monospace'
                          : args.cursive
                            ? 'cursive'
                            : args.fantasy
                              ? 'fantasy'
                              : args.emoji
                                ? 'emoji'
                                : args.math
                                  ? 'math'
                                  : undefined
                    return (
                        <span style={{ display: 'inline-block', fontFamily: family }}>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                }
                case 'blur':
                    return (
                        <Blur>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </Blur>
                    )
                case 'rotate': {
                    const deg = args.deg ?? 90
                    return (
                        <span
                            style={{
                                display: 'inline-block',
                                transform: `rotate(${deg}deg)`,
                                transformOrigin: 'center center'
                            }}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                }
                case 'position':
                    return (
                        <span
                            style={{
                                display: 'inline-block',
                                transform: `translateX(${args.x ?? 0}em) translateY(${args.y ?? 0}em)`
                            }}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                case 'scale': {
                    const x = Math.min(args.x ?? 1, 5)
                    const y = Math.min(args.y ?? 1, 5)
                    return (
                        <span style={{ display: 'inline-block', transform: `scale(${x}, ${y})` }}>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                }
                case 'fg':
                    return (
                        <span style={{ display: 'inline-block', color: normalizeColor(args.color ?? 'f00') }}>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                case 'bg':
                    return (
                        <span style={{ display: 'inline-block', backgroundColor: normalizeColor(args.color ?? 'f00') }}>
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                case 'border': {
                    const color = normalizeColor(args.color ?? 'ddd')
                    return (
                        <span
                            style={{
                                display: 'inline-block',
                                border: `${args.width ?? 1}px ${args.style ?? 'solid'} ${color}`,
                                borderRadius: `${args.radius ?? 0}px`,
                                padding: '0.5em',
                                overflow: args.noclip ? 'unset' : 'clip'
                            }}
                        >
                            <RenderMfm ast={ast.children} emojis={emojis} />
                        </span>
                    )
                }
                case 'ruby': {
                    if (ast.children.length === 1) {
                        const child = ast.children[0]
                        const text = child.type === 'text' ? child.props.text : ''
                        return (
                            <ruby>
                                {text.split(' ')[0]}
                                <rt>{text.split(' ')[1]}</rt>
                            </ruby>
                        )
                    }
                    const last = ast.children.at(-1)
                    const rt = last?.type === 'text' ? last.props.text : ''
                    return (
                        <ruby>
                            <RenderMfm ast={ast.children.slice(0, ast.children.length - 1)} emojis={emojis} />
                            <rt>{rt.trim()}</rt>
                        </ruby>
                    )
                }
            }
            return <>unknown fn: {ast.props.name}</>
        }
        case 'url':
            return <Link href={ast.props.url}>{ast.props.url}</Link>
        case 'link':
            return (
                <Link href={ast.props.url}>
                    <RenderMfm ast={ast.children} emojis={emojis} />
                </Link>
            )
        case 'mention':
            return <span>{ast.props.acct}</span>
        case 'hashtag':
            return <span>#{ast.props.hashtag}</span>
        case 'blockCode':
            return <Codeblock language={ast.props.lang ?? ''}>{ast.props.code}</Codeblock>
        case 'inlineCode':
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
                    {ast.props.code}
                </span>
            )
        case 'mathInline':
            return (
                <span
                    style={{
                        fontFamily: 'Source Code Pro, monospace'
                    }}
                >
                    {ast.props.formula}
                </span>
            )
        case 'mathBlock':
            return <Codeblock language="">{ast.props.formula}</Codeblock>
        case 'quote':
            return (
                <blockquote style={{ margin: 0, paddingLeft: '1rem', borderLeft: '4px solid #ccc' }}>
                    <RenderMfm ast={ast.children} emojis={emojis} />
                </blockquote>
            )
        case 'emojiCode': {
            const emoji = emojis[ast.props.name]
            return emoji ? (
                <CCImage
                    src={emoji.animURL ?? emoji.imageURL}
                    alt={ast.props.name}
                    maxHeight={128}
                    style={{
                        height: '2em',
                        verticalAlign: 'middle'
                    }}
                />
            ) : (
                <span>:{ast.props.name}:</span>
            )
        }
        case 'unicodeEmoji':
            return <span>{ast.props.emoji}</span>
        case 'search':
            return <Search query={ast.props.query} />
        case 'plain':
            return (
                <span>
                    <RenderMfm ast={ast.children} emojis={emojis} />
                </span>
            )
        default:
            return <>unknown ast type: {ast.type}</>
    }
}

export interface MfmRendererProps {
    messagebody: string
    emojiDict: Record<string, EmojiLite>
}

export const MfmRenderer = (props: MfmRendererProps): ReactNode => {
    ensureMfmStyles()

    const ast = useMemo(() => {
        if (props.messagebody === '') {
            return []
        }
        try {
            return mfm.parse(props.messagebody)
        } catch (e) {
            console.error(e)
            return [
                {
                    type: 'text',
                    props: { text: props.messagebody }
                },
                {
                    type: 'text',
                    props: { text: 'error: ' + JSON.stringify(e) }
                }
            ]
        }
    }, [props.messagebody])

    return (
        <div
            style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            }}
        >
            <RenderMfm ast={ast} emojis={props.emojiDict} />
        </div>
    )
}
