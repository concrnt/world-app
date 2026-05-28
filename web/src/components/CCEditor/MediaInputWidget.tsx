import type { WidgetProps } from '@rjsf/utils'
import { ImageUploader } from '../ImageUploader'

export const MediaInputWidget = (props: WidgetProps) => {
    return (
        <ImageUploader
            src={props.value}
            onChange={(value) => {
                props.onChange(value)
            }}
        />
    )
}
