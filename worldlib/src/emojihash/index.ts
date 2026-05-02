const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193
const GOLDEN_GAMMA = 0x9e3779b9

export const EMOJIHASH_LENGTH = 6

export const EMOJIHASH_TABLE = [
    '🐘',
    '🦒',
    '🐬',
    '🐢',
    '🐧',
    '🦉',
    '🐼',
    '🦄',
    '🦓',
    '🐪',
    '🦭',
    '🐟',
    '🐙',
    '🦜',
    '🦌',
    '🦙',
    '🍎',
    '🍊',
    '🍋',
    '🍇',
    '🍉',
    '🍓',
    '🍒',
    '🍍',
    '🥕',
    '🌽',
    '🍅',
    '🥦',
    '🥐',
    '🧀',
    '🍪',
    '🍜',
    '🌲',
    '🌵',
    '🌻',
    '🍀',
    '🌈',
    '☀️',
    '🌙',
    '⭐',
    '☁️',
    '⚡',
    '❄️',
    '🌊',
    '🔥',
    '🌋',
    '⛰️',
    '🍄',
    '🏠',
    '🏰',
    '🗼',
    '⛺',
    '🚗',
    '🚲',
    '🚂',
    '🚀',
    '⛵',
    '🚁',
    '🚜',
    '🚌',
    '🚚',
    '🚇',
    '🚕',
    '🛶',
    '🎈',
    '🎁',
    '🎸',
    '🎹',
    '🎯',
    '🎲',
    '🧩',
    '📚',
    '✏️',
    '🎨',
    '🎧',
    '🎬',
    '🎺',
    '🎻',
    '🎮',
    '🪁',
    '🐶',
    '🐱',
    '🐭',
    '🐹',
    '🐰',
    '🦊',
    '🐻',
    '🐨',
    '🐯',
    '🦁',
    '🐮',
    '🐷',
    '🐸',
    '🐵',
    '🐺',
    '🐴',
    '🔑',
    '🔔',
    '💎',
    '🧲',
    '🔭',
    '⏰',
    '💡',
    '📷',
    '🔒',
    '📌',
    '🪙',
    '💻',
    '🧰',
    '🧭',
    '🪄',
    '🧱',
    '🐔',
    '🐤',
    '🐦',
    '🦆',
    '🦅',
    '🐳',
    '🦈',
    '🐊',
    '🦖',
    '🦕',
    '🐲',
    '🦦',
    '🦥',
    '🦔',
    '🐿️',
    '🐐'
] as const

function fnv1a(value: string): number {
    const bytes = new TextEncoder().encode(value)
    let hash = FNV_OFFSET_BASIS

    for (const byte of bytes) {
        hash ^= byte
        hash = Math.imul(hash, FNV_PRIME)
    }

    return hash >>> 0
}

function mixUint32(value: number): number {
    let hash = value >>> 0
    hash ^= hash >>> 16
    hash = Math.imul(hash, 0x7feb352d)
    hash ^= hash >>> 15
    hash = Math.imul(hash, 0x846ca68b)
    hash ^= hash >>> 16
    return hash >>> 0
}

/**
 * Converts an arbitrary string into a short visual fingerprint.
 * This is deterministic but not intended for cryptographic use.
 */
export function emojihash(value: string): string {
    const seed = fnv1a(value)
    const emojis: string[] = []

    for (let index = 0; index < EMOJIHASH_LENGTH; index++) {
        const mixed = mixUint32((seed + Math.imul(index + 1, GOLDEN_GAMMA)) >>> 0)
        emojis.push(EMOJIHASH_TABLE[mixed % EMOJIHASH_TABLE.length]!)
    }

    return emojis.join('')
}
