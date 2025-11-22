import * as fs from 'node:fs'
import * as path from 'node:path'
import { getBlockTitle, getPageProperty, idToUuid, uuidToId } from 'notion-utils'
import { type ExtendedRecordMap } from 'notion-types'

import * as config from './config'
import { includeNotionIdInUrls } from './config'
import type * as types from './types'

export async function getSiteMap(): Promise<types.SiteMap> {
  const dataDir = path.join(process.cwd(), 'data')
  const pageMap: types.PageMap = {}

  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      const pageId = file.replace('.json', '')
      try {
        const content = fs.readFileSync(path.join(dataDir, file), 'utf8')
        const recordMap = JSON.parse(content) as ExtendedRecordMap
        pageMap[pageId] = recordMap
      } catch (err) {
        console.warn(`Failed to load ${file}`, err)
      }
    }
  }

  const canonicalPageMap = Object.keys(pageMap).reduce(
    (map: Record<string, string>, pageId: string) => {
      const recordMap = pageMap[pageId]
      if (!recordMap) return map

      const blockId = idToUuid(pageId)
      const block = recordMap.block[blockId]?.value

      if (!block) return map

      if (
        !(getPageProperty<boolean | null>('Public', block, recordMap) ?? true)
      ) {
        return map
      }

      // --- URL決定ロジック ---
      let url = ''

      // 設定に関わらず、まずは理想のURL（Slugかタイトル）を決める
      const slug = getPageProperty<string>('Slug', block, recordMap)
      if (slug) {
        url = slug
      } else {
        const title = getBlockTitle(block, recordMap)
        if (title) {
          url = title.trim().replace(/\s+/g, '-')
        } else {
          url = uuidToId(pageId)
        }
      }

      // ▼▼▼ 重複回避ロジック（重要） ▼▼▼
      // もしURLが既に登録されていたら、強制的に「URL-ID」という形式の新しいキーを作る
      // ※ includeNotionIdInUrls の設定に関係なく、キー自体を変える
      if (map[url] && map[url] !== pageId) {
        console.warn(`Duplicate URL detected: "${url}". Appending ID to uniqueify.`)
        url = `${url}-${uuidToId(pageId)}`
      }
      // ▲▲▲ ここまで ▲▲▲
      
      // 最後に設定を見て、ID強制なら上書きする（今回はfalseなので影響しない）
      if (includeNotionIdInUrls) {
         // ここはあえて何もしないか、必要なら処理を入れる
         // url = uuidToId(pageId) // これを有効にすると全部IDになるのでコメントアウトのまま
      }

      return {
        ...map,
        [url]: pageId
      }
    },
    {}
  )

  return {
    site: config.site,
    pageMap,
    canonicalPageMap
  }
}