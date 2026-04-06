/**
 * Haptic feedback ユーティリティ
 *
 * Tauri の haptics プラグインをラップし、プラグインが存在しない環境
 * （デスクトップ、ブラウザ）でも安全に呼び出せるようにする。
 */

import { impactFeedback, notificationFeedback, selectionFeedback } from '@tauri-apps/plugin-haptics'

/** 軽いタップフィードバック（ファボ、リアクションなど） */
export const hapticLight = () => {
    impactFeedback('light').catch(() => {})
}

/** 成功フィードバック（投稿完了、リプライ完了など） */
export const hapticSuccess = () => {
    notificationFeedback('success').catch(() => {})
}

/** セレクションフィードバック（PTR の閾値超えなど） */
export const hapticSelection = () => {
    selectionFeedback().catch(() => {})
}
