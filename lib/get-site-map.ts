import * as fs from 'node:fs'
import * as path from 'node:path'
import { getBlockTitle, getPageProperty, idToUuid, uuidToId } from 'notion-utils'
import { type ExtendedRecordMap } from 'notion-types'

import * as config from './config'
import { includeNotionIdInUrls } from './config'
import type * as types from './types'

export async function getSiteMap(): Promise<types.SiteMap> {
  const pageMap: types.PageMap = {}
  
  const canonicalMapPath = path.join(process.cwd(), 'canonical-map.json')
  let canonicalPageMap: any = null

  // キャッシュがあれば読み込む
  if (fs.existsSync(canonicalMapPath)) {
    try {
      canonicalPageMap = JSON.parse(fs.readFileSync(canonicalMapPath, 'utf8'))
    } catch (err) {
      console.warn('Failed to load canonical-map.json', err)
    }
  }

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

  // サイトマップ生成（ID削除の判断はここで行う）
  if (!canonicalPageMap) {
    const urlCounts: Record<string, number> = {}
    const pageIdToTitle: Record<string, string> = {}
    const pageIdToSlug: Record<string, string> = {}

    // ステップA: 全ページのタイトルを収集してカウント
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
          // タイトルの出現回数をカウント
          urlCounts[cleanTitle] = (urlCounts[cleanTitle] || 0) + 1
        }
      }
    }

    // ステップB: URLを確定させる
    canonicalPageMap = Object.keys(pageMap).reduce(
      (map: Record<string, string>, pageId: string) => {
        const recordMap = pageMap[pageId]
        if (!recordMap) return map
        
        // 公開チェック
        const blockId = idToUuid(pageId)
        const block = recordMap.block[blockId]?.value
        if (!block) return map
        if (!(getPageProperty<boolean | null>('Public', block, recordMap) ?? true)) {
          return map
        }

        let url = ''
        
        // 1. Slugがあればそれ
        if (pageIdToSlug[pageId]) {
           url = pageIdToSlug[pageId]
        } 
        // 2. タイトルがあれば重複チェック
        else if (pageIdToTitle[pageId]) {
           const title = pageIdToTitle[pageId]
           
           // ★重複していない（カウントが1）なら、IDなしのきれいなタイトルを使う
           if (urlCounts[title] === 1) {
             url = title
           } else {
             // 重複しているなら、ID付きにする
             url = `${title}-${uuidToId(pageId)}`
           }
        } 
        // 3. タイトルもなければIDのみ
        else {
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