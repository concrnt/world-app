import type { Meta, StoryObj } from '@storybook/react-vite'
import { GfmRenderer } from './GfmRenderer'

const meta = {
    title: 'ui/GfmRenderer',
    component: GfmRenderer,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs'],
    argTypes: {
        messagebody: { control: 'text' }
    },
    args: {
        messagebody:
            '# Heading\n\nHello **GFM**!\nVisit https://example.com\n\n- list item 1\n- list item 2\n\n1. ordered\n2. list\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n> quote\n\n`inline code`\n\n```ts\nconst x = 1\n```\n\n---\n\n~~strike~~ and a [link](https://example.com)'
    }
} satisfies Meta<typeof GfmRenderer>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {}

export const RawHtml: Story = {
    args: {
        messagebody: '<details><summary>open me</summary>\n\nhidden content\n\n</details>'
    }
}

export const Emoji: Story = {
    args: {
        messagebody:
            'custom emoji :wave: in text\n\n<b>inside raw html :wave: too</b>\n\nunknown shortcode :unknown: stays text\n\n`:wave:` in code is not converted',
        emojiDict: {
            wave: {
                imageURL:
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Ccircle cx='36' cy='36' r='30' fill='orange'/%3E%3C/svg%3E"
            }
        }
    }
}
