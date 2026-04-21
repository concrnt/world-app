// cdid.ts

import { keccak_256 } from 'js-sha3'

// ---------------- base32 ----------------

const ENCODING = '0123456789abcdefghjkmnpqrstuvwyz'

const CHAR_MAP = new Map<string, number>()
for (let i = 0; i < ENCODING.length; i++) {
    CHAR_MAP.set(ENCODING[i], i)
}

function base32Encode(bytes: Uint8Array): string {
    let bits = 0
    let value = 0
    let output = ''

    for (const b of bytes) {
        value = (value << 8) | b
        bits += 8

        while (bits >= 5) {
            output += ENCODING[(value >>> (bits - 5)) & 31]
            bits -= 5
        }
    }

    if (bits > 0) {
        output += ENCODING[(value << (5 - bits)) & 31]
    }

    return output
}

function base32Decode(str: string): Uint8Array {
    let bits = 0
    let value = 0
    const out: number[] = []

    for (const c of str) {
        const v = CHAR_MAP.get(c)
        if (v === undefined) throw new Error('invalid base32 char')

        value = (value << 5) | v
        bits += 5

        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff)
            bits -= 8
        }
    }

    return new Uint8Array(out)
}

// ---------------- types ----------------

export enum Kind {
    Time = 0,
    Hash = 1
}

export class CDID {
    private kind: Kind
    private time: Uint8Array = new Uint8Array(6)
    private data: Uint8Array = new Uint8Array(10)
    private hash: Uint8Array = new Uint8Array(15)

    private constructor(kind: Kind) {
        this.kind = kind
    }

    // -------- constructors --------

    static new(data: Uint8Array, t: Date): CDID {
        if (data.length !== 10) throw new Error('data must be 10 bytes')

        const c = new CDID(Kind.Time)
        c.data.set(data)
        c.setTime(t)
        return c
    }

    static newFromHash(data: Uint8Array): CDID {
        if (data.length !== 15) throw new Error('hash must be 15 bytes')

        const c = new CDID(Kind.Hash)
        c.hash.set(data)
        return c
    }

    static makeHash(input: Uint8Array): CDID {
        const hash = keccak_256.create()
        hash.update(input)
        const full = new Uint8Array(hash.arrayBuffer())

        return CDID.newFromHash(full.slice(0, 15))
    }

    // -------- time --------

    private setTime(t: Date) {
        if (this.kind === Kind.Hash) return

        // Goと同じ: Unix秒*1000 + ミリ秒
        const m = BigInt(t.getTime())

        this.time[0] = Number((m >> 40n) & 0xffn)
        this.time[1] = Number((m >> 32n) & 0xffn)
        this.time[2] = Number((m >> 24n) & 0xffn)
        this.time[3] = Number((m >> 16n) & 0xffn)
        this.time[4] = Number((m >> 8n) & 0xffn)
        this.time[5] = Number(m & 0xffn)
    }

    getTime(): Date | null {
        if (this.kind === Kind.Hash) return null

        let m = 0n
        for (let i = 0; i < 6; i++) {
            m = (m << 8n) | BigInt(this.time[i])
        }

        return new Date(Number(m))
    }

    // -------- bytes --------

    bytes(): Uint8Array {
        if (this.kind === Kind.Hash) {
            return this.hash
        }
        const out = new Uint8Array(16)
        out.set(this.time, 0)
        out.set(this.data, 6)
        return out
    }

    // -------- string --------

    toString(): string {
        if (this.kind === Kind.Hash) {
            return 'x' + base32Encode(this.hash)
        }
        return base32Encode(this.bytes())
    }

    // -------- parse --------

    static parse(s: string): CDID {
        if (!s) throw new Error('empty string')

        if (s[0] === 'x') {
            const b = base32Decode(s.slice(1))
            if (b.length !== 15) throw new Error('invalid length')

            return CDID.newFromHash(b)
        } else {
            const b = base32Decode(s)
            if (b.length !== 16) throw new Error('invalid length')

            const c = new CDID(Kind.Time)
            c.time.set(b.slice(0, 6))
            c.data.set(b.slice(6))
            return c
        }
    }

    // -------- utils --------

    static isHashCDID(s: string): boolean {
        return s.length > 0 && s[0] === 'x'
    }

    static isTimeCDID(s: string): boolean {
        return s.length > 0 && s[0] !== 'x'
    }

    static isCDIDChar(c: string): boolean {
        return /^[0-9a-z]$/.test(c) && !['i', 'l', 'o'].includes(c)
    }
}
