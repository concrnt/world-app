import { useClient } from './contexts/Client'
import { WelcomeView } from './views/Welcome'
import { MainView } from './views/Main'
import { useEffect } from 'react'

function App() {
    // ios safari scroll fix
    useEffect(() => {
        const preventScroll = () => {
            document.documentElement.scrollTop = 0
        }
        document.addEventListener('scroll', preventScroll, { passive: false })

        return () => {
            document.removeEventListener('scroll', preventScroll)
        }
    }, [])

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

            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    backgroundColor: '#fff',
                    zIndex: -1
                }}
            >
                ~ background ~
            </div>
        </div>
    )
}

export default App
