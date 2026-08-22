import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from './Badge'

const meta = {
    title: 'ui/Badge',
    component: Badge,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs'],
    argTypes: {
        count: { control: 'number' }
    },
    args: {
        count: 3
    }
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Overflow: Story = {
    args: { count: 120 }
}

export const Zero: Story = {
    args: { count: 0 }
}

export const Anchored: Story = {
    render: (args) => (
        <div style={{ display: 'flex', gap: 24, fontSize: 24 }}>
            <Badge {...args}>🔔</Badge>
            <Badge {...args} anchorOrigin={{ vertical: 'top', horizontal: 'left' }}>
                🔔
            </Badge>
            <Badge {...args} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                🔔
            </Badge>
            <Badge {...args} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
                🔔
            </Badge>
        </div>
    )
}
