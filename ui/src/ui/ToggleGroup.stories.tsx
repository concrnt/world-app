import { useState } from 'react'
import type { ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ToggleGroup } from './ToggleGroup'
import { CssVar } from '../types/Theme'

const ControlledToggleGroup = (args: ComponentProps<typeof ToggleGroup<string>>) => {
    const [value, setValue] = useState(args.value)
    return (
        <ToggleGroup
            {...args}
            value={value}
            onChange={(v) => {
                setValue(v)
                args.onChange(v)
            }}
        />
    )
}

const meta = {
    title: 'ui/ToggleGroup',
    component: ToggleGroup,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs'],
    argTypes: {
        options: { control: false },
        value: { control: false },
        onChange: { control: false },
        disabled: { control: 'boolean' },
        style: { control: 'object' }
    },
    args: {
        options: [
            { value: 'one', label: 'One' },
            { value: 'two', label: 'Two' },
            { value: 'three', label: 'Three' }
        ],
        value: 'one',
        onChange: fn(),
        disabled: false
    }
} satisfies Meta<typeof ToggleGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
    render: (args) => (
        <div style={{ width: 360 }}>
            <ControlledToggleGroup {...args} />
        </div>
    )
}

export const OnColoredBackground: Story = {
    render: (args) => (
        <div
            style={{
                width: 360,
                padding: CssVar.space(5),
                color: 'white',
                backgroundColor: '#0476d9',
                borderRadius: CssVar.round(2)
            }}
        >
            <ControlledToggleGroup {...args} />
        </div>
    )
}
