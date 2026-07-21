import { useTranslation } from 'react-i18next'
import { AuthScreen, AuthBrand, AuthHeader } from './authLayout'

/**
 * Hard block shown when the Declared Age Range API reports the user is under 13.
 * Intentionally offers no way forward — no onboarding, no account creation.
 */
export const AgeBlocked = () => {
    const { t } = useTranslation('', { keyPrefix: 'views.ageBlocked' })

    return (
        <AuthScreen>
            <AuthBrand />
            <AuthHeader
                title={t('title')}
                description={t('description')
                    .split('\n')
                    .map((line, i) => (
                        <span key={i}>
                            {line}
                            <br />
                        </span>
                    ))}
            />
        </AuthScreen>
    )
}
