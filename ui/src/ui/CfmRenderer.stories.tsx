import type { Meta, StoryObj } from '@storybook/react-vite';
import { CfmRenderer } from './CfmRenderer';

const meta = {
  title: 'ui/CfmRenderer',
  component: CfmRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    messagebody: { control: 'text' },
    emojiDict: { control: 'object' },
  },
  args: {
    messagebody:
      'Hello **CFM**!\\nVisit https://example.com\\n`inline code`\\n\\n```ts\\nconst x = 1\\n```\\n:party:',
    emojiDict: {
      party: {
        imageURL: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f389.svg',
      },
    },
  },
} satisfies Meta<typeof CfmRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const RichText: Story = {
  args: {
    messagebody:
      '# Heading\\n> quote\\n\\n- list-like plain text\\n\\n||spoiler|| and #ff8800 and @someone',
  },
};

