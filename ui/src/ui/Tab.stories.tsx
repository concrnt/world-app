import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Tab } from './Tab';

const meta = {
  title: 'ui/Tab',
  component: Tab,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    selected: { control: 'boolean' },
    children: { control: 'text' },
    onClick: { action: 'clicked' },
    groupId: { control: 'text' },
    style: { control: 'object' },
  },
  args: {
    selected: false,
    children: 'Tab',
    onClick: fn(),
    groupId: 'example',
    style: {},
  },
} satisfies Meta<typeof Tab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    selected: true,
  },
};

export const RowPreview: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #ddd' }}>
      <Tab groupId="row" selected onClick={fn()}>
        Home
      </Tab>
      <Tab groupId="row" onClick={fn()}>
        Explore
      </Tab>
      <Tab groupId="row" onClick={fn()}>
        Profile
      </Tab>
    </div>
  ),
};

