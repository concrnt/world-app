import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { OverlayStackProvider, OverlaySurface, useOverlayStack } from './OverlayStack'
import { Select } from '../ui/Select'
import { Confirm } from '../ui/Confirm'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ListItem } from '../ui/ListItem'
import { Text } from '../ui/Text'
import { BottomSheet } from '../ui/BottomSheet'
import { SideSheet } from '../ui/SideSheet'

// selectを開いたまま上に重ねる入れ子構成。open順=重なり順(LIFO)とexitアニメーションを目視確認する
const Demo = () => {
    const stack = useOverlayStack()
    const [menuOpen, setMenuOpen] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [bottomSheetOpen, setBottomSheetOpen] = useState(false)
    const [sideSheetOpen, setSideSheetOpen] = useState(false)

    return (
        <div style={{ padding: '16px', display: 'flex', gap: '8px' }}>
            <Button onClick={() => setMenuOpen(true)}>メニューを開く</Button>
            <Button onClick={() => stack.closeTop()}>closeTop(バック相当)</Button>
            <Select
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                title="メニュー"
                options={[
                    <ListItem key="confirm" onClick={() => setConfirmOpen(true)}>
                        <Text>確認ダイアログを開く</Text>
                    </ListItem>,
                    <ListItem key="modal" onClick={() => setModalOpen(true)}>
                        <Text>モーダルを開く</Text>
                    </ListItem>,
                    <ListItem key="bottomsheet" onClick={() => setBottomSheetOpen(true)}>
                        <Text>ボトムシートを開く</Text>
                    </ListItem>,
                    <ListItem key="sidesheet" onClick={() => setSideSheetOpen(true)}>
                        <Text>サイドシートを開く</Text>
                    </ListItem>
                ]}
            />
            <Confirm
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                title="本当に実行しますか？"
                confirmText="実行"
                onConfirm={() => {}}
            />
            <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
                <Text>モーダルの内容</Text>
            </Modal>
            <OverlaySurface open={bottomSheetOpen} onClose={() => setBottomSheetOpen(false)}>
                <BottomSheet height={window.innerHeight * 0.9} onDismiss={() => setBottomSheetOpen(false)}>
                    <Text>ボトムシートの内容</Text>
                </BottomSheet>
            </OverlaySurface>
            <OverlaySurface open={sideSheetOpen} onClose={() => setSideSheetOpen(false)}>
                <SideSheet onDismiss={() => setSideSheetOpen(false)}>
                    <Text>サイドシートの内容</Text>
                </SideSheet>
            </OverlaySurface>
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
