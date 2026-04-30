import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { List } from './List'
import { ListItem } from './ListItem'

const meta = {
    title: 'ui/List',
    component: List,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs']
} satisfies Meta<typeof List>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => (
        <List style={{ maxWidth: 420 }}>
            <ListItem icon={<span aria-hidden>👤</span>} onClick={fn()}>
                Account
            </ListItem>
            <ListItem icon={<span aria-hidden>🔔</span>} onClick={fn()} secondaryAction={<span aria-hidden>›</span>}>
                Notifications
            </ListItem>
            <ListItem icon={<span aria-hidden>🎨</span>}>Appearance</ListItem>
        </List>
    )
}

export const DenseContent: Story = {
    render: () => (
        <List style={{ maxWidth: 420 }}>
            <ListItem icon={<span aria-hidden>📱</span>} onClick={fn()}>
                <div>
                    <div>Devices</div>
                    <small style={{ opacity: 0.7 }}>Manage signed-in devices</small>
                </div>
            </ListItem>
            <ListItem icon={<span aria-hidden>💬</span>} onClick={fn()}>
                <div>
                    <div>Messages</div>
                    <small style={{ opacity: 0.7 }}>Notification and preview settings</small>
                </div>
            </ListItem>
        </List>
    )
}
