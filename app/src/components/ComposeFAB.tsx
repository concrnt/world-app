import { MdCreate } from 'react-icons/md'
import { FAB } from '../ui/FAB'
import { useComposer } from '../contexts/Composer'
import { usePostContext } from '../contexts/PostContext'
import { useHaptics } from '../contexts/Haptics'
import { useClient } from '../contexts/Client'
import { useStack } from '../layouts/Stack'
import { GuestNoticeView } from '../contexts/GuestNotice'

// 現在のビューのデフォルト投稿先(PostContext)でComposerを開くFAB
export const ComposeFAB = () => {
    const composer = useComposer()
    const postCtx = usePostContext()
    const { hapticLight } = useHaptics()
    const { client } = useClient()
    const stack = useStack()

    return (
        <FAB
            onClick={() => {
                hapticLight()
                // ゲストは投稿できないので、投稿画面の代わりに案内のビューを出す
                if (client.isGuest) {
                    stack.push(<GuestNoticeView />)
                    return
                }
                composer.open(postCtx.destinations, undefined, undefined, postCtx.profile)
            }}
        >
            <MdCreate size={24} />
        </FAB>
    )
}
