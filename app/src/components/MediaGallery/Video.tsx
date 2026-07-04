import { Media } from './main'
import { MdPlayCircle } from 'react-icons/md'

export const GalleryVideo = ({ media }: { media: Media }) => {
    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                cursor: 'pointer'
            }}
        >
            <video
                src={media.mediaURL}
                muted
                playsInline
                preload="metadata"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none'
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                }}
            >
                <MdPlayCircle size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            </div>
        </div>
    )
}
