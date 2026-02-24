import type { Meta, StoryObj } from '@storybook/react-vite';
import { Codeblock } from './Codeblock';

const meta = {
  title: 'ui/Codeblock',
  component: Codeblock,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    language: { control: 'text' },
    children: { control: 'text' },
  },
  args: {
    language: 'typescript',
    children: `type User = { id: string; name: string }\n\nexport const greet = (user: User) => {\n  return \`Hello, \${user.name}\`;\n};`,
  },
} satisfies Meta<typeof Codeblock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TypeScript: Story = {};

export const Json: Story = {
  args: {
    language: 'json',
    children: `{\n  "id": "01HXYZ",\n  "name": "world-app-ui",\n  "enabled": true\n}`,
  },
};

