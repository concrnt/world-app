import { Message, RerouteMessageSchema } from '@concrnt/worldlib'

export interface MessageProps<T> {
    message: Message<T>
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
    lastUpdated?: number
    forceExpanded?: boolean
    rerouted?: Message<RerouteMessageSchema>
}
