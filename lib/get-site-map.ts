import * as fs from 'node:fs'
import * as path from 'node:path'
import { getBlockTitle, getPageProperty, idToUuid, uuidToId } from 'notion-utils'
import { type ExtendedRecordMap } from 'notion-types'

import * as config from './config'
import { includeNotionIdInUrls } from './config'
import type * as types from './types'

export async function getSiteMap(): Promise<types.SiteMap> {
  const pageMap: types.PageMap = {}
  
  // --- 1. サーバー上のキャッシュ読み込み ---
  const canonicalMapPath = path.join(process.cwd(), 'canonical-map.json')
  let canonicalPageMap: any = null

  if (fs.existsSync(canonicalMapPath)) {
    try {
      canonicalPageMap = JSON.parse(fs.readFileSync(canonicalMapPath, 'utf8'))
    } catch (err) {
      console.warn('Failed to load canonical-map.json', err)
    }
  }

  // --- 2. データ読み込み ---
  const dataDir = path.join(process.cwd(), 'data')
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      // ▼▼▼ 修正: スプレッドシートのデータなら無視する ▼▼▼
      if (file === 'spreadsheet.json') continue
      // ▲▲▲

      const pageId = file.replace('.json', '')
      try {
        const content = fs.readFileSync(path.join(dataDir, file), 'utf8')
        const recordMap = JSON.parse(content) as ExtendedRecordMap
        
        // ▼▼▼ 修正: 中身がNotionデータかどうかもチェック（安全策） ▼▼▼
        if (!recordMap.block) {
            console.warn(`Skipping non-Notion file: ${file}`)
            continue
        }
        // ▲▲▲

        pageMap[pageId] = recordMap
      } catch (err) {
        console.warn(`Failed to load ${file}`, err)
      }
    }
  }
  // ---------------------

  if (!canonicalPageMap) {
    const urlCounts: Record<string, number> = {}
    const pageIdToTitle: Record<string, string> = {}
    const pageIdToSlug: Record<string, string> = {}

    // ステップA: タイトル収集と重複カウント
    for (const pageId of Object.keys(pageMap)) {
      const recordMap = pageMap[pageId]
      // ガードを入れたのでここは安全ですが念のため
      if (!recordMap || !recordMap.block) continue
      
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
          // ▼▼▼ 修正箇所1：タイトル収集時 ▼▼▼
          const cleanTitle = title.trim().replace(/[\s\u30FB]+/g, '-')
          // ▲▲▲
          pageIdToTitle[pageId] = cleanTitle
          urlCounts[cleanTitle] = (urlCounts[cleanTitle] || 0) + 1
        }
      }
    }

    // ステップB: URL確定
    canonicalPageMap = Object.keys(pageMap).reduce(
      (map: Record<string, string>, pageId: string) => {
        const recordMap = pageMap[pageId]
        if (!recordMap) return map
        
        const blockId = idToUuid(pageId)
        const block = recordMap.block[blockId]?.value
        if (!block) return map

        if (!(getPageProperty<boolean | null>('Public', block, recordMap) ?? true)) {
          return map
        }

        let url = ''

        if (pageIdToSlug[pageId]) {
           url = pageIdToSlug[pageId]
        } else if (pageIdToTitle[pageId]) {
           const title = pageIdToTitle[pageId]
           // 重複していないならIDなし、重複ならIDあり
           if (urlCounts[title] === 1) {
             url = title
           } else {
             url = `${title}-${uuidToId(pageId)}`
           }
        } else {
           url = uuidToId(pageId)
        }

        return {
          ...map,
          [url]: pageId
        }
      },
      {}
    )
  }

  return {
    site: config.site,
    pageMap,
    canonicalPageMap
  }
}