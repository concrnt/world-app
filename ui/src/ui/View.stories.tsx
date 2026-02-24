import type { Meta, StoryObj } from '@storybook/react-vite';
import { Divider } from './Divider';
import { Text } from './Text';
import { View } from './View';

const meta = {
  title: 'ui/View',
  component: View,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    children: { control: false },
    variant: {
      control: { type: 'select' },
      options: ['classic', 'world'],
    },
  },
  args: {
    variant: 'world',
    children: <div />,
  },
} satisfies Meta<typeof View>;

export default meta;
type Story = StoryObj<typeof meta>;

const SampleContent = () => (
  <>
    <div style={{ padding: 12 }}>
      <Text variant="h4">Inbox</Text>
      <Text variant="caption">Updated just now</Text>
    </div>
    <Divider />
    <div style={{ padding: 12 }}>
      <Text>First item</Text>
      <Text>Second item</Text>
    </div>
  </>
);

export const World: Story = {
  render: (args) => (
    <div
      style={{
        width: 360,
        height: 280,
        display: 'flex',
        background: 'linear-gradient(180deg, #f2f5f8 0%, #e7edf2 100%)',
        padding: 8,
      }}
    >
      <View {...args}>
        <SampleContent />
      </View>
    </div>
  ),
};

export const Classic: Story = {
  args: {
    variant: 'classic',
  },
  render: (args) => (
    <div
      style={{
        width: 360,
        height: 280,
        background: '#f5f5f5',
        paddingTop: 8,
      }}
    >
      <View {...args}>
        <SampleContent />
      </View>
    </div>
  ),
};

