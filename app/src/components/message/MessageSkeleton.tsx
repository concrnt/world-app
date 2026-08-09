import { Skeleton } from '@concrnt/ui'
import { MessageLayout } from './MessageLayout'

export const MessageSkeleton = () => {
    return (
        <MessageLayout
            left={
                <Skeleton
                    style={{
                        width: '40px',
                        height: '40px'
                    }}
                />
            }
            headerLeft={
                <Skeleton
                    style={{
                        height: '1rem'
                    }}
                />
            }
        >
            <Skeleton
                style={{
                    height: '3rem'
                }}
            />
        </MessageLayout>
    )
}
