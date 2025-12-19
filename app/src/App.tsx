import { useClient } from "./contexts/Client";
import { WelcomeView } from "./views/Welcome";
import { MainView } from "./views/Main";

function App() {

    const client = useClient();

    return <div
        style={{ 
            width: "100vw",
            height: "100dvh",
            position: "relative",
            overflow: "hidden",
        }}
    >

        {client.uninitialized === true && <WelcomeView /> }
        {client.client && <MainView /> }

        <div
            style={{
                width: "100vw",
                height: "100dvh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "absolute",
                top: 0,
                left: 0,
                backgroundColor: "#fff",
                zIndex: -1,
            }}
        >
            ~ background ~
        </div>

    </div>
}

export default App;
