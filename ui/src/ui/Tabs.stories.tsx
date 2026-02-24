import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Tab } from './Tab';
import { Tabs } from './Tabs';

const meta = {
  title: 'ui/Tabs',
  component: Tabs,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    children: { control: false },
    style: { control: 'object' },
    variant: {
      control: { type: 'select' },
      options: ['classic', 'world'],
    },
  },
  args: {
    variant: 'world',
    style: {},
    children: <div />,
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: (args) => (
    <div style={{ width: 360, border: '1px solid #ddd' }}>
      <Tabs {...args}>
        <Tab groupId="tabs-basic" selected onClick={fn()}>
          Home
        </Tab>
        <Tab groupId="tabs-basic" onClick={fn()}>
          Explore
        </Tab>
        <Tab groupId="tabs-basic" onClick={fn()}>
          Profile
        </Tab>
      </Tabs>
    </div>
  ),
};

export const Classic: Story = {
  args: {
    variant: 'classic',
  },
  render: (args) => (
    <div style={{ width: 360, border: '1px solid #ddd' }}>
      <Tabs {...args}>
        <Tab groupId="tabs-classic" selected onClick={fn()}>
          Timeline
        </Tab>
        <Tab groupId="tabs-classic" onClick={fn()}>
          Mentions
        </Tab>
        <Tab groupId="tabs-classic" onClick={fn()}>
          Saved
        </Tab>
      </Tabs>
    </div>
  ),
};

