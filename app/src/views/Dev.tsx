import { useState } from 'react'
import { TimelinePicker } from '../components/TimelinePicker'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'

export const DevView = () => {
    const [selected, setSelected] = useState<string[]>(['1'])
    const { open } = useSidebar()

    return (
        <View>
            <Header
                left={
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                        onClick={() => open()}
                    >
                        <MdMenu size={24} />
                    </div>
                }
            >
                Devtools
            </Header>
            <div>
                <TimelinePicker
                    items={[
                        { id: '1', label: 'Item 1' },
                        { id: '2', label: 'Item 2' },
                        { id: '3', label: 'Item 3' }
                    ]}
                    selected={selected}
                    setSelected={setSelected}
                    keyFunc={(item) => item.id}
                    labelFunc={(item) => item.label}
                />
            </div>
        </View>
    )
}
