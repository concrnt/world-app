import { Button, CssVar } from '@concrnt/ui'
import { useState } from 'react'
import { Schemas, semantics } from '@concrnt/worldlib'
import { useClient } from '../contexts/Client'

interface Props {
    additionalDestinations?: string[]
    onPosted?: () => void
}

export const Composer = (props: Props) => {
    const { client } = useClient()
    const [draft, setDraft] = useState('')
    const [processing, setProcessing] = useState(false)

    const handleSubmit = async () => {
        if (!client || !draft.trim()) return

        setProcessing(true)

        try {
            const homeTimeline = semantics.homeTimeline(client.ccid, client.currentProfile)
            const key = Date.now().toString()
            const distributes = [...new Set([homeTimeline, ...(props.additionalDestinations ?? [])])]

            const document = {
                key: semantics.post(client.ccid, 'main', key),
                schema: Schemas.markdownMessage,
                value: {
                    body: draft
                },
                author: client.ccid,
                distributes,
                createdAt: new Date()
            }

            await client.api.commit(document)
            setDraft('')
            props.onPosted?.()
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: CssVar.space(2),
                padding: CssVar.space(3),
                borderBottom: `1px solid ${CssVar.divider}`
            }}
        >
            <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="いま何を共有しますか？"
                style={{
                    width: '100%',
                    minHeight: 96,
                    padding: CssVar.space(3),
                    borderRadius: CssVar.round(1),
                    border: `1px solid ${CssVar.divider}`,
                    color: CssVar.contentText,
                    backgroundColor: CssVar.contentBackground,
                    resize: 'vertical',
                    boxSizing: 'border-box'
                }}
            />
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}
            >
                <Button
                    disabled={processing || !draft.trim()}
                    onClick={() => {
                        void handleSubmit()
                    }}
                >
                    {processing ? '投稿中...' : '投稿する'}
                </Button>
            </div>
        </div>
    )
}
