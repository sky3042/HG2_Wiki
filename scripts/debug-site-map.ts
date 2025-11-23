import { getSiteMap } from '../lib/get-site-map'

async function main() {
  console.log('🔍 サイトマップの生成ロジックをテストします...')
  
  try {
    const siteMap = await getSiteMap()
    const { canonicalPageMap } = siteMap
    const urls = Object.keys(canonicalPageMap)

    console.log(`✅ 合計ページ数: ${urls.length}`)
    console.log('--- URL マッピング確認 ---')

    // 重複チェック用
    const urlCounts: Record<string, number> = {}
    const duplicates: string[] = []

    // 一覧表示
    for (const url of urls) {
      const pageId = canonicalPageMap[url]
      console.log(`URL: /${url.padEnd(30)} -> ID: ${pageId}`)

      // 重複カウント
      if (urlCounts[url]) {
        urlCounts[url]++
        duplicates.push(url)
      } else {
        urlCounts[url] = 1
      }
    }

    console.log('------------------------')
    if (duplicates.length > 0) {
      console.error('❌ 重複しているURLが見つかりました:', duplicates)
    } else {
      console.log('✨ 重複するURLはありません。正常です。')
    }

  } catch (err) {
    console.error('エラーが発生しました:', err)
  }
}

main()