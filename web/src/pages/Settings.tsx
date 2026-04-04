import { Text, Button } from "@concrnt/ui"

export const Settings = () => {

    return <div>
        <Text variant="h1">設定</Text>

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

