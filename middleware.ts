import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // アクセスされたURLのパスを取得（例: /アクリア・ホロプト）
  const path = request.nextUrl.pathname
  
  try {
    // URLエンコードされている場合があるのでデコードして確認
    const decodedPath = decodeURIComponent(path)

    // もしパスの中に「・（中点）」が含まれていたら
    if (decodedPath.includes('・')) {
      // 「・」を「-」に置き換える
      const newPath = decodedPath.replace(/・/g, '-')
      
      // 新しいURLを作成
      const url = request.nextUrl.clone()
      // エンコードし直してセット（NextResponseが適切に処理します）
      url.pathname = encodeURI(newPath)

      // 308 Permanent Redirect（恒久的な移動）として転送
      // これによりGoogleにも「今後はこっちが正しいURLだよ」と伝わります
      return NextResponse.redirect(url, 308)
    }
  } catch (e) {
    // デコードエラーなどは無視してそのまま通す
    console.error('Middleware error:', e)
  }

  // 問題なければそのまま表示
  return NextResponse.next()
}

// 画像やAPI、システムファイルへのアクセスは監視対象から外す
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
}