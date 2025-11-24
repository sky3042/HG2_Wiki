import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// ▼▼▼ 設定：末尾を "output=xlsx" にしたURL ▼▼▼
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvZfL_0EJO7E2hYvLIwa7NVsuFuz9dwKjoOUNXJalJotuLjs1U6mwY1q35pex8DvGtVW6qc_k8mIMO/pub?output=xlsx'; // ←あなたのURL

const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'spreadsheet.json');

async function main() {
  console.log('📊 Fetching Google Spreadsheet (Smart Mode)...');

  try {
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const allData: Record<string, any[][]> = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      // シートの範囲を取得
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const rows: any[][] = [];

      // 1行ずつループ処理
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const row: any[] = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];

          let value = '';
          if (cell) {
            // ★ここが重要：型によって取り出し方を変える
            if (cell.t === 's') {
              // 文字列の場合：改行コードを含んだ「生の値(.v)」を使う
              value = String(cell.v || ''); 
            } else {
               // 数値・日付の場合：「見た目通りの値(.w)」を使う（なければ生の値）
               // これで「2015-04-17」や「2000%」が正しく取得できる
               value = cell.w ? cell.w : String(cell.v || '');
            }
          }
          row.push(value);
        }
        rows.push(row);
      }

      // 空のシートでなければ保存
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