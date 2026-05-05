import { Document } from '@concrnt/client'
import { ProfileSchema } from '@concrnt/worldlib'
import { isRestrictedProfile } from '../utils/policy'

import { MdLock } from 'react-icons/md'
import { LuShieldQuestion } from 'react-icons/lu'
import { CssVar } from '@concrnt/ui'

interface Props {
    document?: Document<ProfileSchema> | null
}

export const ProfileName = (props: Props) => {
    if (!props.document) {
        return <>Anonymous</>
    }

    const restriction = isRestrictedProfile(props.document)

    return (
        <span
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: CssVar.space(1)
            }}
        >
            {props.document.value.username ?? 'Anonymous'}
            {restriction === undefined ? (
                <LuShieldQuestion size={20} />
            ) : restriction === true ? (
                <MdLock size={20} />
            ) : null}
        </span>
    )
}
