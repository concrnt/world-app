import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { TimelineView } from '../views/Timeline'
import { View } from '../ui/View'
import { Header } from '../ui/Header'
import { useSidebar } from '../layouts/Sidebar'
import { MdMenu } from 'react-icons/md'
import { useStack } from '../layouts/Stack'
import { useState } from 'react'

export const QueryView = () => {
    const { open } = useSidebar()
    const { push } = useStack()

    const [query, setQuery] = useState('')

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
                照会
            </Header>
            <div>
                <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="cc://" />
                <Button
                    onClick={() => {
                        push?.(<TimelineView uri={query} />)
                    }}
                >
                    照会
                </Button>
            </div>
        </View>
    )
}
