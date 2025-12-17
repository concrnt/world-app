import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [authState, setAuthState] = useState("");
  const [secret, setSecret] = useState("");
  const [revealed, setRevealed] = useState("");

  return (
    <main className="container">
      <h1>Welcome to Tauri + React dayo</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <hr/>
      <p>Authentication State: {authState}</p>
      <button onClick={async () => {
        const state = await invoke<string>("auth_available");
        setAuthState(state);
      }}>Get Auth State</button>
      <hr />

      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await invoke<string>("save_key", {key: "my_key", "value": secret});
          setRevealed(result);
        }}
      >
        <input
          id="secret-input"
          onChange={(e) => setSecret(e.currentTarget.value)}
          placeholder="Enter a secret..."
        />
        <button type="submit">Save Secret</button>
      </form>

      <hr />

      <button onClick={async () => {
        const secret = await invoke<string>("get_key", {key: "my_key"});
        setRevealed(secret);
      }}>Reveal Secret</button>

      <p>Revealed Secret: {revealed}</p>

    </main>
  );
}

export default App;
