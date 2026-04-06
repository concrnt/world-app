import { Text, Button } from "@concrnt/ui"
import { useClient } from "../contexts/Client"

export const Settings = () => {

    const { client } = useClient()

    return <div>
        <Text variant="h1">設定</Text>

        { client.ccid }

        <Button
            onClick={() => {
                localStorage.clear()
                location.reload()
            }}
        >
            ログアウト
        </Button>

    </div>
}

