import { Avatar, Text } from "@concrnt/ui"
import { useClient } from "../contexts/Client"




export const Sidebar = () => {

    const { client } = useClient()

    return <div
    >
        <div>
            <Avatar ccid={client?.ccid || ''} src={client?.user?.profile.avatar} />
            <Text variant="h2">{client?.user?.profile.username || 'Unknown User'}</Text>
            <Text variant="caption">{client?.server.domain || 'Unknown Server'}</Text>
        </div>
    </div>

}


