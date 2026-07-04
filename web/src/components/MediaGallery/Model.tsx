import { MdViewInAr } from 'react-icons/md'

export const GalleryModel = () => {
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
        >
            <MdViewInAr size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>3D Model</span>
        </div>
    )
}
