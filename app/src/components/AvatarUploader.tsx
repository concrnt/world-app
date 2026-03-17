import { useState } from 'react'
import { RiImageAddFill } from 'react-icons/ri'
import { useClient } from '../contexts/Client'

interface Props {
    src: string
    onChange: (src: string) => void
    style?: React.CSSProperties
}

export const AvatarUploader = (props: Props) => {
    const { client } = useClient()
    const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null)

    return (
        <div
            style={{
                width: '100px',
                height: '100px',
                borderRadius: '10px',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#f0f0f0',
                ...props.style
            }}
            onClick={() => inputRef?.click()}
        >
            <RiImageAddFill size={24} color="#888" style={{ position: 'absolute' }} />
            {props.src && <img src={props.src} alt="Avatar" />}
            <input
                hidden
                ref={setInputRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                        interface PreSignResponse {
                            content: {
                                url: string
                                file: {
                                    url: string
                                }
                            }
                        }

                        const preSignReq = await client?.api.callConcrntApi<PreSignResponse>(
                            client.api.defaultHost,
                            'net.concrnt.storage.presign',
                            {},
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    contentType: file.type,
                                    size: file.size,
                                    sha256: await file.arrayBuffer().then(async (buffer) => {
                                        const hashBuffer = crypto.subtle.digest('SHA-256', buffer)
                                        const hash = await hashBuffer
                                        const hashArray = Array.from(new Uint8Array(hash))
                                        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
                                        return hashHex
                                    })
                                })
                            }
                        )
                        if (!preSignReq) {
                            console.error('Failed to get pre-signed URL')
                            return
                        }

                        fetch(preSignReq.content.url, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': file.type
                            },
                            body: file
                        })
                            .then(() => {
                                console.log('File uploaded successfully')
                                props.onChange(preSignReq.content.file.url)
                            })
                            .catch((error) => {
                                console.error('Error uploading file:', error)
                            })
                    }
                }}
            />
        </div>
    )
}
