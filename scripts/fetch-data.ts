import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NotionAPI } from 'notion-client';
import { getAllPagesInSpace, getBlockTitle } from 'notion-utils';
import type { ExtendedRecordMap } from 'notion-types';

// 環境変数をロード
dotenv.config();

const notion = new NotionAPI({
  authToken: process.env.NOTION_TOKEN,
  activeUser: process.env.NOTION_ACTIVE_USER,
});

// あなたの本番ルートページID
const ROOT_PAGE_ID = '1ac3b07c81ff80d184a1f564abe7fef3'; 

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ▼▼▼ 二重ラップ修正用の共通関数 ▼▼▼
function fixDoubleNesting(obj: any) {
  if (!obj) return;
  for (const key in obj) {
    const item = obj[key];
    if (!item || !item.value) continue;

    // value.value が存在する場合、それを本来の value に引き上げる
    const innerValue = (item.value as any).value;
    if (innerValue) {
      // console.log(`   🔧 Fixing double nesting for key: ${key}`);
      item.value = innerValue;
    }
  }
}
// ▲▲▲ ここまで ▲▲▲

async function main() {
  console.log('🚀 Notionデータの増分更新（タイムスタンプ比較）を開始します...');
  
  const updatedPages: string[] = [];
  const newPages: string[] = [];
  const skippedPages: string[] = [];

  const localFiles = new Set<string>();
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        localFiles.add(file.replace('.json', ''));
      }
    }
  }

  await getAllPagesInSpace(
    ROOT_PAGE_ID,
    undefined,
    async (pageId: string) => {
      const cleanId = pageId.replace(/-/g, '');
      const filePath = path.join(DATA_DIR, `${cleanId}.json`);

      try {
        const recordMap = await notion.getPage(pageId);

        // ▼▼▼ 修正適用：block だけでなく collection 等も直す ▼▼▼
        fixDoubleNesting(recordMap.block);
        fixDoubleNesting(recordMap.collection);
        fixDoubleNesting(recordMap.collection_view);
        // ▲▲▲ 修正ここまで ▲▲▲
        
        const block = recordMap.block[pageId]?.value;
        const title = block 
          ? (getBlockTitle(block, recordMap) || 'Untitled') 
          : 'Unknown Page';

        // A. 新規ページ
        if (!localFiles.has(cleanId)) {
            console.log(`✨ New: "${title}"`);
            fs.writeFileSync(filePath, JSON.stringify(recordMap, null, 2));
            newPages.push(title);
            await sleep(300);
            return recordMap;
        }

        // B. 既存ページ（タイムスタンプ比較）
        if (fs.existsSync(filePath)) {
            const oldData = fs.readFileSync(filePath, 'utf-8');
            const oldRecordMap = JSON.parse(oldData) as ExtendedRecordMap;
            const oldBlock = oldRecordMap.block[pageId]?.value;
            
            const oldTime = oldBlock?.last_edited_time || 0;
            const newTime = block?.last_edited_time || 0;

            if (oldTime === newTime) {
                skippedPages.push(title);
                return recordMap; 
            }
        }

        // C. 更新あり
        console.log(`🔄 Updated: "${title}"`);
        fs.writeFileSync(filePath, JSON.stringify(recordMap, null, 2));
        updatedPages.push(title);
        
        await sleep(300); 
        return recordMap;

      } catch (err: any) {
        console.error(`❌ Error fetching ${cleanId}:`, err.message);
        if (localFiles.has(cleanId)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data) as ExtendedRecordMap;
        }
        throw err;
      }
    },
    {
      concurrency: 1,
      traverseCollections: true,
    }
  );

  console.log('\n' + '='.repeat(40));
  console.log('🎉 処理完了');
  console.log(`新規: ${newPages.length} / 更新: ${updatedPages.length} / 変化なし: ${skippedPages.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});