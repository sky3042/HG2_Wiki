import { execSync } from 'child_process';

// コマンドライン引数からメッセージを取得（なければデフォルト値）
const args = process.argv.slice(2);
const commitMessage = args[0] || 'Update content';

console.log(`🚀 Starting update with message: "${commitMessage}"...`);

const commands = [
  // ▼▼▼ 対策：データフォルダのローカル変更を破棄して競合を防ぐ ▼▼▼
  // (どうせこのあと fetch-data で最新を取ってくるので、古い変更は捨ててOKです)
  'git checkout data/',
  // ▲▲▲ ここまで ▲▲▲

  // 1. 最新コードの取り込み
  'git pull origin main',

  // 2. データの取得と生成
  'npx tsx scripts/fetch-spreadsheet.ts',
  'npx tsx scripts/fetch-data.ts',
  'npx tsx scripts/generate-sitemap.ts',
  
  // 3. Git操作
  'git add .',
  `git commit -m "${commitMessage}"`,
  'git push'
];

try {
  for (const cmd of commands) {
    console.log(`\n👉 Running: ${cmd}`);
    // コマンドを実行（出力をそのまま表示）
    execSync(cmd, { stdio: 'inherit' });
  }
  console.log('\n✅ Update completed successfully!');
} catch (error) {
  console.error('\n❌ Update failed.');
  process.exit(1);
}