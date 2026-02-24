import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';

const meta = {
  title: 'ui/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    ccid: { control: 'text' },
    src: { control: 'text' },
    style: { control: 'object' },
  },
  args: {
    ccid: 'con1abcdefghijklmnopqrstuvwxyz1234567890',
    style: {},
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Generated: Story = {};

export const ImageSource: Story = {
  args: {
    src: 'https://picsum.photos/80',
  },
};

export const RoundedLarge: Story = {
  args: {
    style: {
      width: '56px',
      height: '56px',
      borderRadius: '12px',
    },
  },
};

