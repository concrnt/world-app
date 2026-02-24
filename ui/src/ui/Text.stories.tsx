import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from './Text';

const meta = {
  title: 'ui/Text',
  component: Text,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text' },
    variant: {
      control: { type: 'select' },
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'caption'],
    },
    style: { control: 'object' },
  },
  args: {
    children: 'The quick brown fox jumps over the lazy dog.',
    variant: 'body',
    style: {},
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Body: Story = {};

export const Heading: Story = {
  args: {
    variant: 'h3',
    children: 'Section heading',
  },
};

export const Caption: Story = {
  args: {
    variant: 'caption',
    children: 'Caption text',
  },
};

export const VariantsPreview: Story = {
  render: () => (
    <div style={{ width: 420 }}>
      <Text variant="h1">Heading 1</Text>
      <Text variant="h2">Heading 2</Text>
      <Text variant="h3">Heading 3</Text>
      <Text variant="body">Body text for normal content.</Text>
      <Text variant="caption">Caption text for metadata.</Text>
    </div>
  ),
};

