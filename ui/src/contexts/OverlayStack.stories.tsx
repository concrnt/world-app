import type { Meta, StoryObj } from '@storybook/react-vite'
import { OverlayStackProvider, useOverlayStack } from './OverlayStack'
import { useSelect } from './Select'
import { useConfirm } from './Confirm'
import { useModal } from './Modal'
import { Button } from '../ui/Button'
import { ListItem } from '../ui/ListItem'
import { Text } from '../ui/Text'
import { BottomSheet } from '../ui/BottomSheet'
import { SideSheet } from '../ui/SideSheet'

const Demo = () => {
    const { select } = useSelect()
    const confirm = useConfirm()
    const modal = useModal()
    const stack = useOverlayStack()

    const openMenu = () => {
        select('メニュー', [
            <ListItem
                key="confirm"
                onClick={() => {
                    confirm.open('本当に実行しますか？', () => {}, { confirmText: '実行' })
                }}
            >
                <Text>確認ダイアログを開く</Text>
            </ListItem>,
            <ListItem
                key="modal"
                onClick={() => {
                    modal.open(<Text>モーダルの内容</Text>)
                }}
            >
                <Text>モーダルを開く</Text>
            </ListItem>,
            <ListItem
                key="bottomsheet"
                onClick={() => {
                    stack.push({
                        kind: 'drawer',
                        render: (close) => (
                            <BottomSheet height={window.innerHeight * 0.9} onDismiss={close}>
                                <Text>ボトムシートの内容</Text>
                            </BottomSheet>
                        )
                    })
                }}
            >
                <Text>ボトムシートを開く</Text>
            </ListItem>,
            <ListItem
                key="sidesheet"
                onClick={() => {
                    stack.push({
                        kind: 'drawer',
                        render: (close) => (
                            <SideSheet onDismiss={close}>
                                <Text>サイドシートの内容</Text>
                            </SideSheet>
                        )
                    })
                }}
            >
                <Text>サイドシートを開く</Text>
            </ListItem>
        ])
    }

    return (
        <div style={{ padding: '16px' }}>
            <Button onClick={openMenu}>メニューを開く</Button>
        </div>
    )
}

const meta = {
    title: 'contexts/OverlayStack',
    component: OverlayStackProvider,
    parameters: {
        layout: 'fullscreen'
    }
} satisfies Meta<typeof OverlayStackProvider>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {
    render: () => (
        <OverlayStackProvider>
            <Demo />
        </OverlayStackProvider>
    )
}
