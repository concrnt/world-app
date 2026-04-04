import { Message } from '@concrnt/worldlib'

export interface MessageProps<T> {
    message: Message<T>
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
    lastUpdated?: number
}
