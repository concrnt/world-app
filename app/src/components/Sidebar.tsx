import { useTheme } from '../contexts/Theme'

export const Sidebar = () => {
    const theme = useTheme()

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: theme.ui.background,
                color: theme.ui.text,
                display: 'flex',
                padding: '16px'
            }}
        >
            hogehoge
        </div>
    )
}
