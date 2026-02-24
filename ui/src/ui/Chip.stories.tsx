import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Chip } from './Chip';

const meta = {
  title: 'ui/Chip',
  component: Chip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['contained', 'outlined'],
    },
    onClick: { action: 'clicked' },
    children: { control: 'text' },
    headElement: { control: false },
    tailElement: { control: false },
    disabled: { control: 'boolean' },
    style: { control: 'object' },
  },
  args: {
    children: 'Chip',
    variant: 'contained',
    onClick: fn(),
    disabled: false,
    style: {},
  },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Contained: Story = {};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
  },
};

export const WithLeadingAndTrailing: Story = {
  args: {
    children: 'Filter',
    headElement: <span aria-hidden>🔎</span>,
    tailElement: <span aria-hidden>×</span>,
  },
};

