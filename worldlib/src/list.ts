import { CDID, Document, FetchOptions, ServerOfflineError, SignedDocument } from '@concrnt/client'
import { Client } from './client'
import { ListSchema } from './schemas/list'
import { CachedPromise } from './cachedPromise'

export interface ListEntry {
    key: string // 実際に格納されているKVキー
    value?: any // ドキュメントのvalue (パース不能ならundefined)。参照なら { href, schema }
}

export class List {
    client: Client
    uri: string

    title: string
    iconURL?: string

    toJSON() {
        return {
            uri: this.uri,
            title: this.title,
            iconURL: this.iconURL
        }
    }

    // ホームの描画経路なのでキャッシュ即返し(裏で再取得)。fresh=trueは変更直後や復帰時の取り直し用。
    // isEqualは必須: 内容が同じ新配列をpushすると利用側のtimelines memoが変わってreaderが作り直される
    items = new CachedPromise<string[]>(
        async (fresh) => {
            const prefix = this.uri.endsWith('/') ? this.uri : this.uri + '/'
            // オフラインでキャッシュも無い初回取得は空で確定させ、ホーム(自分のhome-timelineだけ)は表示できるようにする。
            // 復帰時のrefresh()で実際の中身に置き換わる。refresh(fresh)の失敗はrejectさせて既存値を維持する
            // (空をpushするとタイムライン構成が変わってreaderが作り直される)
            const items = await this.client.api
                .queryAll(
                    {
                        prefix
                    },
                    undefined,
                    { cache: fresh ? 'no-cache' : 'swr' }
                )
                .catch((err) => {
                    if (!fresh && err instanceof ServerOfflineError) return [] as SignedDocument[]
                    throw err
                })

            const documents = items.map((i) => JSON.parse(i.document))
            return documents.map((d) => d.value.href)
        },
        (a, b) => JSON.stringify(a) === JSON.stringify(b)
    )

    entries = new CachedPromise<ListEntry[]>(async () => {
        const prefix = this.uri.endsWith('/') ? this.uri : this.uri + '/'
        const items = await this.client.api.queryAll(
            {
                prefix
            },
            undefined,
            { cache: true }
        )

        return items.map((sd) => {
            const key = sd.cckv ?? sd.ccfs
            let value: any
            try {
                value = JSON.parse(sd.document).value
            } catch {
                value = undefined
            }
            return { key, value }
        })
    })

    constructor(client: Client, uri: string, title: string, iconURL?: string) {
        this.client = client
        this.uri = uri
        this.title = title
        this.iconURL = iconURL
    }

    static async load(
        client: Client,
        uri: string,
        hint?: string,
        opts?: FetchOptions<SignedDocument>
    ): Promise<List | null> {
        const res = await client.api.getDocument<ListSchema>(uri, hint, opts)
        if (!res) {
            return null
        }
        const list = new List(client, uri, res.value.name, res.value.iconURL)

        return list
    }

    static async loadFromSD(client: Client, sd: SignedDocument): Promise<List> {
        const doc = JSON.parse(sd.document)
        const list = new List(client, sd.cckv ?? sd.ccfs, doc.value.name, doc.value.iconURL)

        return list
    }

    async addItem(client: Client, item: string, schema?: string): Promise<void> {
        if (!schema) {
            const target = await client.api.getDocument(item)
            schema = target.schema
        }

        const hash = CDID.newFromStringX(item)

        let key = this.uri
        if (!key.endsWith('/')) {
            key += '/'
        }
        key += hash

        const document: Document<any> = {
            kind: 'record',
            key: key,
            author: client.ccid,
            schema: 'https://schema.concrnt.net/reference.json',
            value: {
                href: item,
                schema: schema
            },
            createdAt: new Date()
        }

        await client.api.commit(document)
        // itemsはキャッシュ即返しなのでreload()だと古い一覧を先に返す。ネットワークから取り直してpushする
        await this.items.refresh()
        this.entries.reload()
        client.knownCommunities.refresh()
    }

    async removeItem(client: Client, item: string): Promise<void> {
        const hash = CDID.newFromStringX(item)

        let key = this.uri
        if (!key.endsWith('/')) {
            key += '/'
        }
        key += hash

        await client.api.delete(key)
        await this.items.refresh()
        this.entries.reload()
        client.knownCommunities.refresh()
    }
}
