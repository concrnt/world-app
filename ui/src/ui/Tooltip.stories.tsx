import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Tooltip } from './Tooltip'
import { Button } from './Button'

const meta = {
    title: 'ui/Tooltip',
    component: Tooltip,
    parameters: {
        layout: 'centered'
    },
    tags: ['autodocs'],
    argTypes: {
        content: { control: false },
        children: { control: false },
        onOpen: { action: 'opened' },
        enterDelay: { control: 'number' },
        style: { control: 'object' }
    },
    args: {
        content: <span>Tooltip content</span>,
        children: <div />,
        onOpen: fn()
    }
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: (args) => (
        <Tooltip {...args}>
            <Button>Hover me</Button>
        </Tooltip>
    )
}

export const RichContent: Story = {
    render: (args) => (
        <Tooltip
            {...args}
            content={
                <div style={{ display: 'grid', gap: 4 }}>
                    <strong>Reactions</strong>
                    <span>alice</span>
                    <span>bob</span>
                </div>
            }
        >
            <Button>Hover me</Button>
        </Tooltip>
    )
}
