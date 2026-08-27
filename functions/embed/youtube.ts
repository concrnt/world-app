// YouTube埋め込みラッパー (Cloudflare Pages Functions)
// iOS版TauriアプリはページがtauriスキームオリジンのためYouTube埋め込みが
// referrer不正(Error 153)で再生できない。httpsオリジンのこのページを
// アプリ側がiframeで読み込むことで、YouTube iframeに正当なreferrerを付ける。
//   /embed/youtube?v=<videoId>

export const onRequest: PagesFunction = (context) => {
    const url = new URL(context.request.url)
    const videoId = url.searchParams.get('v') ?? ''
    if (!/^[a-zA-Z0-9_-]+$/.test(videoId)) return new Response('bad request', { status: 400 })

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
      iframe { width: 100%; height: 100%; border: none; }
    </style>
  </head>
  <body>
    <iframe
      src="https://www.youtube.com/embed/${videoId}?playsinline=1"
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen>
    </iframe>
  </body>
</html>
`

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400'
        }
    })
}
