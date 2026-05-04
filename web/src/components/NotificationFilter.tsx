import { Chip, CssVar } from '@concrnt/ui'
import { Schemas } from '@concrnt/worldlib'

interface Props {
    selected?: string
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
                gap: CssVar.space(2),
                padding: CssVar.space(2),
                overflowX: 'auto',
                borderBottom: `1px solid ${CssVar.divider}`,
                scrollbarWidth: 'none'
            }}
        >
            {filters.map((filter) => {
                const isSelected = props.selected === filter.schema

                return (
                    <Chip
                        key={filter.schema}
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={() => {
                            props.setSelected(isSelected ? undefined : filter.schema)
                        }}
                        style={{
                            flexShrink: 0
                        }}
                    >
                        {filter.label}
                    </Chip>
                )
            })}
        </div>
    )
}
