import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Dialog } from './Dialog';

const meta = {
  title: 'ui/Dialog',
  component: Dialog,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    open: { control: 'boolean' },
    onClose: { action: 'closed' },
    children: { control: false },
    style: { control: 'object' },
  },
  args: {
    open: true,
    onClose: fn(),
    children: <div />,
    style: {
      maxWidth: 480,
      borderRadius: 12,
      padding: 16,
    },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: (args) => (
    <Dialog {...args}>
      <div style={{ display: 'grid', gap: 8 }}>
        <strong>Dialog title</strong>
        <p style={{ margin: 0 }}>Dialog content preview for Storybook.</p>
      </div>
    </Dialog>
  ),
};

export const Closed: Story = {
  args: {
    open: false,
  },
  render: (args) => (
    <div style={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
      <Dialog {...args}>
        <div>Hidden</div>
      </Dialog>
      <span>Dialog is closed (renders null)</span>
    </div>
  ),
};
