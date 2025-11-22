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

      if (includeNotionIdInUrls) {
        url = uuidToId(pageId)
      } else {
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
      }

      // ▼▼▼ 重複回避ロジック（変更箇所） ▼▼▼
      // もしURLが既に登録されていたら、「URL + ハイフン + ID」にして強制的にユニークにする
      if (map[url] && map[url] !== pageId) {
        console.warn(`Duplicate URL detected: "${url}". Appending ID to uniqueify.`)
        url = `${url}-${uuidToId(pageId)}`
      }
      // ▲▲▲ ここまで ▲▲▲

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