import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, CssVar, Text } from '@concrnt/ui'

interface Props {
    ccid: string
    src?: string
    label?: string
    onFileSelect: (file: File) => void
}

export const AvatarUploader = (props: Props) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined)

    useEffect(() => {
        setPreviewUrl(undefined)
    }, [props.src])

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl)
            }
        }
    }, [previewUrl])

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: CssVar.space(2)
            }}
        >
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                style={{
                    padding: 0,
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer'
                }}
            >
                <Avatar
                    ccid={props.ccid}
                    src={previewUrl ?? props.src}
                    style={{
                        width: '96px',
                        height: '96px'
                    }}
                />
            </button>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: CssVar.space(2),
                    flexWrap: 'wrap'
                }}
            >
                <Button variant="outlined" onClick={() => inputRef.current?.click()}>
                    画像を選択
                </Button>
                <Text variant="caption" style={{ opacity: 0.72 }}>
                    {props.label ?? 'Avatar'}
                </Text>
            </div>
            <input
                ref={inputRef}
                hidden
                type="file"
                accept="image/*"
                onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return

                    if (previewUrl) {
                        URL.revokeObjectURL(previewUrl)
                    }

                    const nextPreviewUrl = URL.createObjectURL(file)
                    setPreviewUrl(nextPreviewUrl)
                    props.onFileSelect(file)
                    event.target.value = ''
                }}
            />
        </div>
    )
}
