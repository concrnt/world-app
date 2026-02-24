import type { Meta, StoryObj } from '@storybook/react-vite';
import { Divider } from './Divider';

const meta = {
  title: 'ui/Divider',
  component: Divider,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <div style={{ paddingBottom: 12 }}>Above</div>
      <Divider />
      <div style={{ paddingTop: 12 }}>Below</div>
    </div>
  ),
};

