import { Activity, createContext, useContext } from 'react'

type ActivityContextState = 'visible' | 'hidden'

interface Props {
    mode: 'visible' | 'hidden'
    children: React.ReactNode
}

const ActivityContext = createContext<ActivityContextState>('visible')

export const ActivityProvider = (props: Props) => {
    return (
        <ActivityContext.Provider value={props.mode}>
            <Activity mode={props.mode}>{props.children}</Activity>
        </ActivityContext.Provider>
    )
}

export const useActivity = () => {
    return useContext(ActivityContext)
}
