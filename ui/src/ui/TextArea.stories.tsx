import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TextArea } from './TextArea'

const meta = {
    title: 'ui/TextArea',
    component: TextArea,
    parameters: {
        layout: 'centered'
    },
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <div style={{ width: 320 }}>
                <Story />
            </div>
        )
    ],
    argTypes: {
        autofocus: { control: 'boolean' },
        disabled: { control: 'boolean' },
        value: { control: 'text' },
        placeholder: { control: 'text' },
        rows: { control: 'number' },
        monospace: { control: 'boolean' },
        onChange: { action: 'changed' }
    },
    args: {
        autofocus: false,
        disabled: false,
        value: '',
        placeholder: 'Enter text...',
        rows: 5,
        monospace: false,
        onChange: fn()
    }
} satisfies Meta<typeof TextArea>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const Filled: Story = {
    args: {
        value: 'Hello, world\nSecond line'
    }
}

export const Monospace: Story = {
    args: {
        monospace: true,
        rows: 10,
        value: '{\n    "key": "value"\n}'
    }
}
