import { useTheme } from '../contexts/Theme'

export const Divider = () => {
    const theme = useTheme()

    return (
        <hr
            style={{
                border: 'none',
                borderTop: `1px solid ${theme.divider}`
            }}
        />
    )
}
