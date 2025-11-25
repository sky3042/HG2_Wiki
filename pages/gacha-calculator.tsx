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
  type TooltipItem
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
  BookOpen,
  AlertTriangle,
  X,
  CheckCircle
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
    defaultTargets: { 'Wピックアップ': 1 } as Record<string, number>,
    data: parseCSVData(DEFAULT_CSV_DATA)
  },
  {
    id: 'normal_pickup',
    name: '通常ピックアップ',
    defaultTargets: { 'ピックアップ': 1, '追加枠': 1 } as Record<string, number>,
    data: parseCSVData(DEFAULT_CSV_DATA.replace('0.926%', '0.000%').replace('ピックアップ,0.000%', 'ピックアップ,1.436%').replace('追加枠,0.000%', '追加枠,1.777%'))
  }
];

// --- Sub Components (Inline) ---

const ErrorNotification = ({ error, onClose }: { error: ErrorInfo | null, onClose: () => void }) => {
  if (!error) return null;
  
  const colors = {
    error: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', icon: '#EF4444' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '#F59E0B' },
    info: { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', icon: '#3B82F6' },
    success: { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', icon: '#10B981' }
  }[error.type];

  const Icon = {
    error: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle
  }[error.type];

  return (
    <div style={{
      padding: '16px',
      marginBottom: '24px',
      borderRadius: '8px',
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
        <Icon size={20} color={colors.icon} style={{ marginTop: '2px' }} />
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '600', color: colors.text }}>{error.title}</h3>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: colors.text }}>{error.message}</p>
          {error.suggestions && (
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: colors.text }}>
              {error.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          )}
        </div>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}>
        <X size={18} />
      </button>
    </div>
  );
};

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

  const chartRef = React.useRef<ChartJS<'line'>>(null);

  const availableLabels = React.useMemo(() => 
    gachaData.map(item => item.label).filter(l => l.trim() !== ''), 
  [gachaData]);

  const getTargetValidation = (label: string, count: number) => {
    const labelData = gachaData.find(item => item.label === label);
    if (!labelData) return { isValid: false, message: 'データなし' };
    if (count > labelData.count) return { isValid: false, message: `最大${labelData.count}個` };
    if (labelData.count === 0) return { isValid: false, message: '個数0' };
    return { isValid: true, message: '' };
  };

  const updateTargetCount = (label: string, count: number) => {
    const newTargets = { ...settings.targetsByLabel };
    if (count <= 0) {
      delete newTargets[label];
    } else {
      newTargets[label] = count;
    }
    setSettings({ ...settings, targetsByLabel: newTargets });
  };

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

      {/* プリセット */}
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

      {/* 詳細データエディタ */}
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

      {/* ターゲット設定 */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>欲しい装備の設定</h3>
            <button 
                onClick={() => {
                    const unused = availableLabels.find(l => !settings.targetsByLabel[l]);
                    if(unused) updateTargetCount(unused, 1);
                }}
                disabled={Object.keys(settings.targetsByLabel).length >= availableLabels.length}
                style={{ ...buttonStyle(false), fontSize: '14px', padding: '5px 10px' }}
            >
                <Plus size={14}/> 追加
            </button>
        </div>
        
        {Object.keys(settings.targetsByLabel).length === 0 ? (
            <p style={{color: '#888', textAlign: 'center', padding: '20px', background: '#f9f9f9', borderRadius: '8px'}}>
                ターゲットが設定されていません。「追加」ボタンでターゲットを設定してください。
            </p>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(settings.targetsByLabel).map(([label, count]) => {
                    const validation = getTargetValidation(label, count);
                    return (
                        <div key={label} style={{ 
                            display: 'flex', alignItems: 'center', gap: '10px', 
                            background: validation.isValid ? '#f5f5f5' : '#FEF2F2', 
                            padding: '10px', borderRadius: '8px',
                            border: validation.isValid ? '1px solid transparent' : '1px solid #FECACA'
                        }}>
                            <select 
                                value={label}
                                onChange={(e) => {
                                    const newL = e.target.value;
                                    const n = {...settings.targetsByLabel};
                                    delete n[label];
                                    n[newL] = count;
                                    setSettings({...settings, targetsByLabel: n});
                                }}
                                style={{ ...inputStyle, flex: 1, borderColor: validation.isValid ? '#ddd' : '#FCA5A5' }}
                            >
                                {availableLabels.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <button onClick={() => updateTargetCount(label, count - 1)} style={iconBtnStyle}><Minus size={14}/></button>
                                
                                <input 
                                    type="number" 
                                    value={count} 
                                    onChange={(e) => updateTargetCount(label, parseInt(e.target.value)||0)}
                                    style={{ ...inputStyle, width: '50px', textAlign: 'center', padding: '5px' }}
                                    min="0"
                                />
                                
                                <button onClick={() => updateTargetCount(label, count + 1)} style={iconBtnStyle}><Plus size={14}/></button>
                            </div>

                            <button onClick={() => updateTargetCount(label, 0)} style={{...iconBtnStyle, color: 'red', background: '#fff'}}>×</button>
                            
                            {!validation.isValid && <span style={{color: '#DC2626', fontSize: '12px'}}>{validation.message}</span>}
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* 数値設定 */}
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
    const numTargets = graphData[0]?.probabilities.length || 0;
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16'];
    
    const datasets = Array.from({ length: numTargets }, (_, i) => ({
        label: `${i + 1}種類以上`,
        data: graphData.map(p => {
            const val = p.probabilities[i];
            return val !== undefined ? val * 100 : 0;
        }),
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '20',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: false
    }));

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeInOutCubic' as const },
        plugins: {
            title: { 
                display: true, 
                text: '欲しい装備の入手確率', 
                font: { size: 18, weight: 'bold' as const }, 
                padding: 20 
            },
            legend: { 
                display: true, 
                position: 'top' as const,
                labels: { usePointStyle: true, padding: 15 } 
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: 'white',
                bodyColor: 'white',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1,
                callbacks: {
                    title: (context: TooltipItem<'line'>[]) => `${context[0]?.label}回`,
                    label: (context: TooltipItem<'line'>) => {
                        return `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}%`;
                    }
                }
            }
        },
        scales: {
            x: { 
                title: { display: true, text: 'ガチャ回数', font: { size: 14, weight: 'bold' as const } },
                grid: { color: 'rgba(0, 0, 0, 0.1)' }
            },
            y: { 
                title: { display: true, text: '確率 (%)', font: { size: 14, weight: 'bold' as const } },
                min: 0, 
                max: 100,
                grid: { color: 'rgba(0, 0, 0, 0.1)' },
                ticks: {
                    callback: function(value: any) {
                        return value + '%';
                    }
                }
            }
        },
        interaction: {
            mode: 'index' as const,
            intersect: false
        },
        elements: {
            point: {
                hoverBorderWidth: 3
            }
        }
    };

    return (
        <div style={cardStyle}>
            <div style={{ height: '500px', width: '100%' }}>
                <Line ref={chartRef} data={{ labels, datasets }} options={options} />
            </div>
        </div>
    );
  };

  const renderAbout = () => (
      <div style={cardStyle}>
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
            <Info size={24} color="#3B82F6" />
            <h2 style={{fontSize: '1.5rem', margin: 0}}>このサイトについて</h2>
          </div>
          
          <div style={{ lineHeight: '1.8', color: '#444', marginBottom: '24px' }}>
            <p>このサイトは崩壊学園の祈り（ガチャ）の確率計算を行うサイトです。<br/>
            現在はお姫様の祈りのWピックアップ、通常ピックアップに対応していますが、今後他の祈りも追加していく予定です。<br/>
            バグや誤りがあれば制作者のXまでお願いします。</p>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
             <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#333' }}>使い方</h3>
             <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                    { num: 1, text: '祈りを選択します。' },
                    { num: 2, text: '確率タイプごとに、欲しい装備が何種類あるかを指定します。', note: ['タイプは基本的に「ピックアップ」「Wピックアップ」「追加枠」を選べば問題ありません。', '※「追加枠」とは、通常ピックアップで他のPU装備より確率が高い2種類の装備を指します。', '※ 詳細設定から確率の確認・変更も可能ですが、ガチャ毎の差は計算結果にほとんど影響しないため、基本的に変更は不要です。'] },
                    { num: 3, text: '最大ガチャ回数、グラフの間隔を指定します。複数個欲しい装備がある場合は各装備の必要個数で指定します（ただし個別には設定できません）。' },
                    { num: 4, text: '計算結果を確認します。グラフにカーソルを当てると詳細な数値が表示されます。' }
                ].map((step) => (
                    <li key={step.num} style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ 
                            background: '#3B82F6', color: '#fff', width: '24px', height: '24px', 
                            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px'
                        }}>{step.num}</span>
                        <div>
                            <div>{step.text}</div>
                            {step.note && (
                                <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666', background: '#f5f5f5', padding: '10px', borderRadius: '6px' }}>
                                    {step.note.map((n, i) => <p key={i} style={{ margin: '4px 0' }}>{n}</p>)}
                                </div>
                            )}
                        </div>
                    </li>
                ))}
             </ol>
             
             {/* 設定例を追加 */}
             <div style={{ marginTop: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '8px', fontSize: '14px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#1e40af' }}>設定例</h4>
                
                <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>例1：Wピックアップで、ピックアップの中に欲しい装備が4種類あり、1天井分の水晶がある場合</div>
                    <ul style={{ listStyle: 'disc', paddingLeft: '20px', margin: 0, color: '#555' }}>
                        <li>欲しい装備の設定：Wピックアップ、4</li>
                        <li>各装備の必要個数：1</li>
                        <li>最大ガチャ回数：100</li>
                        <li>グラフ間隔：任意</li>
                    </ul>
                </div>

                <div>
                    <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>例2：「ラニアット（鎮罪の蝶）」など崩壊学園キャラを完凸したい、かつピックアップに他に欲しい装備がない場合</div>
                    <ul style={{ listStyle: 'disc', paddingLeft: '20px', margin: 0, color: '#555' }}>
                        <li>欲しい装備の設定：ピックアップ、1</li>
                        <li>各装備の必要個数：4（無料分と合わせて5）</li>
                        <li>最大ガチャ回数：任意</li>
                        <li>グラフ間隔：任意</li>
                    </ul>
                </div>
             </div>
          </div>
      </div>
  );

  return (
    <>
      <PageHead site={config.site} title="祈り計算機" description="崩壊学園ガチャ確率計算機" />
      <NotionPageHeader block={null} />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px', minHeight: 'calc(100vh - 200px)', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', textAlign: 'center', fontWeight: '800', color: '#333' }}>
            祈り計算機
        </h1>

        {notification && <ErrorNotification error={notification} onClose={() => setNotification(null)} />}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
                { id: 'settings', label: '設定', icon: Calculator },
                { id: 'chart', label: '結果グラフ', icon: BarChart3 },
                { id: 'about', label: 'このサイトについて', icon: Info },
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                        ...tabStyle,
                        background: activeTab === tab.id ? '#3B82F6' : '#fff',
                        color: activeTab === tab.id ? '#fff' : '#555',
                        borderColor: activeTab === tab.id ? '#3B82F6' : '#ddd',
                        boxShadow: activeTab === tab.id ? '0 2px 4px rgba(59, 130, 246, 0.2)' : 'none'
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
    transition: 'all 0.2s',
    minWidth: '120px'
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
    transition: 'transform 0.1s',
    boxShadow: primary ? '0 4px 6px rgba(59, 130, 246, 0.3)' : 'none'
});

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s'
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
    color: '#555',
    transition: 'background 0.2s'
};

const iconBtnStyle: React.CSSProperties = {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#555'
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#444'
};