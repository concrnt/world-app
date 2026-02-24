import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConcrntLogo } from './ConcrntLogo';

const meta = {
  title: 'ui/ConcrntLogo',
  component: ConcrntLogo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'text' },
    upperColor: { control: 'color' },
    lowerColor: { control: 'color' },
    frameColor: { control: 'color' },
  },
  args: {
    size: '96px',
    upperColor: '#87c8ff',
    lowerColor: '#2f6dff',
    frameColor: '#1c2533',
  },
} satisfies Meta<typeof ConcrntLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Monochrome: Story = {
  args: {
    upperColor: '#111111',
    lowerColor: '#111111',
    frameColor: '#111111',
  },
};

