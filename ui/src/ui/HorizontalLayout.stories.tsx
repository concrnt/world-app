import type { Meta, StoryObj } from '@storybook/react-vite'
import { HorizontalLayout } from './HorizontalLayout'
import { Chip } from './Chip'

const meta = {
    title: 'ui/HorizontalLayout',
    component: HorizontalLayout,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs'],
    argTypes: {
        children: { control: false },
        style: { control: 'object' }
    },
    args: {
        style: {},
        children: <div />
    }
} satisfies Meta<typeof HorizontalLayout>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
    render: (args) => (
        <div style={{ width: 360, border: '1px solid #ddd' }}>
            <HorizontalLayout {...args} style={{ gap: '8px', padding: '8px', ...args.style }}>
                {['Reply', 'Mention', 'Reroute', 'Fav', 'Reaction', 'Read Request'].map((label) => (
                    <Chip key={label} variant="outlined">
                        {label}
                    </Chip>
                ))}
            </HorizontalLayout>
        </div>
    )
}
