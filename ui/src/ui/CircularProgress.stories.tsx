import type { Meta, StoryObj } from '@storybook/react-vite'
import { CircularProgress } from './CircularProgress'

const meta = {
    title: 'ui/CircularProgress',
    component: CircularProgress,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs']
} satisfies Meta<typeof CircularProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Indeterminate: Story = {
    render: () => <CircularProgress />
}

export const Determinate: Story = {
    render: () => (
        <div style={{ display: 'flex', gap: 16 }}>
            <CircularProgress value={0.1} />
            <CircularProgress value={0.4} />
            <CircularProgress value={0.7} />
            <CircularProgress value={1} />
        </div>
    )
}
