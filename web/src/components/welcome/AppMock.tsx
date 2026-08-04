import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Divider, Tab, Tabs, Text } from '@concrnt/ui'
import { MdList } from 'react-icons/md'
import { CssVar } from '../../types/Theme'
import { DummyMessage } from './DummyMessage'

// welcomeページ用のデモタイムライン。5秒ごとにタブが自動で切り替わる
export const AppMock = () => {
    const [tab, setTab] = useState(0)
    const { t } = useTranslation('', { keyPrefix: 'web.welcome.mock' })

    const mockData = [
        {
            title: t('home.title'),
            timeline: [
                { username: 'solitudeSam', body: t('home.crnt1') },
                { username: 'geekyTom', body: t('home.crnt2') },
                { username: 'cozyCara', body: t('home.crnt3') },
                { username: 'bookwormLiz', body: t('home.crnt4') },
                { username: 'geekyTom', body: t('home.crnt5') }
            ]
        },
        {
            title: t('game.title'),
            timeline: [
                { username: 'MechaMaster88', body: t('game.crnt1') },
                { username: 'CtrlAltDefeat_', body: t('game.crnt2') },
                { username: 'GamerGalaxy_', body: t('game.crnt3') },
                { username: 'retroReveler', body: t('game.crnt4') },
                { username: 'bitBard', body: t('game.crnt5') }
            ]
        },
        {
            title: t('food.title'),
            timeline: [
                { username: 'TofuTribe', body: t('food.crnt1') },
                { username: 'SpiceSeeker_', body: t('food.crnt2') },
                { username: 'NoodleNomad', body: t('food.crnt3') },
                { username: 'BrewedLife', body: t('food.crnt4') },
                { username: 'CrispyCritic_', body: t('food.crnt5') }
            ]
        }
    ]

    const data = mockData[tab]

    useEffect(() => {
        const interval = setInterval(() => {
            setTab((tab) => (tab + 1) % 3)
        }, 5000)
        return () => {
            clearInterval(interval)
        }
    }, [])

    return (
        <div
            style={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: CssVar.round(2),
                overflow: 'hidden',
                backgroundColor: CssVar.contentBackground,
                boxShadow:
                    '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: CssVar.space(1),
                    padding: `${CssVar.space(2)} ${CssVar.space(2)}`,
                    backgroundColor: CssVar.uiBackground,
                    color: CssVar.uiText
                }}
            >
                <MdList size={20} />
                <Text
                    style={{
                        color: CssVar.uiText,
                        fontWeight: 600
                    }}
                >
                    {data.title}
                </Text>
            </div>
            <Tabs>
                {mockData.map((e, i) => (
                    <Tab
                        key={i}
                        selected={tab === i}
                        groupId="welcome-appmock"
                        onClick={() => setTab(i)}
                        style={{ color: CssVar.contentText }}
                    >
                        <Text style={{ fontWeight: 600 }}>{e.title}</Text>
                    </Tab>
                ))}
            </Tabs>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: CssVar.space(2),
                    padding: CssVar.space(2),
                    height: '400px',
                    overflowY: 'auto'
                }}
            >
                {data.timeline.map((message, i) => (
                    <Fragment key={i}>
                        <DummyMessage dummyId={message.username} username={message.username} body={message.body} />
                        <Divider style={{ margin: 0 }} />
                    </Fragment>
                ))}
            </div>
        </div>
    )
}
