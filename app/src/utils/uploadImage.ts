import { Client } from '@concrnt/worldlib'

interface PreSignResponse {
    content: {
        url: string
        file: {
            url: string
        }
    }
}

export const uploadImage = async (client: Client, file: File): Promise<string> => {
    let fileType = file.type
    if (!fileType) {
        const ext = file.name.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'glb':
                fileType = 'model/gltf-binary'
                break
            default:
                fileType = 'application/octet-stream'
                break
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
                contentType: fileType,
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
        throw new Error('Failed to get pre-signed URL')
    }

    await fetch(preSignReq.content.url, {
        method: 'PUT',
        headers: {
            'Content-Type': fileType
        },
        body: file
    })

    return preSignReq.content.file.url
}
