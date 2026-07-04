import { Media } from './main'
import { useAudioPlayer } from '../../contexts/AudioPlayer'
import { MdPlayCircle, MdStop } from 'react-icons/md'

export const GalleryAudio = ({ media }: { media: Media }) => {
    const audioPlayer = useAudioPlayer()

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.15)',
                cursor: 'pointer'
            }}
            onClick={(e) => {
                e.stopPropagation()
                if (audioPlayer.nowPlaying === media.mediaURL) {
                    audioPlayer.stop()
                } else {
                    audioPlayer.play(media.mediaURL)
                }
            }}
        >
            {audioPlayer.nowPlaying === media.mediaURL ? (
                <MdStop size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            ) : (
                <MdPlayCircle size={48} style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            )}
        </div>
    )
}
