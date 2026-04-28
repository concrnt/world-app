import { Avatar, Text } from "@concrnt/ui"
import { useClient } from "../contexts/Client"
import { Link } from "react-router-dom"

export const Sidebar = () => {

    const { client } = useClient()

    return <div>
        <div>
            <Avatar ccid={client.ccid || ''} src={client.profile.avatar} />
            <Text variant="h2">{client.profile.username || 'Unknown User'}</Text>
            <Text variant="caption">{client.server.domain || 'Unknown Server'}</Text>
        </div>
        <hr/>
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Link
                to="/"
            >Home</Link>
            <Link
                to="/explorer"
            >Explorer</Link>
            <Link
                to="/settings"
            >Settings</Link>
        </div>
        <hr/>
    </div>
}

