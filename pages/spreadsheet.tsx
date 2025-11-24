import * as React from 'react'
import * as fs from 'fs'
import * as path from 'path'
import { PageHead } from '@/components/PageHead'
import { Footer } from '@/components/Footer'
import { NotionPageHeader } from '@/components/NotionPageHeader'
import * as config from '@/lib/config'

// ビルド時にサーバー側でデータを読み込む
export async function getStaticProps() {
  try {
    const jsonPath = path.join(process.cwd(), 'data', 'spreadsheet.json')
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    return {
      props: {
        tableData: data // [[行1, 列1], [行1, 列2]...] の形式
      },
      revalidate: 10
    }
  } catch (e) {
    console.error('Failed to load spreadsheet data', e)
    return {
      props: {
        tableData: []
      }
    }
  }
}

export default function SpreadsheetPage({ tableData }: { tableData: string[][] }) {
  // 1行目をヘッダー、2行目以降をデータとして扱う例
  const header = tableData[0] || []
  const rows = tableData.slice(1)

  return (
    <>
      <PageHead
        site={config.site}
        title="データ一覧"
        description="スプレッドシートのデータを表示します"
      />
      <NotionPageHeader block={null} />

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>データ一覧</h1>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '16px' }}>
            <thead>
              <tr style={{ background: '#f4f4f4', borderBottom: '2px solid #ddd' }}>
                {header.map((col, i) => (
                  <th key={i} style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} style={{ borderBottom: '1px solid #eee' }}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} style={{ padding: '12px' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </>
  )
}