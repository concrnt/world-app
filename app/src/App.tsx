import { useClient } from './contexts/Client'
import { WelcomeView } from './views/Welcome'
import { MainView } from './views/Main'

function App() {
    const client = useClient()

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {client.uninitialized === true && <WelcomeView />}
            {client.client && <MainView />}
        </div>
    )
}

export default App
