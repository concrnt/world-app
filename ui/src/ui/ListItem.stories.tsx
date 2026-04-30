import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { List } from './List'
import { ListItem } from './ListItem'

const meta = {
    title: 'ui/ListItem',
    component: ListItem,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs'],
    argTypes: {
        icon: { control: false },
        secondaryAction: { control: false },
        children: { control: false },
        onClick: { action: 'clicked' }
    },
    args: {
        icon: <span aria-hidden>⚙️</span>,
        children: <span>Settings</span>,
        onClick: fn()
    }
} satisfies Meta<typeof ListItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: (args) => (
        <List style={{ maxWidth: 420 }}>
            <ListItem {...args} />
        </List>
    )
}

export const WithDescription: Story = {
    args: {
        icon: <span aria-hidden>🔔</span>,
        children: (
            <div>
                <div>Notifications</div>
                <small style={{ opacity: 0.7 }}>Push and email preferences</small>
            </div>
        )
    },
    render: (args) => (
        <List style={{ maxWidth: 420 }}>
            <ListItem {...args} />
        </List>
    )
}

export const WithSecondaryAction: Story = {
    args: {
        icon: <span aria-hidden>🔒</span>,
        children: <span>Privacy</span>,
        secondaryAction: <span aria-hidden>›</span>
    },
    render: (args) => (
        <List style={{ maxWidth: 420 }}>
            <ListItem {...args} />
        </List>
    )
}
