import { useEffect, useState, type ReactNode } from 'react'
import { checkAgeGate } from '../lib/ageverify'
import { AgeBlocked } from '../views/AgeBlocked'
import { LoadingFull } from '../components/LoadingFull'

type GateState = 'checking' | 'passed' | 'blocked'

/**
 * App-level age gate. Runs once at launch, before onboarding, and renders a
 * hard block screen for users the Declared Age Range API reports as under 13.
 * Everyone else (including non-iOS platforms and users who decline sharing)
 * passes through to `children`.
 */
export const AgeGateProvider = (props: { children: ReactNode }) => {
    const [state, setState] = useState<GateState>('checking')

    useEffect(() => {
        let cancelled = false
        checkAgeGate()
            .then((ok) => {
                if (!cancelled) setState(ok ? 'passed' : 'blocked')
            })
            .catch(() => {
                // Never lock users out on an unexpected error.
                if (!cancelled) setState('passed')
            })
        return () => {
            cancelled = true
        }
    }, [])

    if (state === 'checking') return <LoadingFull />
    if (state === 'blocked') return <AgeBlocked />
    return <>{props.children}</>
}
