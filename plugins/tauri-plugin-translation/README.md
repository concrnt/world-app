# tauri-plugin-translation

投稿本文のオンデバイス翻訳と言語検知(iOS: Apple Translation framework + NaturalLanguage / Android: ML Kit Translation + Language ID)。
WebViewには翻訳APIが無い(Chrome内蔵のTranslator APIはモバイルWebView非対応)ので、アプリ版はこのpluginを使う。
iOS 18〜25では `TranslationSession` がSwiftUIの `translationTask` 経由でしか得られないため、1x1の非表示SwiftUIビューを常駐させて翻訳を回している。
