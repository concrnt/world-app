import { Schemas } from '@concrnt/worldlib'
import { Chip } from '@concrnt/ui'
import { useTranslation } from 'react-i18next'

interface Props {
    selected: string | undefined
    setSelected: (value: string | undefined) => void
}

const filters: { labelKey: string; schema: string }[] = [
    { labelKey: 'reply', schema: Schemas.replyAssociation },
    { labelKey: 'mention', schema: Schemas.mentionAssociation },
    { labelKey: 'reroute', schema: Schemas.rerouteAssociation },
    { labelKey: 'fav', schema: Schemas.likeAssociation },
    { labelKey: 'reaction', schema: Schemas.reactionAssociation },
    { labelKey: 'readRequest', schema: Schemas.readAccessRequestAssociation }
]

export const NotificationFilter = (props: Props) => {
    const { t } = useTranslation('', { keyPrefix: 'components.notificationFilter' })
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '8px',
                paddingTop: '8px',
                paddingBottom: '8px',
                paddingLeft: '8px',
                paddingRight: '8px',
                // 画面幅が狭いときにチップが途切れないよう横スクロール対応
                overflowX: 'auto',
                // スクロールバーは隠してチップ本体だけ見せる（Firefox）
                scrollbarWidth: 'none',
                // 各チップが flex 縮小で潰れないよう shrink させない
                whiteSpace: 'nowrap'
            }}
        >
            {filters.map((f) => {
                const isSelected = props.selected === f.schema
                return (
                    <Chip
                        key={f.schema}
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={() => {
                            props.setSelected(isSelected ? undefined : f.schema)
                        }}
                    >
                        {t(f.labelKey)}
                    </Chip>
                )
            })}
        </div>
    )
}
