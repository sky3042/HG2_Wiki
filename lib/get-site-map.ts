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

  // 1. データの読み込み
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

  // 2. サイトマップ（URL台帳）の作成
  const canonicalPageMap = Object.keys(pageMap).reduce(
    (map: Record<string, string>, pageId: string) => {
      const recordMap = pageMap[pageId]
      if (!recordMap) return map

      // 【修正】ファイル名(ID)をUUID(ハイフンあり)に変換してからブロックを探す
      const blockId = idToUuid(pageId)
      const block = recordMap.block[blockId]?.value

      if (!block) {
        // ブロックが見つからない場合はスキップ
        return map
      }

      // 非公開ページはスキップ
      if (
        !(getPageProperty<boolean | null>('Public', block, recordMap) ?? true)
      ) {
        return map
      }

      // --- URL決定ロジック ---
      let url = ''

      if (includeNotionIdInUrls) {
        url = uuidToId(pageId)
      } else {
        // 'Slug' プロパティを探す
        const slug = getPageProperty<string>('Slug', block, recordMap)
        
        if (slug) {
          url = slug
        } else {
          // Slugがなければタイトルを使う
          const title = getBlockTitle(block, recordMap)
          if (title) {
            url = title.trim().replace(/\s+/g, '-')
          } else {
            url = uuidToId(pageId)
          }
        }
      }
      // -----------------------

      // URLの重複チェック
      if (map[url] && map[url] !== pageId) {
        console.warn(`Duplicate URL detected: ${url}. Falling back to ID.`)
        url = uuidToId(pageId)
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