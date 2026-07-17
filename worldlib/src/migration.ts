import { Api, RepositoryImportResult } from '@concrnt/client'

export interface MigrationPreparation {
    lines: string[] // import対象の行(再署名済み含む)。dumpの時系列順を保持する
    total: number // dumpに含まれていた行数
    resigned: number // none proofから再署名した行数
    skipped: string[] // 再署名できずスキップした行(他人がauthorのnone proofなど)
}

// dumpを走査し、自分がauthorのnone proof commit(v1→v2移行で投入されたもの)を
// 現在のsubkeyで署名し直す。documentIDはdocument文字列+createdAtから導出されるため、
// document文字列は一切変更せずproofだけ差し替える。
export const prepareRepositoryDump = async (api: Api, jsonl: string): Promise<MigrationPreparation> => {
    const ccid = api.authProvider.getCCID()
    const lines = jsonl.split('\n').filter((line) => line.trim() !== '')

    const prepared: string[] = []
    const skipped: string[] = []
    let resigned = 0

    for (const line of lines) {
        let sd: { document: string; proof?: { type?: string } }
        try {
            sd = JSON.parse(line)
        } catch (_e) {
            skipped.push(line)
            continue
        }

        if (sd.proof?.type !== 'none') {
            // 署名済みの行はそのまま通す(パースし直すと空白等が変わる恐れがある)
            prepared.push(line)
            continue
        }

        let author: string | undefined
        try {
            author = JSON.parse(sd.document).author
        } catch (_e) {
            author = undefined
        }
        if (author !== ccid) {
            skipped.push(line)
            continue
        }

        const [signature, keyid] = await api.authProvider.signSub(sd.document)
        prepared.push(
            JSON.stringify({
                document: sd.document,
                proof: {
                    type: 'concrnt-ecrecover-subkey',
                    signature,
                    key: `cckv://${ccid}/keys/${keyid}`
                }
            })
        )
        resigned++
    }

    return { lines: prepared, total: lines.length, resigned, skipped }
}

export interface ImportProgress {
    totalChunks: number
    doneChunks: number
    importedLines: number
    failures: RepositoryImportResult[]
}

// 時系列順を保つ必要があるため、チャンクは並列化せず逐次POSTする。
// サーバーは失敗した行だけを返すので、返却値は全チャンクの失敗行の集約。
export const importRepositoryDump = async (
    api: Api,
    host: string,
    lines: string[],
    opts?: { chunkSize?: number; onProgress?: (progress: ImportProgress) => void }
): Promise<RepositoryImportResult[]> => {
    const chunkSize = opts?.chunkSize ?? 200
    const chunks: string[][] = []
    for (let i = 0; i < lines.length; i += chunkSize) {
        chunks.push(lines.slice(i, i + chunkSize))
    }

    const failures: RepositoryImportResult[] = []
    let importedLines = 0

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const results = await api.importRepository(chunk.join('\n'), host)
        failures.push(...results)
        importedLines += chunk.length - results.length

        opts?.onProgress?.({
            totalChunks: chunks.length,
            doneChunks: i + 1,
            importedLines,
            failures
        })
    }

    return failures
}
