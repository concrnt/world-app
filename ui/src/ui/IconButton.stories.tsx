import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { IconButton } from './IconButton';

const meta = {
  title: 'ui/IconButton',
  component: IconButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['transparent', 'contained'],
    },
    disabled: { control: 'boolean' },
    onClick: { action: 'clicked' },
    children: { control: 'text' },
    style: { control: 'object' },
  },
  args: {
    variant: 'transparent',
    disabled: false,
    onClick: fn(),
    children: '★',
    style: {},
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Transparent: Story = {};

export const Contained: Story = {
  args: {
    variant: 'contained',
    children: '+',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

