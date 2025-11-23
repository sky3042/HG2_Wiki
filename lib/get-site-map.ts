import * as fs from 'node:fs'
import * as path from 'node:path'
import { getBlockTitle, getPageProperty, idToUuid, uuidToId } from 'notion-utils'
import { type ExtendedRecordMap } from 'notion-types'

import * as config from './config'
import { includeNotionIdInUrls } from './config'
import type * as types from './types'

export async function getSiteMap(): Promise<types.SiteMap> {
  const pageMap: types.PageMap = {}
  
  // データ読み込み
  const dataDir = path.join(process.cwd(), 'data')
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

  const canonicalPageMap: types.CanonicalPageMap = {}
  
  const urlCounts: Record<string, number> = {}
  const pageIdToTitle: Record<string, string> = {}
  const pageIdToSlug: Record<string, string> = {}

  // ステップA: 全ページのタイトル/Slugを収集してカウント
  for (const pageId of Object.keys(pageMap)) {
    const recordMap = pageMap[pageId]
    if (!recordMap) continue
    const blockId = idToUuid(pageId)
    const block = recordMap.block[blockId]?.value
    if (!block) continue

    if (!(getPageProperty<boolean | null>('Public', block, recordMap) ?? true)) {
      continue
    }

    const slug = getPageProperty<string>('Slug', block, recordMap)
    if (slug) {
      pageIdToSlug[pageId] = slug
    } else {
      const title = getBlockTitle(block, recordMap)
      if (title) {
        const cleanTitle = title.trim().replace(/\s+/g, '-')
        pageIdToTitle[pageId] = cleanTitle
        urlCounts[cleanTitle] = (urlCounts[cleanTitle] || 0) + 1
      }
    }
  }

  // ステップB: URL確定
  for (const pageId of Object.keys(pageMap)) {
    const recordMap = pageMap[pageId]
    if (!recordMap) continue
    const blockId = idToUuid(pageId)
    const block = recordMap.block[blockId]?.value
    if (!block) continue

    if (!(getPageProperty<boolean | null>('Public', block, recordMap) ?? true)) {
      continue
    }

    let url = ''

    if (pageIdToSlug[pageId]) {
        url = pageIdToSlug[pageId]
    } else if (pageIdToTitle[pageId]) {
        const title = pageIdToTitle[pageId]
        
        // ★ここがロジックの核心★
        // 重複していない(count == 1) なら、きれいなタイトル(IDなし)
        if (urlCounts[title] === 1) {
          url = title
        } else {
          // 重複しているなら、タイトル-ID (安全策)
          url = `${title}-${uuidToId(pageId)}`
        }
    } else {
        url = uuidToId(pageId)
    }

    if (url) {
      canonicalPageMap[url] = pageId
    }
  }

  return {
    site: config.site,
    pageMap,
    canonicalPageMap
  }
}