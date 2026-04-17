import { Schemas } from '@concrnt/worldlib'
import { Chip } from '@concrnt/ui'

interface Props {
    // 選択中のスキーマ URI（Schemas.xxxAssociation の値）
    // undefined のとき「フィルタなし（全表示）」
    selected: string | undefined
    setSelected: (value: string | undefined) => void
}

// 通知カテゴリの定義
// - 表示順は画像デザインに合わせて reply -> mention -> reroute -> fav -> reaction
// - schema は @concrnt/worldlib の Schemas と一致させる。フィルタ判定で message.schema と比較するため。
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
                            // 同じチップを再タップしたら解除（全表示に戻す）
                            props.setSelected(isSelected ? undefined : f.schema)
                        }}
                        style={{
                            // チップが shrink して潰れないよう固定
                            flexShrink: 0,
                            // @concrnt/ui の Chip は outlined と contained で padding/border が
                            // 揃っておらず、選択切替時にサイズが変わって見える。
                            // ここで明示的に揃える。
                            // - padding は outlined 側の '0 8px' に統一
                            // - contained 側には 1px 透明 border を付けて、outlined の 1px divider border と幅を一致させる
                            padding: '0 8px',
                            ...(isSelected && {
                                border: '1px solid transparent'
                            })
                        }}
                    >
                        {f.label}
                    </Chip>
                )
            })}
        </div>
    )
}
