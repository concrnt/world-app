import { Media } from './main'
import { CCImage } from '@concrnt/ui'

export const GalleryImage = ({ media, objectFit }: { media: Media; objectFit?: 'contain' | 'cover' }) => {
    return (
        <CCImage
            src={media.mediaURL}
            maxWidth={512}
            alt={media.altText ?? ''}
            style={{
                width: '100%',
                height: '100%',
                objectFit: objectFit ?? 'contain'
            }}
        />
    )
}
