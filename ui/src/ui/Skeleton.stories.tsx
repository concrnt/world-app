import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton } from './Skeleton'

const meta = {
    title: 'ui/Skeleton',
    component: Skeleton,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs']
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
    render: () => (
        <div style={{ width: 320 }}>
            <Skeleton
                style={{
                    width: '100%',
                    height: 200
                }}
            />
        </div>
    )
}
