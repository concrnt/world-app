import { Activity } from "react";
import { useClient } from "./contexts/Client";
import { WelcomeView } from "./views/Welcome";
import { HomeView } from "./views/Home";

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
        <Activity mode={client.uninitialized === true ? "visible" : "hidden"}>
            <WelcomeView />
        </Activity>
        <Activity mode={client.client ? "visible" : "hidden"}>
            <HomeView />
        </Activity>
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
