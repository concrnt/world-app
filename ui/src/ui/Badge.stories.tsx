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
