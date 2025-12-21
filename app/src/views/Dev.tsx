import { Text } from "../ui/Text";

export const DevView = () => {

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                backgroundColor: '#fff',
            }}
        >
            <Text>
                Devtools
            </Text>

        </div>
    )
}
