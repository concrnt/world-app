import type { ReactNode } from "react"
import { useClient } from "./contexts/Client"
import { Navigate, useLocation } from "react-router-dom"


interface Props {
    children: ReactNode
    redirect: string
}


export const LoginGuard = (props: Props) => {

    const { client } = useClient()

    if (!client?.api.authProvider.canSignMaster && !client?.api.authProvider.canSignSub) {
        return <Navigate to={props.redirect} state={{ from: useLocation() }} replace={true} />
    }

    return props.children
}


