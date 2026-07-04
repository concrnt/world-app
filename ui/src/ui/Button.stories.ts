import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Button } from './Button'

const meta = {
    title: 'ui/Button',
    component: Button,
    parameters: {
        layout: 'centered'
    },
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: { type: 'select' },
            options: ['contained', 'outlined', 'text']
        },
        disabled: { control: 'boolean' },
        startIcon: { control: false },
        endIcon: { control: false },
        style: { control: 'object' },
        onClick: { action: 'clicked' },
        children: { control: 'text' }
    },
    args: {
        children: 'Button',
        variant: 'contained',
        disabled: false,
        onClick: fn(),
        style: {}
    }
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Contained: Story = {
    args: {
        variant: 'contained',
        children: 'Contained'
    }
}

export const Outlined: Story = {
    args: {
        variant: 'outlined',
        children: 'Outlined'
    }
}

export const Text: Story = {
    args: {
        variant: 'text',
        children: 'Text'
    }
}

export const Disabled: Story = {
    args: {
        disabled: true,
        children: 'Disabled'
    }
}

export const AsyncBusy: Story = {
    args: {
        children: '保存',
        busyChildren: '保存中...',
        onClick: () => new Promise((resolve) => setTimeout(resolve, 2000))
    }
}

export const CustomStyle: Story = {
    args: {
        children: 'Custom Style',
        style: {
            borderRadius: 999,
            padding: '12px 18px'
        }
    }
}
