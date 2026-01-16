import { useState } from 'react'
import { TimelinePicker } from '../components/TimelinePicker'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { MdMenu } from 'react-icons/md'
import { useSidebar } from '../layouts/Sidebar'
import { Reorder, useDragControls } from 'motion/react'

export const DevView = () => {
    const [selected, setSelected] = useState<string[]>(['1'])
    const { open } = useSidebar()

    const [items, setItems] = useState([0, 1, 2, 3])

    const controls = useDragControls()

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
            <Reorder.Group values={items} onReorder={setItems}>
                {items.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        style={{
                            padding: 20,
                            margin: 10,
                            backgroundColor: '#eee',
                            borderRadius: 5,
                            cursor: 'grab',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                        dragListener={false}
                        dragControls={controls}
                    >
                        Item {item}
                        <div
                            style={{
                                width: 20,
                                height: 20,
                                backgroundColor: '#ccc',
                                borderRadius: 3,
                                marginTop: 10,
                                cursor: 'grab'
                            }}
                            onPointerDown={(e) => controls.start(e)}
                        />
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </View>
    )
}
