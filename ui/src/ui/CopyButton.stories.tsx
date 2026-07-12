import type { Meta, StoryObj } from '@storybook/react-vite'
import { CopyButton } from './CopyButton'

const meta = {
    title: 'ui/CopyButton',
    component: CopyButton,
    parameters: {
        layout: 'centered'
    },
    tags: ['autodocs'],
    argTypes: {
        text: { control: 'text' },
        size: { control: 'number' },
        style: { control: 'object' }
    },
    args: {
        text: 'copied text',
        size: 16,
        style: {}
    }
} satisfies Meta<typeof CopyButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Large: Story = {
    args: {
        size: 24
    }
}
