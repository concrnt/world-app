import { Media } from './main'

export const GalleryImage = ({ media }: { media: Media }) => {
    return (
        <img
            src={media.mediaURL}
            alt={media.altText ?? ''}
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
            }}
        />
    )
}
