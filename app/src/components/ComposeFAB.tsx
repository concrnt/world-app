import { MdCreate } from 'react-icons/md'
import { FAB } from '../ui/FAB'
import { useComposer } from '../contexts/Composer'
import { usePostContext } from '../contexts/PostContext'
import { useHaptics } from '../contexts/Haptics'

// 現在のビューのデフォルト投稿先(PostContext)でComposerを開くFAB
export const ComposeFAB = () => {
    const composer = useComposer()
    const postCtx = usePostContext()
    const { hapticLight } = useHaptics()

    return (
        <FAB
            onClick={() => {
                hapticLight()
                composer.open(postCtx.destinations, undefined, undefined, undefined, postCtx.profile)
            }}
        >
            <MdCreate size={24} />
        </FAB>
    )
}
