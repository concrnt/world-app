import i18n from '../i18n'

const nowEpsilon = 3000 // 3 seconds

export const humanReadableTimeDiff = (time: Date): string => {
    const current = new Date()
    const msPerMinute = 60 * 1000
    const msPerHour = msPerMinute * 60
    const msPerDay = msPerHour * 24

    const elapsed = current.getTime() - time.getTime()

    if (Math.abs(elapsed) < nowEpsilon) {
        return i18n.t('utils.humanReadableTimeDiff.justNow')
    }

    const suffix = elapsed < 0 ? 'Later' : 'Ago'

    if (elapsed < msPerMinute) {
        return i18n.t(`utils.humanReadableTimeDiff.seconds${suffix}`, { n: Math.round(Math.abs(elapsed) / 1000) })
    } else if (elapsed < msPerHour) {
        return i18n.t(`utils.humanReadableTimeDiff.minutes${suffix}`, {
            n: Math.round(Math.abs(elapsed) / msPerMinute)
        })
    } else if (elapsed < msPerDay) {
        return i18n.t(`utils.humanReadableTimeDiff.hours${suffix}`, { n: Math.round(Math.abs(elapsed) / msPerHour) })
    } else {
        return (
            (current.getFullYear() === time.getFullYear() ? '' : `${time.getFullYear()}-`) +
            `${String(time.getMonth() + 1).padStart(2, '0')}-` +
            `${String(time.getDate()).padStart(2, '0')} ` +
            `${String(time.getHours()).padStart(2, '0')}:` +
            `${String(time.getMinutes()).padStart(2, '0')}`
        )
    }
}
