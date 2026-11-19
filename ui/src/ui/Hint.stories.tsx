import type { Meta, StoryObj } from '@storybook/react-vite'
import { Hint } from './Hint'

const meta = {
    title: 'ui/Hint',
    component: Hint,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs'],
    argTypes: {
        variant: { control: 'select', options: ['info', 'success', 'warning', 'error'] },
        title: { control: 'text' }
    },
    args: {
        title: 'Hint',
        children: 'This creates a brand-new account on Bluesky. An existing Bluesky account cannot be taken over.'
    }
} satisfies Meta<typeof Hint>

export default meta
type Story = StoryObj<typeof meta>

export const Info: Story = {}

export const Success: Story = {
    args: { variant: 'success', title: 'Done', children: 'Your handle has been verified.' }
}

export const Warning: Story = {
    args: { variant: 'warning', title: 'Caution', children: 'DNS changes may take a few minutes to propagate.' }
}

export const Error: Story = {
    args: { variant: 'error', title: 'Failed', children: 'Setup failed. The handle may already be in use.' }
}

export const WithoutTitle: Story = {
    render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 360 }}>
            <Hint>Icon and body sit on one line when no title is given.</Hint>
            <Hint variant="success">Saved.</Hint>
            <Hint variant="warning">Unsaved changes.</Hint>
            <Hint variant="error">Something went wrong.</Hint>
        </div>
    )
}
