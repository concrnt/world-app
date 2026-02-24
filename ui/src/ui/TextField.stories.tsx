import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TextField } from './TextField';

const meta = {
  title: 'ui/TextField',
  component: TextField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    autofocus: { control: 'boolean' },
    value: { control: 'text' },
    placeholder: { control: 'text' },
    onChange: { action: 'changed' },
  },
  args: {
    autofocus: false,
    value: '',
    placeholder: 'Enter text...',
    onChange: fn(),
  },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = {
  args: {
    value: 'Hello, world',
  },
};

