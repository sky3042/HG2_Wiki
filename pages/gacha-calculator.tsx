import * as React from 'react'
import { PageHead } from '@/components/PageHead'
import { Footer } from '@/components/Footer'
import { NotionPageHeader } from '@/components/NotionPageHeader'
import * as config from '@/lib/config'
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  type TooltipItem // type import に修正
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { 
  Calculator, 
  BarChart3, 
  Info, 
  Settings, 
  Plus, 
  Minus, 
  Upload, 
  Download,
  Trash2,
  Edit3,
  BookOpen
} from 'lucide-react'
import { 
  type GachaItem, 
  type CalculationSettings, 
  type GraphData, 
  type ErrorInfo,
  GachaCalculator, 
  GachaErrorHandler,
  parseCSVData,
  formatCSVData
} from '@/lib/gacha-logic'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const DEFAULT_CSV_DATA = `ラベル,確率,個数
Wピックアップ,0.926%,12
ピックアップ,0.000%,0
追加枠,0.000%,0
★5武器,0.008%,188
★5服装,0.012%,62
★5勲章,0.008%,158
★4武器-a,0.067%,19
★4武器-b,0.057%,5
★3武器,0.212%,26
★2武器,0.329%,22
★4服装-a,0.057%,10
★4服装-b,0.019%,3
★4服装-c,0.010%,1
★3服装-a,0.180%,12
★3服装-b,0.053%,1
★2服装,0.265%,11
★4勲章-a,0.038%,16
★4勲章-b,0.029%,1
★3勲章-a,0.149%,20
★3勲章-b,0.053%,1
★2勲章,0.350%,11
素材-a,27.775%,2
素材-b,2.187%,1`;

const DEFAULT_PRESETS = [
  {
    id: 'w_pickup',
    name: 'Wピックアップ',
    defaultTargets: { 'Wピックアップ': 1 } as Record<string, number>, // 型アサーションを追加
    data: parseCSVData(DEFAULT_CSV_DATA)
  },
  {
    id: 'normal_pickup',
    name: '通常ピックアップ',
    defaultTargets: { 'ピックアップ': 1, '追加枠': 1 } as Record<string, number>, // 型アサーションを追加
    data: parseCSVData(DEFAULT_CSV_DATA.replace('0.926%', '0.000%').replace('ピックアップ,0.000%', 'ピックアップ,1.436%').replace('追加枠,0.000%', '追加枠,1.777%'))
  }
];

export default function GachaCalculatorPage() {
  const [activeTab, setActiveTab] = React.useState<'settings' | 'chart' | 'about'>('settings');
  const [gachaData, setGachaData] = React.useState<GachaItem[]>(() => parseCSVData(DEFAULT_CSV_DATA));
  const [settings, setSettings] = React.useState<CalculationSettings>({
    targetsByLabel: { 'Wピックアップ': 1 },
    targetCopiesRequired: 1,
    maxPulls: 100,
    curveStep: 10
  });
  const [graphData, setGraphData] = React.useState<GraphData[]>([]);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [notification, setNotification] = React.useState<ErrorInfo | null>(null);
  const [isDataExpanded, setIsDataExpanded] = React.useState(false);

  const availableLabels = React.useMemo(() => 
    gachaData.map(item => item.label).filter(l => l.trim() !== ''), 
  [gachaData]);

  const calculateProbabilities = async () => {
    const error = GachaErrorHandler.validateCalculationData(gachaData, settings);
    if (error) {
      setNotification(error);
      if (error.type === 'error') return;
    }

    setIsCalculating(true);
    setActiveTab('chart');
    setNotification(null);

    try {
      await new Promise(r => setTimeout(r, 100));
      const calculator = new GachaCalculator();
      calculator.prepareData(gachaData, settings);
      const results = calculator.generateGraphData(settings.maxPulls, settings.curveStep);
      setGraphData(results);
    } catch (e) {
      setNotification(GachaErrorHandler.createCalculationError(e));
    } finally {
      setIsCalculating(false);
    }
  };

  const renderSettings = () => (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <Settings size={24} />
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>設定</h2>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={20} /> 祈りを選択
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
          {DEFAULT_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => {
                setGachaData([...preset.data]);
                setSettings({ ...settings, targetsByLabel: { ...preset.defaultTargets } });
                setNotification({ type: 'success', title: '読込完了', message: `「${preset.name}」を読み込みました` });
              }}
              style={buttonStyle(false)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <button 
          onClick={() => setIsDataExpanded(!isDataExpanded)}
          style={{ ...buttonStyle(false), width: '100%', justifyContent: 'space-between' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} /> 祈りの詳細データ設定（確率など）
          </span>
          <span>{isDataExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isDataExpanded && (
          <div style={{ marginTop: '15px', padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
             <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <label style={actionBtnStyle}>
                    <Upload size={14} /> インポート
                    <input type="file" accept=".csv" style={{display: 'none'}} onChange={(e) => {
                        const file = e.target.files?.[0];
                        if(!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            try {
                                const newData = parseCSVData(ev.target?.result as string);
                                setGachaData(newData);
                                setNotification({type:'success', title:'成功', message:'CSVを読み込みました'});
                            } catch(err) {
                                setNotification({type:'error', title:'エラー', message:'CSVの読み込みに失敗しました'});
                            }
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                    }}/>
                </label>
                <button style={actionBtnStyle} onClick={() => {
                    const csv = formatCSVData(gachaData);
                    const blob = new Blob([csv], {type: 'text/csv'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'gacha_data.csv';
                    a.click();
                }}>
                    <Download size={14} /> エクスポート
                </button>
             </div>

             <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #ddd', background: '#eee' }}>
                            <th style={{ padding: '8px', textAlign: 'left' }}>ラベル</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>確率</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>個数</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {gachaData.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '4px' }}>
                                    <input 
                                        value={item.label} 
                                        onChange={e => {
                                            const n = [...gachaData]; 
                                            if (n[idx]) n[idx]!.label = e.target.value; 
                                            setGachaData(n);
                                        }}
                                        style={inputStyle}
                                    />
                                </td>
                                <td style={{ padding: '4px' }}>
                                    <input 
                                        value={item.probability} 
                                        onChange={e => {
                                            const n = [...gachaData]; 
                                            if (n[idx]) n[idx]!.probability = e.target.value; 
                                            setGachaData(n);
                                        }}
                                        style={inputStyle}
                                    />
                                </td>
                                <td style={{ padding: '4px' }}>
                                    <input 
                                        type="number"
                                        value={item.count} 
                                        onChange={e => {
                                            const n = [...gachaData]; 
                                            if (n[idx]) n[idx]!.count = parseInt(e.target.value)||0; 
                                            setGachaData(n);
                                        }}
                                        style={inputStyle}
                                    />
                                </td>
                                <td style={{ padding: '4px', textAlign: 'center' }}>
                                    <button onClick={() => {
                                        const n = gachaData.filter((_, i) => i !== idx); setGachaData(n);
                                    }} style={{...actionBtnStyle, color: 'red', border: 'none', background: 'none'}}>
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button onClick={() => setGachaData([...gachaData, {label:'', probability:'0%', count:0}])} style={{...actionBtnStyle, marginTop: '10px', width: '100%'}}>
                    <Plus size={16}/> 行を追加
                </button>
             </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '15px' }}>欲しい装備の設定</h3>
        
        {Object.entries(settings.targetsByLabel).map(([label, count]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', background: '#f5f5f5', padding: '10px', borderRadius: '8px' }}>
             <select 
                value={label}
                onChange={(e) => {
                    const newL = e.target.value;
                    const n = {...settings.targetsByLabel};
                    delete n[label];
                    n[newL] = count;
                    setSettings({...settings, targetsByLabel: n});
                }}
                style={{ ...inputStyle, flex: 1 }}
             >
                {availableLabels.map(l => <option key={l} value={l}>{l}</option>)}
             </select>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button onClick={() => {
                    const n = {...settings.targetsByLabel};
                    if (n[label] && n[label]! > 1) {
                        n[label] = n[label]! - 1;
                        setSettings({...settings, targetsByLabel: n});
                    }
                }} style={iconBtnStyle}><Minus size={14}/></button>
                
                <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{count}</span>
                
                <button onClick={() => {
                    const n = {...settings.targetsByLabel};
                    if (typeof n[label] === 'number') {
                        n[label] = n[label]! + 1;
                        setSettings({...settings, targetsByLabel: n});
                    }
                }} style={iconBtnStyle}><Plus size={14}/></button>
             </div>

             <button onClick={() => {
                 const n = {...settings.targetsByLabel};
                 delete n[label];
                 setSettings({...settings, targetsByLabel: n});
             }} style={{...iconBtnStyle, color: 'red'}}>×</button>
          </div>
        ))}

        <button 
            onClick={() => {
                const unused = availableLabels.find(l => !settings.targetsByLabel[l]);
                if(unused) setSettings({...settings, targetsByLabel: {...settings.targetsByLabel, [unused]: 1}});
            }}
            disabled={Object.keys(settings.targetsByLabel).length >= availableLabels.length}
            style={{ ...buttonStyle(false), fontSize: '14px', padding: '5px 10px' }}
        >
            <Plus size={14}/> ターゲットを追加
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div>
              <label style={labelStyle}>各装備の必要個数</label>
              <input type="number" min="1" value={settings.targetCopiesRequired} onChange={e => setSettings({...settings, targetCopiesRequired: parseInt(e.target.value)||1})} style={inputStyle} />
          </div>
          <div>
              <label style={labelStyle}>最大ガチャ回数</label>
              <input type="number" min="1" value={settings.maxPulls} onChange={e => setSettings({...settings, maxPulls: parseInt(e.target.value)||100})} style={inputStyle} />
          </div>
          <div>
              <label style={labelStyle}>グラフ間隔</label>
              <input type="number" min="1" value={settings.curveStep} onChange={e => setSettings({...settings, curveStep: parseInt(e.target.value)||10})} style={inputStyle} />
          </div>
      </div>

      <div style={{ textAlign: 'center' }}>
          <button onClick={calculateProbabilities} disabled={isCalculating} style={{...buttonStyle(true), fontSize: '1.2rem', padding: '15px 40px'}}>
            {isCalculating ? '計算中...' : <><Calculator size={20}/> 計算開始</>}
          </button>
      </div>

    </div>
  );

  const renderChart = () => {
    if (graphData.length === 0) return <div style={cardStyle}>データがありません。計算を実行してください。</div>;
    
    const labels = graphData.map(p => p.pullCount);
    // graphData[0] が存在することをチェックしてアクセス
    const firstData = graphData[0];
    const numTargets = firstData ? firstData.probabilities.length : 0;
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16'];
    
    const datasets = Array.from({ length: numTargets }, (_, i) => ({
        label: `${i + 1}種類以上`,
        data: graphData.map(p => {
            const val = p.probabilities[i];
            return val !== undefined ? val * 100 : 0;
        }),
        borderColor: colors[i % colors.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1
    }));

    return (
        <div style={cardStyle}>
            <div style={{ height: '500px', width: '100%' }}>
                <Line data={{ labels, datasets }} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: 'ガチャ回数' } },
                        y: { title: { display: true, text: '確率 (%)' }, min: 0, max: 100 }
                    }
                }} />
            </div>
        </div>
    );
  };

  const renderAbout = () => (
      <div style={cardStyle}>
          <h2 style={{fontSize: '1.5rem', marginBottom: '15px', display:'flex', alignItems:'center', gap:'10px'}}>
              <Info size={24} color="#3B82F6"/> このサイトについて
          </h2>
          <p style={{lineHeight: '1.8', color: '#444'}}>
            このツールは「崩壊学園」のガチャ（祈り）確率を、動的計画法を用いて厳密に計算するシミュレーターです。<br/>
            単純な二項分布ではなく、天井システム（100連天井など）や「ピックアップ」「追加枠」の仕様を考慮しています。
          </p>
          <div style={{ marginTop: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '8px', fontSize: '14px' }}>
            制作者: <a href="https://x.com/sky_gakuen" target="_blank" style={{color: '#2563EB', fontWeight: 'bold'}}>@sky_gakuen</a>
          </div>
      </div>
  );

  return (
    <>
      <PageHead site={config.site} title="祈り計算機" description="崩壊学園ガチャ確率計算機" />
      <NotionPageHeader block={null} />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px', minHeight: 'calc(100vh - 200px)' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', textAlign: 'center', fontWeight: '800', color: '#333' }}>
            祈り計算機
        </h1>

        {notification && (
            <div style={{
                padding: '15px',
                marginBottom: '20px',
                borderRadius: '8px',
                background: notification.type === 'error' ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${notification.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
                color: notification.type === 'error' ? '#991b1b' : '#166534'
            }}>
                <strong>{notification.title}</strong>: {notification.message}
                <button onClick={() => setNotification(null)} style={{float: 'right', background: 'none', border: 'none', cursor: 'pointer'}}>×</button>
            </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {[
                { id: 'settings', label: '設定', icon: Calculator },
                { id: 'chart', label: '結果グラフ', icon: BarChart3 },
                { id: 'about', label: 'ヘルプ', icon: Info },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                        ...tabStyle,
                        background: activeTab === tab.id ? '#3B82F6' : '#fff',
                        color: activeTab === tab.id ? '#fff' : '#555',
                        borderColor: activeTab === tab.id ? '#3B82F6' : '#ddd'
                    }}
                >
                    <tab.icon size={18} /> {tab.label}
                </button>
            ))}
        </div>

        <div>
            {activeTab === 'settings' && renderSettings()}
            {activeTab === 'chart' && renderChart()}
            {activeTab === 'about' && renderAbout()}
        </div>

      </main>
      <Footer />
    </>
  )
}

// --- Styles ---
const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    marginBottom: '20px'
};

const tabStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 'bold',
    transition: 'all 0.2s'
};

const buttonStyle = (primary: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    background: primary ? 'linear-gradient(to right, #3B82F6, #4F46E5)' : '#f3f4f6',
    color: primary ? '#fff' : '#374151',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.1s'
});

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px'
};

const actionBtnStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    background: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    color: '#555'
};

const iconBtnStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eee',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#444'
};