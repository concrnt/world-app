import type { Meta, StoryObj } from '@storybook/react-vite'
import { MfmRenderer } from './MfmRenderer'

const meta = {
    title: 'ui/MfmRenderer',
    component: MfmRenderer,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs'],
    argTypes: {
        messagebody: { control: 'text' },
        emojiDict: { control: 'object' }
    },
    args: {
        messagebody:
            'Hello **MFM**!\n$[tada tada] $[jelly jelly] $[shake shake] $[spin spin] $[jump jump] $[bounce bounce]\n$[x2 big] $[fg.color=f00 red] $[bg.color=ff0 marked] $[blur secret]\n$[sparkle ✨sparkle✨] $[rainbow rainbow]\n<center>centered</center>\n> quote\n`inline code`\n:party:',
        emojiDict: {
            party: {
                imageURL: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f389.svg'
            }
        }
    }
} satisfies Meta<typeof MfmRenderer>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {}

export const Structures: Story = {
    args: {
        messagebody:
            '```ts\nconst x = 1\n```\n$[ruby 明日 あした] $[rotate.deg=30 rotated) ] $[position.x=1 moved] $[border bordered]\n@mention @user@example.com #hashtag\nmfm search\nsearch'
    }
}
