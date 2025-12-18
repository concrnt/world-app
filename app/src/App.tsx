import { Activity } from "react";
import { useClient } from "./contexts/Client";
import { WelcomeView } from "./views/Welcome";
import { HomeView } from "./views/Home";

function App() {

    const client = useClient();

    return <>
        <Activity mode={client.uninitialized === true ? "visible" : "hidden"}>
            <WelcomeView />
        </Activity>
        <Activity mode={client.client ? "visible" : "hidden"}>
            <HomeView />
        </Activity>
        <div
            style={{
                width: "100vw",
                height: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            ~ background ~
        </div>
    </>

}

export default App;
