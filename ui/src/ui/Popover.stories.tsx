import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Popover } from './Popover'
import { Button } from './Button'

const meta = {
    title: 'ui/Popover',
    component: Popover,
    parameters: {
        layout: 'centered'
    },
    tags: ['autodocs'],
    argTypes: {
        open: { control: 'boolean' },
        onClose: { action: 'closed' },
        anchor: { control: 'text' },
        children: { control: false },
        style: { control: 'object' }
    },
    args: {
        open: false,
        onClose: fn(),
        anchor: '--storybook-popover',
        children: <div />
    }
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

const PopoverDemo = (args: React.ComponentProps<typeof Popover>) => {
    const [open, setOpen] = useState(false)
    return (
        <>
            <Button onClick={() => setOpen(true)} style={{ anchorName: args.anchor } as CSSProperties}>
                Open popover
            </Button>
            <Popover {...args} open={open} onClose={() => setOpen(false)}>
                <div style={{ display: 'grid', gap: 8, padding: 8 }}>
                    <strong>Popover</strong>
                    <p style={{ margin: 0 }}>Anchored to the trigger button.</p>
                </div>
            </Popover>
        </>
    )
}

export const Default: Story = {
    render: (args) => <PopoverDemo {...args} />
}
