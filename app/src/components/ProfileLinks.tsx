import { useTranslation } from 'react-i18next'
import { MdArrowOutward } from 'react-icons/md'
import { ProfileLinksSchema, safeHttpUrl } from '@concrnt/worldlib'
import { CssVar } from '../types/Theme'
import { ExternalLink } from './ExternalLink'
import { LinkIcon, linkLabel } from './LinkIcon'

interface Props {
    links: ProfileLinksSchema['links']
    // リンク集の単独ページ(/<id>/links)の URL。渡したときだけチップの最後にリンクを出す
    pageURL?: string
}

export const ProfileLinks = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.profileLinks' })
    // 他人の文書は外部入力で、形が違う要素を描画するとページごと落ちるので、http(s) の URL だけ出す
    const links = props.links.filter((link) => safeHttpUrl(link?.url))
    if (links.length === 0 && !props.pageURL) return null
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: CssVar.space(1) }}>
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
            {props.pageURL && (
                <ExternalLink
                    href={props.pageURL}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: CssVar.contentText,
                        opacity: 0.7,
                        fontSize: '0.75rem',
                        textDecoration: 'none',
                        padding: `0 ${CssVar.space(1)}`
                    }}
                >
                    {t('page')}
                    <MdArrowOutward size={12} />
                </ExternalLink>
            )}
        </div>
    )
}
