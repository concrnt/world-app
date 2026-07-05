import { Button, Text } from '@concrnt/ui'
import { useClient } from '../contexts/Client'

// ホームサーバーがオフラインのとき(読み取り専用モード)に表示する帯
export const DomainOfflineBanner = () => {
    const { client, isDomainOffline, domainRecovered, reload } = useClient()

    if (!isDomainOffline) return null

    return (
        <div
            style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: domainRecovered ? '#2e7d32' : '#d32f2f',
                color: '#ffffff',
                paddingTop: 'calc(env(safe-area-inset-top) + 6px)',
                paddingBottom: '6px',
                paddingLeft: '8px',
                paddingRight: '8px',
                textAlign: 'center',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
            }}
        >
            {domainRecovered ? (
                <>
                    <Text variant="caption" style={{ color: '#ffffff', margin: 0 }}>
                        サーバーが復旧しました
                    </Text>
                    <Button
                        variant="text"
                        style={{ color: '#ffffff', minHeight: 0, padding: '2px 8px' }}
                        onClick={() => {
                            reload()
                        }}
                    >
                        再接続
                    </Button>
                </>
            ) : (
                <Text variant="caption" style={{ color: '#ffffff', margin: 0 }}>
                    あなたのドメイン{client.api.defaultHost}
                    は現在オフラインのため、読み取り専用モードです。復旧までしばらくお待ちください。
                </Text>
            )}
        </div>
    )
}
