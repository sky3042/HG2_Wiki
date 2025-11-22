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
// ※ここが正しいIDになっているか再確認してください
const ROOT_PAGE_ID = '1ac3b07c81ff80d184a1f564abe7fef3'; 

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Notionデータの増分更新を開始します...');
  
  const updatedPages: string[] = [];
  const newPages: string[] = [];

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
        
        // ▼▼▼ 修正箇所: ブロックの存在確認を追加 ▼▼▼
        const block = recordMap.block[pageId]?.value;
        const title = block 
          ? (getBlockTitle(block, recordMap) || 'Untitled') 
          : 'Unknown Page';
        // ▲▲▲ 修正箇所終了 ▲▲▲
        
        const newContent = JSON.stringify(recordMap, null, 2);
        
        // A. 新規ページの場合
        if (!localFiles.has(cleanId)) {
            console.log(`✨ New: "${title}" (${cleanId})`);
            fs.writeFileSync(filePath, newContent);
            newPages.push(title);
            await sleep(300);
            return recordMap;
        }

        // B. 既存ページの場合（差分チェック）
        if (fs.existsSync(filePath)) {
            const oldContent = fs.readFileSync(filePath, 'utf-8');
            if (oldContent === newContent) {
                // 変更なし
                return recordMap; 
            }
        }

        // 変更あり -> 保存
        console.log(`🔄 Updated: "${title}" (${cleanId})`);
        fs.writeFileSync(filePath, newContent);
        updatedPages.push(title);
        
        await sleep(300); 
        return recordMap;

      } catch (err: any) {
        console.error(`❌ Error fetching ${cleanId}:`, err.message);
        // エラー時はキャッシュがあればそれを使う
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
  console.log(`新規追加: ${newPages.length} ページ`);
  if (newPages.length > 0) {
      newPages.forEach(p => console.log(`  + ${p}`));
  }
  
  console.log(`更新あり: ${updatedPages.length} ページ`);
  if (updatedPages.length > 0) {
      updatedPages.forEach(p => console.log(`  * ${p}`));
  }
  console.log('='.repeat(40) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});