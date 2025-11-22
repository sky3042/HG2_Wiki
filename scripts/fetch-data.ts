import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NotionAPI } from 'notion-client';
import { getAllPagesInSpace } from 'notion-utils';
import type { ExtendedRecordMap } from 'notion-types';

// 環境変数をロード
dotenv.config();

const notion = new NotionAPI({
  authToken: process.env.NOTION_TOKEN,
  activeUser: process.env.NOTION_ACTIVE_USER,
});

// あなたの本番ルートページID
const ROOT_PAGE_ID = 'あなたの本番ページID'; 

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Notionデータの増分更新を開始します...');
  
  // 1. ローカルにあるファイルのリストと更新日時を取得
  const localFiles = new Map<string, number>();
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(DATA_DIR, file);
        const stats = fs.statSync(filePath);
        // ファイル名(ID)と更新日時(mtime)を記録
        localFiles.set(file.replace('.json', ''), stats.mtimeMs);
      }
    }
  }

  // 2. getAllPagesInSpace を使って巡回するが、
  // 内部で「保存するかどうか」を判定する
  await getAllPagesInSpace(
    ROOT_PAGE_ID,
    undefined,
    async (pageId: string) => {
      const cleanId = pageId.replace(/-/g, '');
      const filePath = path.join(DATA_DIR, `${cleanId}.json`);

      // A. ローカルにファイルがない場合 -> 新規ページなのでダウンロード
      if (!localFiles.has(cleanId)) {
        console.log(`✨ New Page: ${cleanId}`);
        return await downloadAndSave(pageId, filePath);
      }

      // B. ファイルがある場合 -> Notionからメタデータだけ軽く取って更新判定したいが、
      // notion-clientの仕様上、getPageしないと更新日時が正確に分からないことが多い。
      // しかし、毎回getPageすると遅いので、ここでは妥協案として
      // 「常に上書き」ではなく「エラーが出たらキャッシュを使う」戦略、
      // あるいは「全件取得」に戻ってしまう。
      
      // ★効率的な増分更新のための「検索API」アプローチへの切り替え
      // getAllPagesInSpaceは「リンクを辿る」方式なので、更新日時だけを知るのが難しい。
      // そのため、ここではシンプルに「常にダウンロードして上書き」するが、
      // 処理を止めないように修正します。
      
      try {
        // Notionから最新データを取得（ここがボトルネックだが、更新検知には必要）
        const recordMap = await notion.getPage(pageId);
        
        // Notion側の最終更新日時を取得
        const block = recordMap.block[pageId]?.value;
        const lastEdited = block?.last_edited_time || 0;
        
        // ローカルの更新日時と比較
        const localTime = localFiles.get(cleanId) || 0;
        
        // Notionのタイムスタンプはミリ秒なので比較（1秒程度のズレは許容）
        // ※注: fs.statのmtimeとNotionのedited_timeは直接比較しづらい（保存タイミングがずれるため）
        // そのため、「中身が変わっているか」を比較するのが確実ですが、重いです。
        
        // 【結論】一番現実的な「更新があるページだけ」の方法はこれです：
        // とりあえずダウンロードして、中身を文字列比較し、違えば保存する。
        // これならGitの差分も汚れず、Vercelのビルドも走ります。
        
        const newContent = JSON.stringify(recordMap, null, 2);
        
        if (fs.existsSync(filePath)) {
            const oldContent = fs.readFileSync(filePath, 'utf-8');
            if (oldContent === newContent) {
                console.log(`zzz Skipped (No changes): ${cleanId}`);
                return recordMap; // 保存せずにメモリ上のデータだけ返す
            }
        }

        console.log(`🔄 Updated: ${cleanId}`);
        fs.writeFileSync(filePath, newContent);
        await sleep(300); // API制限回避
        
        return recordMap;

      } catch (err: any) {
        console.error(`❌ Error fetching ${cleanId}:`, err.message);
        // エラーが出たら、ローカルにキャッシュがあればそれを使って続行させる（重要！）
        if (localFiles.has(cleanId)) {
            console.log(`⚠️ Using cached data for ${cleanId}`);
            const data = fs.readFileSync(path.join(DATA_DIR, `${cleanId}.json`), 'utf-8');
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

  console.log(`🎉 完了`);
}

async function downloadAndSave(pageId: string, filePath: string) {
    const recordMap = await notion.getPage(pageId);
    fs.writeFileSync(filePath, JSON.stringify(recordMap, null, 2));
    await sleep(300);
    return recordMap;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});