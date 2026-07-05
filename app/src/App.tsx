import { MainView } from './views/Main'
import { DomainOfflineBanner } from './components/DomainOfflineBanner'

function App() {
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
            <DomainOfflineBanner />
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <MainView />
            </div>
        </div>
    )
}

export default App
