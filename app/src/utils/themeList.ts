import { CDID, type Document } from '@concrnt/client'
import { Client, type ListSchema, Schemas, semantics } from '@concrnt/worldlib'
import type { Theme } from '../types/Theme'

export const THEME_SCHEMA = 'https://schema.concrnt.world/s/theme.json'

export const themeDocumentUri = (client: Client, title: string) => {
    const hash = CDID.newFromStringX(title)
    return `${semantics.themes(client.ccid)}/${hash}`
}

export const ensureThemeList = async (client: Client): Promise<void> => {
    const uri = semantics.themes(client.ccid)
    const existing = await client.getList(uri)

    if (existing) {
        return
    }

    const document: Document<ListSchema> = {
        key: uri,
        schema: Schemas.list,
        value: {
            name: 'themes'
        },
        author: client.ccid,
        createdAt: new Date()
    }

    await client.api.commit(document)
}

export const loadCustomThemes = async (client: Client): Promise<Record<string, Theme>> => {
    await ensureThemeList(client)

    const docs = await client.api.query({
        prefix: `${semantics.themes(client.ccid)}/`,
        schema: THEME_SCHEMA,
        limit: 100
    })

    const themes: Record<string, Theme> = {}

    for (const sd of docs) {
        const doc = JSON.parse(sd.document) as Document<Theme>
        const theme = doc.value
        const name = theme.meta?.name
        if (!name) continue
        themes[name] = theme
    }

    return themes
}

export const saveCustomTheme = async (client: Client, theme: Theme): Promise<Theme> => {
    const title = theme.meta?.name?.trim()
    if (!title) {
        throw new Error('Theme title is required')
    }

    await ensureThemeList(client)

    const normalizedTheme: Theme = {
        ...theme,
        content: { ...theme.content },
        ui: { ...theme.ui },
        backdrop: { ...theme.backdrop },
        meta: {
            ...theme.meta,
            name: title
        }
    }

    const document: Document<Theme> = {
        key: themeDocumentUri(client, title),
        schema: THEME_SCHEMA,
        value: normalizedTheme,
        author: client.ccid,
        createdAt: new Date()
    }

    await client.api.commit(document)
    return normalizedTheme
}

export const deleteCustomTheme = async (client: Client, title: string): Promise<void> => {
    await client.api.delete(themeDocumentUri(client, title))
}
