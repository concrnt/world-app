export const fetchWithTimeout = async (
    url: string,
    init: RequestInit,
    timeoutMs = 10 * 1000
): Promise<Response> => {
    const controller = new AbortController()
    const clientTimeout = setTimeout(() => {
        controller.abort()
    }, timeoutMs)

    const reqConfig: RequestInit = { ...init, signal: controller.signal }
    return await fetch(url, reqConfig)
        .then((res) => {
            return res
        })
        .finally(() => {
            clearTimeout(clientTimeout)
        })
}
