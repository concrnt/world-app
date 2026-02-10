// -- core --
export type FQDN = string

export type CCID = string
export const IsCCID = (str: string): boolean => {
    return str.startsWith('con1') && !str.includes('.') && str.length === 42
}

export type CSID = string
export const IsCSID = (str: string): boolean => {
    return str.startsWith('ccs1') && !str.includes('.') && str.length === 42
}

export type CKID = string
export const IsCKID = (str: string): boolean => {
    return str.startsWith('cck1') && !str.includes('.') && str.length === 42
}

export interface Document<T> {
    key?: string
    schema: string
    value: T
    author: string
    owner?: string
    createdAt: Date
    distributes?: string[]

    associate?: string
    associationVariant?: string

    policies?: Policy[]
}

export interface Policy {
    url: string
    params?: any
    defaults?: Record<string, string>
}

export interface Proof {
    type: string
    signature: string
}

export interface SignedDocument {
    cckv: string
    ccfs: string
    document: string
    proof: Proof
}

export interface Affiliation {
    domain: string
}

export interface RealtimeEvent {
    type: string
    uri: string
    documents: Record<string, SignedDocument>
}
