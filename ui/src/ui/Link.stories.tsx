import type { Meta, StoryObj } from '@storybook/react-vite';
import { Link } from './Link';

const meta = {
  title: 'ui/Link',
  component: Link,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    href: { control: 'text' },
    children: { control: 'text' },
  },
  args: {
    href: 'https://example.com',
    children: 'Open example.com',
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

