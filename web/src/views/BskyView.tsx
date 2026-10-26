import { useEffect, useState } from 'react'
import { useClient } from '../contexts/Client'
import { View } from '../components/View'
import { BskyPost } from './BskyPost'
import { BskyPerson } from './BskyPerson'
import { BskyPostView, BskyProfile, resolveBskyActor, resolveBskyPost } from '../utils/bluesky'

interface Props {
    uri: string
}

interface ResolveResult {
    uri: string
    post?: BskyPostView
    person?: BskyProfile
    error?: string
}

export const BskyView = (props: Props) => {
    const { client } = useClient()
    const [result, setResult] = useState<ResolveResult>()

    const isPost = props.uri.startsWith('at://')

    useEffect(() => {
        if (isPost) {
            // 負キャッシュ(404済み)はnullで返るので初回404と同じく未解決扱いにする
            resolveBskyPost(client, props.uri)
                .then((res) => setResult(res ? { uri: props.uri, post: res } : { uri: props.uri, error: 'not found' }))
                .catch((err) => {
                    console.log(err)
                    setResult({ uri: props.uri, error: String(err) })
                })
        } else {
            resolveBskyActor(client, props.uri)
                .then((res) =>
                    setResult(res ? { uri: props.uri, person: res } : { uri: props.uri, error: 'not found' })
                )
                .catch((err) => {
                    console.log(err)
                    setResult({ uri: props.uri, error: String(err) })
                })
        }
    }, [props.uri, client, isPost])

    const current = result?.uri === props.uri ? result : undefined

    // 投稿はブリッジで解決できなくても BlueskyRecord 側で未取得表示+bsky.appへの導線を出す
    if (isPost && (current?.post || current?.error)) return <BskyPost uri={props.uri} post={current.post} />

    if (current?.error) {
        return (
            <View>
                <p>Not found: {props.uri}</p>
            </View>
        )
    }

    if (current?.person) return <BskyPerson person={current.person} />

    return <View></View>
}
