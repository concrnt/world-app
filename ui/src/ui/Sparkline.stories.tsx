import type { Meta, StoryObj } from '@storybook/react-vite'
import { Sparkline } from './Sparkline'
import { CssVar } from '../types/Theme'

const meta = {
    title: 'ui/Sparkline',
    component: Sparkline,
    parameters: {
        layout: 'padded'
    },
    tags: ['autodocs']
} satisfies Meta<typeof Sparkline>

export default meta
type Story = StoryObj<typeof meta>

const random = Array.from({ length: 30 }, (_, i) => Math.round(Math.abs(Math.sin(i / 3) * 10 + (i % 7))))
const sparse = Array.from({ length: 30 }, (_, i) => (i % 9 === 0 ? 3 : 0))

export const Default: Story = {
    args: { values: random },
    render: (args) => (
        <div style={{ width: 320, height: 80, color: CssVar.contentLink }}>
            <Sparkline {...args} />
        </div>
    )
}

export const Sparse: Story = {
    args: { values: sparse },
    render: (args) => (
        <div style={{ width: 320, height: 80, color: CssVar.contentLink }}>
            <Sparkline {...args} />
        </div>
    )
}

// 全て0の系列は何も描かない
export const Flat: Story = {
    args: { values: Array(30).fill(0) },
    render: (args) => (
        <div style={{ width: 320, height: 80, border: `1px dashed ${CssVar.divider}` }}>
            <Sparkline {...args} />
        </div>
    )
}

// カードの右側背景として敷く使い方
export const AsBackground: Story = {
    args: { values: random },
    render: (args) => (
        <div
            style={{
                position: 'relative',
                width: 360,
                height: 112,
                border: `1px solid ${CssVar.divider}`,
                borderRadius: 8,
                overflow: 'hidden'
            }}
        >
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: '55%',
                    pointerEvents: 'none',
                    opacity: 0.25,
                    color: CssVar.contentLink,
                    maskImage: 'linear-gradient(to right, transparent, black 65%)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, black 65%)'
                }}
            >
                <Sparkline {...args} />
            </div>
            <div style={{ position: 'relative', padding: 8 }}>
                <div style={{ fontWeight: 'bold' }}>Community name</div>
                <div style={{ opacity: 0.7 }}>Description text sits above the sparkline</div>
            </div>
        </div>
    )
}
