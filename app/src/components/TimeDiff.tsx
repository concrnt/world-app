import { ReactNode } from 'react'
import { humanReadableTimeDiff } from '../utils/humanReadableTimeDiff'
import { useTicker } from '../contexts/Ticer'
import { Text } from '@concrnt/ui'

export interface TimeDiffProps {
    date: Date
    base?: Date
}

// 1 hour
const threshold = 60 * 60 * 1000

export const TimeDiff = (props: TimeDiffProps): ReactNode => {
    useTicker()

    const diff = props.base ? Math.abs(props.date.getTime() - props.base.getTime()) : 0
    const diffTooLong = diff > threshold

    return (
        <Text
            variant="caption"
            style={{
                fontSize: '0.8rem'
            }}
        >
            {diffTooLong && '?'}
            {humanReadableTimeDiff(props.date)}
        </Text>
    )
}
