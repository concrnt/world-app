import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { TextField } from './TextField'
import { IconButton } from './IconButton'

const meta = {
    title: 'ui/TextField',
    component: TextField,
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
        value: { control: 'text' },
        placeholder: { control: 'text' },
        onChange: { action: 'changed' }
    },
    args: {
        autofocus: false,
        value: '',
        placeholder: 'Enter text...',
        onChange: fn()
    }
} satisfies Meta<typeof TextField>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const Filled: Story = {
    args: {
        value: 'Hello, world'
    }
}

const Magnifier = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5, flexShrink: 0 }}>
        <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14" />
    </svg>
)

export const WithAdornments: Story = {
    args: {
        value: 'concrnt',
        placeholder: 'Search...',
        startAdornment: <Magnifier />,
        endAdornment: <IconButton title="clear">×</IconButton>
    }
}
