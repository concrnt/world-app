import { useMediaViewer } from '../../contexts/MediaViewer'
import { Media } from './main'
import { MdViewInAr } from 'react-icons/md'

export const GalleryModel = ({ media }: { media: Media }) => {
    const mediaViewer = useMediaViewer()

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.15)',
                cursor: 'pointer',
                gap: '8px'
            }}
            onClick={(e) => {
                e.stopPropagation()
                mediaViewer.openModel(media.mediaURL)
            }}
        >
            <MdViewInAr size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>3D Model</span>
        </div>
    )
}
