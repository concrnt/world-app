import { useState } from 'react'
import { TimelinePicker } from '../components/TimelinePicker'
import { View, Button } from '@concrnt/ui'
import { Header } from '../ui/Header'
import { Reorder, useDragControls } from 'motion/react'
import { useSelect } from '../contexts/Select'
import { useDrawer } from '../contexts/Drawer'
import { CssVar } from '../types/Theme'
import { useScanner } from '../contexts/Scanner'

export const DevView = () => {
    const [selected, setSelected] = useState<string[]>(['1'])

    const [items, setItems] = useState([0, 1, 2, 3])

    const controls = useDragControls()
    const { scan } = useScanner()

    const { select } = useSelect()
    const { open } = useDrawer()

    return (
        <View>
            <Header>Devtools</Header>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2),
                    flex: 1,
                    overflowY: 'auto'
                }}
            >
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

                <Button
                    onClick={() => {
                        scan()
                    }}
                >
                    Scan
                </Button>

                <Button
                    onClick={() => {
                        select(
                            'Choose an option',
                            {
                                option1: 'Option 1',
                                option2: 'Option 2',
                                option3: 'Option 3'
                            },
                            (selected) => {
                                console.log('Selected:', selected)
                            }
                        )
                    }}
                >
                    Open Select
                </Button>
                <Button
                    onClick={() => {
                        open(<div style={{ padding: 20 }}>This is a drawer content</div>)
                    }}
                >
                    Open Drawer
                </Button>
                <Reorder.Group values={items} onReorder={setItems}>
                    {items.map((item) => (
                        <Reorder.Item
                            key={item}
                            value={item}
                            style={{
                                padding: CssVar.space(4),
                                backgroundColor: CssVar.contentBackground,
                                borderRadius: CssVar.round(1),
                                border: `1px solid ${CssVar.divider}`,
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
                                    backgroundColor: CssVar.divider,
                                    borderRadius: CssVar.round(0.5),
                                    cursor: 'grab'
                                }}
                                onPointerDown={(e) => controls.start(e)}
                            />
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </div>
        </View>
    )
}
