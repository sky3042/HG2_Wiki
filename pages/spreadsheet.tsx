import * as React from 'react'
import * as fs from 'fs'
import * as path from 'path'
import { PageHead } from '@/components/PageHead'
import { Footer } from '@/components/Footer'
import { NotionPageHeader } from '@/components/NotionPageHeader'
import * as config from '@/lib/config'

// 型定義
type SheetData = Record<string, any[][]>;

export async function getStaticProps() {
  try {
    const jsonPath = path.join(process.cwd(), 'data', 'spreadsheet.json')
    
    // ファイルがない場合の対策
    if (!fs.existsSync(jsonPath)) {
      return { props: { sheets: {} }, revalidate: 10 }
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    
    return {
      props: {
        sheets: data
      },
      revalidate: 10
    }
  } catch (e) {
    console.error('Failed to load spreadsheet data', e)
    return {
      props: {
        sheets: {}
      }
    }
  }
}

export default function SpreadsheetPage({ sheets }: { sheets: SheetData }) {
  // シート名のリストを取得
  const sheetNames = Object.keys(sheets);
  
  // 選択中のタブ（初期値は最初のシート）
  const [activeTab, setActiveTab] = React.useState(sheetNames[0] || '');

  // 現在表示すべきデータ
  const activeData = sheets[activeTab] || [];
  const header = activeData[0] || [];
  const rows = activeData.slice(1);

  return (
    <>
      <PageHead
        site={config.site}
        title="データ一覧"
        description="スプレッドシートのデータを表示します"
      />
      
      {/* Notionヘッダー（ブロックなしで表示） */}
      <NotionPageHeader block={null} />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>データ一覧</h1>
        
        {/* --- タブ切り替えエリア --- */}
        {sheetNames.length > 0 && (
          <div style={{ 
            marginBottom: '20px', 
            display: 'flex', 
            gap: '10px', 
            overflowX: 'auto', 
            paddingBottom: '5px' 
          }}>
            {sheetNames.map((name) => (
              <button
                key={name}
                onClick={() => setActiveTab(name)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: activeTab === name ? '#333' : '#f0f0f0',
                  color: activeTab === name ? '#fff' : '#333',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.2s'
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* --- データ表示エリア --- */}
        <div style={{ 
          overflowX: 'auto', 
          border: '1px solid #eee', 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)' 
        }}>
          {activeData.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #ddd' }}>
                  {header.map((col: any, i: number) => (
                    <th key={i} style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      whiteSpace: 'nowrap', // 列幅を確保（改行しない）
                      borderRight: '1px solid #eee',
                      color: '#555'
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    {row.map((cell: any, cellIndex: number) => (
                      <td key={cellIndex} style={{ 
                        padding: '12px 16px',
                        whiteSpace: 'nowrap', // データも改行させない
                        borderRight: '1px solid #f5f5f5'
                      }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
              データがありません
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  )
}