import assert from 'node:assert/strict'
import console from 'node:console'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { URL } from 'node:url'
import vm from 'node:vm'

const require = createRequire(new URL('../app/package.json', import.meta.url))
const ts = require('typescript')

// Run the actual attachment and upload code with media events controlled by the test.
// This covers the promise that submission awaits without operating a browser or device.
function createComposer(platform, { blobPending = false, hashPending = false } = {}) {
    const source = ts.createSourceFile(
        'Composer.tsx',
        readFileSync(new URL(`../${platform}/src/components/Composer.tsx`, import.meta.url), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    )
    const declarations = new Map()
    function visit(node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
            declarations.set(node.name.text, node.initializer.getText(source))
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    const videos = []
    const timers = new Map()
    const revoked = []
    let drafts = []
    const context = vm.createContext({
        props: { mode: 'normal' },
        editorMode: 'media',
        client: {},
        setUploadProgress: () => {},
        setMediaDrafts: (update) => {
            drafts = update(drafts)
        },
        uploadImage: async (_client, file) => [`uploaded:${file.name}`, file.type],
        computeBlurhash: async () => (hashPending ? new Promise(() => {}) : 'frame-hash'),
        URL: {
            createObjectURL: (file) => `blob:${file.name}`,
            revokeObjectURL: (url) => revoked.push(url)
        },
        window: {
            setTimeout: (callback, delay) => {
                const id = Symbol()
                timers.set(id, { callback, delay })
                return id
            },
            clearTimeout: (id) => timers.delete(id)
        },
        document: {
            createElement: (tag) => {
                if (tag === 'canvas') {
                    return {
                        getContext: () => ({ drawImage: () => {} }),
                        toDataURL: () => 'data:image/png;frame',
                        toBlob: (callback) => {
                            if (!blobPending) callback({ type: 'image/png' })
                        }
                    }
                }
                assert.equal(tag, 'video')
                let rejectPlay
                const video = {
                    videoWidth: 640,
                    videoHeight: 360,
                    playCalls: 0,
                    play() {
                        this.playCalls++
                        return new Promise((_resolve, reject) => {
                            rejectPlay = reject
                        })
                    },
                    rejectPlay() {
                        rejectPlay?.(new Error('Playback not allowed'))
                    },
                    pause() {
                        rejectPlay?.(Object.assign(new Error('Paused'), { name: 'AbortError' }))
                    },
                    removeAttribute(name) {
                        delete this[name]
                    },
                    load() {}
                }
                videos.push(video)
                return video
            }
        },
        console
    })
    const run = (code) =>
        vm.runInContext(
            ts.transpileModule(code, {
                compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
            }).outputText,
            context
        )
    for (const [name, value] of declarations) {
        if (name.endsWith('_TIMEOUT_MS')) run(`const ${name} = ${value}`)
    }
    const addFiles = run(`(${declarations.get('addFiles')})`)
    const upload = run(`async (mediaDrafts) => (${declarations.get('uploadedMedias')})`)
    return {
        videos,
        timers,
        revoked,
        add: (count = 1) =>
            addFiles(Array.from({ length: count }, (_, i) => ({ name: `${i}.mp4`, type: 'video/mp4' }))),
        upload: () => upload(drafts),
        drafts: () => drafts,
        expire() {
            for (const { callback, delay } of [...timers.values()]) {
                assert.ok(delay > 0 && delay <= 10_000, 'optional preview must finish within 10 seconds')
                callback()
            }
        }
    }
}

async function resultAfterMicrotasks(promise) {
    let result = 'pending'
    promise.then((value) => {
        result = value
    })
    await setImmediate()
    return result
}

for (const platform of ['app', 'web']) {
    test(`${platform}: absent media events cannot block a successful upload`, async () => {
        const composer = createComposer(platform)
        await composer.add()
        const posting = composer.upload()
        composer.expire()
        const result = await resultAfterMicrotasks(posting)
        assert.notEqual(result, 'pending')
        assert.equal(result[0].mediaURL, 'uploaded:0.mp4')
        assert.equal(result[0].blurhash, undefined)
        assert.deepEqual(composer.revoked, ['blob:0.mp4'])
        assert.equal(composer.videos[0].src, undefined)
        assert.equal(composer.timers.size, 0)
    })

    test(`${platform}: playback is requested and rejection does not block posting`, async () => {
        const composer = createComposer(platform)
        await composer.add()
        assert.equal(composer.videos[0].playCalls, 1)
        composer.videos[0].rejectPlay()
        assert.notEqual(await resultAfterMicrotasks(composer.upload()), 'pending')
        assert.equal(composer.timers.size, 0)
    })

    test(`${platform}: captured frames retain their hash when pausing aborts play`, async () => {
        const composer = createComposer(platform)
        await composer.add()
        await composer.videos[0].onloadeddata()
        const result = await resultAfterMicrotasks(composer.upload())
        assert.equal(result[0].blurhash, 'frame-hash')
        assert.equal(composer.drafts()[0].previewUrl, 'data:image/png;frame')
        assert.equal(composer.timers.size, 0)
    })

    for (const option of ['blobPending', 'hashPending']) {
        test(`${platform}: ${option} cannot block posting after a frame arrives`, async () => {
            const composer = createComposer(platform, { [option]: true })
            await composer.add()
            void composer.videos[0].onloadeddata()
            await setImmediate()
            const posting = composer.upload()
            composer.expire()
            assert.notEqual(await resultAfterMicrotasks(posting), 'pending')
            assert.equal(composer.timers.size, 0)
        })
    }

    test(`${platform}: one stalled video does not lose the other video's hash`, async () => {
        const composer = createComposer(platform)
        await composer.add(2)
        await composer.videos[0].onloadeddata()
        const posting = composer.upload()
        composer.expire()
        const result = await resultAfterMicrotasks(posting)
        assert.notEqual(result, 'pending')
        assert.equal(result.length, 2)
        assert.equal(result[0].blurhash, 'frame-hash')
        assert.equal(result[1].blurhash, undefined)
    })
}
