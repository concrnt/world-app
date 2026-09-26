/// <reference types="vite/client" />
/// <reference types="unplugin-info/client" />

interface ImportMetaEnv {
    readonly VITE_ETH_RPC_URL?: string
    readonly VITE_TIPSPLITTER_ADDRESS?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
