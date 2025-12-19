import { Button } from "../ui/Button";
import { Text } from "../ui/Text";

import ConcrntLogo from "/concrnt.svg";
import { useClient } from "../contexts/Client";

export const WelcomeView = () => {

    const { initialize } = useClient();

    return (
        <div
            style={{
                width: '100vw',
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                backgroundColor: '#fff',
            }}
        >

            <img src={ConcrntLogo} alt="Concrnt Logo" style={{ width: '150px', height: '150px' }} />
            
            <Text>ようこそ</Text>

            <Button
                onClick={() => {
                    initialize();
                }}
            >
                はじめる
            </Button>

            <Button
                variant="text"
            >
                ログイン
            </Button>

        </div>
    )
}

