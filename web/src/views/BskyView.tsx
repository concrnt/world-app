import { useEffect, useState } from 'react'
import { useClient } from '../contexts/Client'
import { View } from '../components/View'
import { BskyPost } from './BskyPost'
import { BskyPerson } from './BskyPerson'
import { BskyPostView, BskyProfile } from '../utils/bluesky'

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
            client.api
                .callConcrntApi<BskyPostView>(client.server.domain, 'world.concrnt.atproto.resolve', {
                    uri: props.uri
                })
                .then((res) => setResult({ uri: props.uri, post: res }))
                .catch((err) => {
                    console.log(err)
                    setResult({ uri: props.uri, error: String(err) })
                })
        } else {
            client.api
                .callConcrntApi<BskyProfile>(client.server.domain, 'world.concrnt.atproto.resolveActor', {
                    target: props.uri
                })
                .then((res) => setResult({ uri: props.uri, person: res }))
                .catch((err) => {
                    console.log(err)
                    setResult({ uri: props.uri, error: String(err) })
                })
        }
    }, [props.uri, client, isPost])

    const current = result?.uri === props.uri ? result : undefined

    if (current?.error) {
        return (
            <View>
                <p>Not found: {props.uri}</p>
            </View>
        )
    }

    if (current?.post) return <BskyPost post={current.post} />
    if (current?.person) return <BskyPerson person={current.person} />

    return <View></View>
}
