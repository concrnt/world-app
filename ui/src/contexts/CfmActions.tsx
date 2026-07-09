import { createContext, type ReactNode, useContext } from 'react'
import type { Theme } from '../types/Theme'

// Bridge for actions that CfmRenderer (in @concrnt/ui) needs but that live in the
// app layer (theme library, media viewer, user chips, ...). The app wraps its tree
// with CfmActionsProvider; unset actions simply no-op.
export interface CfmActions {
    importTheme?: (theme: Theme) => void
}

const CfmActionsContext = createContext<CfmActions>({})

export const CfmActionsProvider = (props: { value: CfmActions; children: ReactNode }) => {
    return <CfmActionsContext.Provider value={props.value}>{props.children}</CfmActionsContext.Provider>
}

export const useCfmActions = (): CfmActions => {
    return useContext(CfmActionsContext)
}
