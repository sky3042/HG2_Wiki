import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// ▼▼▼ 設定：末尾を "output=xlsx" にしたURL ▼▼▼
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvZfL_0EJO7E2hYvLIwa7NVsuFuz9dwKjoOUNXJalJotuLjs1U6mwY1q35pex8DvGtVW6qc_k8mIMO/pub?output=xlsx';

const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'spreadsheet.json');

async function main() {
  console.log('📊 Fetching Google Spreadsheet (All Sheets)...');

  try {
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const allData: Record<string, any[][]> = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      // ▼▼▼ 修正箇所：raw: false を追加（これで日付が文字列になります） ▼▼▼
      const rows = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false, // ← これが重要！ 見た目通りの文字列を取得します
        dateNF: 'yyyy-mm-dd' // 日付フォーマットの指定（念のため）
      }) as any[][];
      // ▲▲▲

      if (rows.length > 0) {
        allData[sheetName] = rows;
        console.log(`   - Found sheet: "${sheetName}" (${rows.length} rows)`);
      }
    });

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2));
    console.log(`✅ Saved all sheets to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('❌ Error fetching spreadsheet:', error);
    process.exit(1);
  }
}

main();