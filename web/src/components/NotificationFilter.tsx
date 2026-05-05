import { Schemas } from '@concrnt/worldlib'
import { Chip } from '@concrnt/ui'

interface Props {
    selected: string | undefined
    setSelected: (value: string | undefined) => void
}

const filters: { label: string; schema: string }[] = [
    { label: 'リプライ', schema: Schemas.replyAssociation },
    { label: 'メンション', schema: Schemas.mentionAssociation },
    { label: 'リルート', schema: Schemas.rerouteAssociation },
    { label: 'お気に入り', schema: Schemas.likeAssociation },
    { label: 'リアクション', schema: Schemas.reactionAssociation }
]

export const NotificationFilter = (props: Props) => {
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
                        {f.label}
                    </Chip>
                )
            })}
        </div>
    )
}
