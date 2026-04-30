import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CssVar } from '../types/Theme'
import { ButtonBase } from './ButtonBase'

const meta = {
    title: 'ui/ButtonBase',
    component: ButtonBase,
    parameters: {
        layout: 'centered'
    },
    tags: ['autodocs'],
    argTypes: {
        children: { control: 'text' },
        disabled: { control: 'boolean' },
        onClick: { action: 'clicked' },
        style: { control: 'object' },
        pressedStyle: { control: 'object' }
    },
    args: {
        children: 'Base Button',
        disabled: false,
        onClick: fn(),
        style: {
            padding: '12px 16px',
            borderRadius: CssVar.round(1),
            backgroundColor: CssVar.uiBackground,
            color: CssVar.uiText
        },
        pressedStyle: {
            filter: 'brightness(0.75)'
        }
    }
} satisfies Meta<typeof ButtonBase>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SoftTint: Story = {
    args: {
        style: {
            padding: '12px 16px',
            borderRadius: 999,
            backgroundColor: 'transparent',
            border: `1px solid ${CssVar.uiBackground}`,
            color: CssVar.uiBackground
        },
        pressedStyle: {
            backgroundColor: `rgb(from ${CssVar.uiBackground} r g b / 0.12)`
        }
    }
}
