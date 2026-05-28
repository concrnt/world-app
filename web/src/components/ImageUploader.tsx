import { useState } from 'react'
import { RiImageAddFill } from 'react-icons/ri'
import { useClient } from '../contexts/Client'
import { uploadImage } from '../utils/uploadImage'

interface Props {
    src: string
    onChange: (src: string) => void
    style?: React.CSSProperties
}

export const ImageUploader = (props: Props) => {
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
            <RiImageAddFill size={24} color="#888" />
            {props.src && <img src={props.src} alt="image" />}
            <input
                hidden
                ref={setInputRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                    const [url, _] = await uploadImage(client, e.target.files![0])
                    props.onChange(url)
                }}
            />
        </div>
    )
}
