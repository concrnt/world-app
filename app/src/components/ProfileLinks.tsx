import { ProfileLinksSchema, safeHttpUrl } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { ExternalLink } from './ExternalLink'
import { LinkIcon, linkLabel } from './LinkIcon'

interface Props {
    links: ProfileLinksSchema['links']
}

export const ProfileLinks = (props: Props) => {
    // 他人の文書は外部入力で、形が違う要素を描画するとページごと落ちるので、http(s) の URL だけ出す
    const links = props.links.filter((link) => safeHttpUrl(link?.url))
    if (links.length === 0) return null
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: CssVar.space(1) }}>
            {links.map(({ url }, i) => (
                <ExternalLink
                    key={i}
                    href={url}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: CssVar.space(1),
                        maxWidth: '100%',
                        padding: `${CssVar.space(0.5)} ${CssVar.space(2)}`,
                        border: `1px solid ${CssVar.divider}`,
                        borderRadius: '999px',
                        color: CssVar.contentText,
                        textDecoration: 'none',
                        fontSize: '0.875rem'
                    }}
                >
                    <LinkIcon url={url} size={16} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {linkLabel(url)}
                    </span>
                </ExternalLink>
            ))}
        </div>
    )
}
