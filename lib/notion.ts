import * as fs from 'fs'
import * as path from 'path'
import {
  type ExtendedRecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import { mergeRecordMaps } from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import {
  isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { getTweetsMap } from './get-tweets'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

// --- ローカルキャッシュからの読み込み関数 ---
async function fetchPageData(pageId: string): Promise<ExtendedRecordMap> {
  // 1. IDからハイフンを除去（保存ファイル名に合わせる）
  const cleanId = pageId.replace(/-/g, '');
  
  // 2. ローカルの data フォルダへのパス
  // Vercel等の環境でも process.cwd() はプロジェクトルートを指します
  const cachePath = path.join(process.cwd(), 'data', `${cleanId}.json`);

  // 3. ファイルが存在すれば読み込む
  if (fs.existsSync(cachePath)) {
    try {
      const fileContent = fs.readFileSync(cachePath, 'utf-8');
      const recordMap = JSON.parse(fileContent) as ExtendedRecordMap;
      // console.log(`Using local cache for: ${cleanId}`);
      return recordMap;
    } catch (e) {
      console.warn(`Error reading local cache for ${cleanId}, falling back to API.`, e);
    }
  }

  // 4. なければNotion APIから取得（開発時や新規ページなど）
  console.warn(`Cache miss: Fetching from API for ${pageId}`);
  return notion.getPage(pageId);
}
// ---------------------------------------

const getNavigationLinkPages = pMemoize(
  async (): Promise<ExtendedRecordMap[]> => {
    const navigationLinkPageIds = (navigationLinks || [])
      .map((link) => link?.pageId)
      .filter(Boolean)

    if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
      return pMap(
        navigationLinkPageIds,
        async (navigationLinkPageId) =>
          // ここも fetchPageData に置き換えてキャッシュを利用
          fetchPageData(navigationLinkPageId as string),
        {
          concurrency: 4
        }
      )
    }

    return []
  }
)

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  // 変更: fetchPageData を使用してローカルデータを優先
  let recordMap = await fetchPageData(pageId)

  if (navigationStyle !== 'default') {
    // ensure that any pages linked to in the custom navigation header have
    // their block info fully resolved in the page record map so we know
    // the page title, slug, etc.
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, navigationLinkRecordMap),
        recordMap
      )
    }
  }

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap)
    ;(recordMap as any).preview_images = previewImageMap
  }

  await getTweetsMap(recordMap)

  return recordMap
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params)
}