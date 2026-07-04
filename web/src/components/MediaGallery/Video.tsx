import { Media } from './main'

export const GalleryVideo = ({ media }: { media: Media }) => {
    return (
        <video
            src={media.mediaURL}
            controls
            style={{
                width: '100%',
                maxHeight: '300px'
            }}
        />
    )
}
