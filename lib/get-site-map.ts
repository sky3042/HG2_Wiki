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

  // 2. URLの重複カウント用マップを作成
  const urlCounts: Record<string, number> = {}
  const pageIdToIntendedUrl: Record<string, string> = {}

  // まず全ページを走査して「希望するURL」を決める
  for (const pageId of Object.keys(pageMap)) {
    const recordMap = pageMap[pageId]
    
    // 【修正】recordMap が存在しない場合はスキップ（型エラー回避）
    if (!recordMap) continue

    const blockId = idToUuid(pageId)
    const block = recordMap.block[blockId]?.value

    if (!block) continue

    // 非公開ページはスキップ
    if (!(getPageProperty<boolean | null>('Public', block, recordMap) ?? true)) {
      continue
    }

    let url = ''
    if (includeNotionIdInUrls) {
      url = uuidToId(pageId)
    } else {
      // Slugがあればそれを使う
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

    // 希望URLを記録し、出現回数をカウントする
    if (url) {
      pageIdToIntendedUrl[pageId] = url
      urlCounts[url] = (urlCounts[url] || 0) + 1
    }
  }

  // 3. サイトマップの確定（重複があればIDを付与）
  const canonicalPageMap = Object.keys(pageIdToIntendedUrl).reduce(
    (map: Record<string, string>, pageId: string) => {
      const intendedUrl = pageIdToIntendedUrl[pageId]
      
      // 【修正】intendedUrl が undefined の場合はスキップ
      if (!intendedUrl) return map

      let finalUrl = intendedUrl

      // もしこのURLが全体で2回以上登場していたら、強制的にIDを付けて区別する
      const count = urlCounts[intendedUrl]
      if (count && count > 1) {
        console.warn(`Duplicate URL detected: "${intendedUrl}". Appending ID to make unique.`)
        finalUrl = `${intendedUrl}-${uuidToId(pageId)}`
      }

      return {
        ...map,
        [finalUrl]: pageId
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