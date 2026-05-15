import { UserPicker } from '../UserPicker'
import type { WidgetProps } from '@rjsf/utils'

export const UserPickerWidget = (props: WidgetProps) => {
    return <UserPicker selected={props.value} setSelected={(user) => props.onChange(user)} />
}
