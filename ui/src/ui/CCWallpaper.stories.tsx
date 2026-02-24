import type { Meta, StoryObj } from '@storybook/react-vite';
import { CCWallpaper } from './CCWallpaper';

const meta = {
  title: 'ui/CCWallpaper',
  component: CCWallpaper,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    src: { control: 'text' },
    children: { control: false },
    style: { control: 'object' },
  },
  args: {
    style: {
      width: 320,
      height: 180,
      borderRadius: 12,
      overflow: 'hidden',
    },
  },
} satisfies Meta<typeof CCWallpaper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <CCWallpaper {...args}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'white',
          fontWeight: 700,
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.25))',
        }}
      >
        Wallpaper Content
      </div>
    </CCWallpaper>
  ),
};

export const CustomImage: Story = {
  args: {
    src: 'https://picsum.photos/640/360',
  },
  render: (args) => (
    <CCWallpaper {...args}>
      <div style={{ padding: 12, color: 'white', fontWeight: 600 }}>Custom source image</div>
    </CCWallpaper>
  ),
};

