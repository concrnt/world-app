import { MainView } from './views/Main'
import { DomainOfflineBanner } from './components/DomainOfflineBanner'
import { AccountSwitchingBanner } from './components/AccountSwitchingBanner'
import { useClient } from './contexts/Client'

function App() {
    const { client } = useClient()

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            <AccountSwitchingBanner />
            <DomainOfflineBanner />
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* client(≒プロフィール)が変わったらメインビュー群をまるごと作り直し、
                    ナビスタックやタブ選択などの古いプロフィール由来のstateを持ち越さない */}
                <MainView key={`${client.ccid}:${client.currentProfile}`} />
            </div>
        </div>
    )
}

export default App
