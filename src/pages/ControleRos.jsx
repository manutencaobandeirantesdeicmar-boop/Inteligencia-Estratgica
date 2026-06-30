import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, BarChart2, TrendingUp, AlertCircle, FileWarning, 
  Loader2, Layout, Columns, Table, Info 
} from 'lucide-react';
import { supabase } from '../services/supabase-config';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

const ControleRos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ros, setRos] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'kanban', 'tabela'

  // ==============================
  // FETCH DE DADOS DO SUPABASE
  // ==============================
  const fetchControleRos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('controle_ros')
      .select('*')
      .order('data_ocorrencia', { ascending: false });

    if (!error && data) {
      setRos(data);
    } else {
      console.error("Erro ao buscar ROs:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchControleRos();
  }, []);

  // ==============================
  // PROCESSAMENTO DOS KPIs E GRÁFICOS
  // ==============================
  
  const totalRos = ros.length;
  const custoTotal = ros.reduce((acc, curr) => acc + (Number(curr.custo_avaria) || 0), 0);
  const custoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoTotal);
  
  // ROs Pendentes: Se NÃO tem numero_ro, está pendente
  const rosAbertas = ros.filter(r => !r.numero_ro).length;

  // Gráfico Mensal (Geral)
  const dadosGraficoMensal = ros.reduce((acc, curr) => {
    if (curr.mes) {
      const mesAbrev = curr.mes.substring(0, 3).toUpperCase();
      const itemExistente = acc.find(item => item.name === mesAbrev);
      if (itemExistente) {
        itemExistente.Ocorrencias += 1;
      } else {
        acc.push({ name: mesAbrev, Ocorrencias: 1 });
      }
    }
    return acc;
  }, []).reverse();

  // Gráfico Anual (Comparativo Linha)
  const processarComparativoAnual = () => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const dadosAnuais = meses.map(m => ({ name: m }));
    const anosPresentes = [...new Set(ros.map(r => r.data_ocorrencia ? r.data_ocorrencia.substring(0, 4) : null).filter(Boolean))];

    ros.forEach(r => {
      if (!r.data_ocorrencia) return;
      const ano = r.data_ocorrencia.substring(0, 4);
      const mesIdx = parseInt(r.data_ocorrencia.substring(5, 7)) - 1;
      
      if (mesIdx >= 0 && mesIdx <= 11) {
        const linha = dadosAnuais.find(d => d.name === meses[mesIdx]);
        linha[ano] = (linha[ano] || 0) + 1;
      }
    });
    return { dados: dadosAnuais, anos: anosPresentes.sort() };
  };
  const { dados: comparativoAnual, anos: anosDisponiveis } = processarComparativoAnual();

  // Ranking de Equipamentos
  const contagemEquipamentos = ros.reduce((acc, curr) => {
    if (curr.equipamento) acc[curr.equipamento] = (acc[curr.equipamento] || 0) + 1;
    return acc;
  }, {});
  const rankingEquipamentos = Object.entries(contagemEquipamentos)
    .map(([equipamento, quantidade]) => ({ equipamento, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  // Ranking por Tipo
  const contagemTipos = ros.reduce((acc, curr) => {
    if (curr.tipo) acc[curr.tipo] = (acc[curr.tipo] || 0) + 1;
    return acc;
  }, {});
  const rankingTipos = Object.entries(contagemTipos)
    .map(([tipo, quantidade]) => ({ tipo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  // ==============================
  // PROCESSAMENTO DO KANBAN
  // ==============================
  // 1. Aguardando Solicitação (Tem data, não tem RO nem chamado)
  const kAguardandoSolicitacao = ros.filter(r => r.data_ocorrencia && !r.numero_ro && (!r.data_solicitacao || !r.numero_chamado));
  // 2. Aguardando RO (Tem solicitação e chamado, mas não tem RO)
  const kAguardandoRo = ros.filter(r => !r.numero_ro && r.data_solicitacao && r.numero_chamado);
  // 3. OK (Tem número do RO)
  const kConcluido = ros.filter(r => r.numero_ro);

  return (
    <div className="min-h-screen w-full bg-[#030712] text-white p-6 md:p-8 relative overflow-hidden font-sans">
       {/* Auras de fundo */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#0f4c81]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#10b981]/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* HEADER */}
      <header className="relative z-20 flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/10 pb-6">
        <div>
          <button onClick={() => navigate('/transporte-hub')} className="flex items-center gap-2 text-slate-400 hover:text-[#10b981] transition-colors text-xs font-black tracking-widest mb-3">
            <ArrowLeft size={16} /> VOLTAR AO HUB
          </button>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
            <FileWarning className="text-[#10b981]" size={36} />
            Dashboard de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0f4c81] to-[#10b981]">ROs</span>
          </h1>
          <p className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-wider">Gestão e Relatórios de Ocorrência</p>
        </div>
        
        {/* Botão de Nova RO (Adicionado um alert provisório no onClick para testar) */}
        <button onClick={() => alert('Abrir modal/página de Nova RO')} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#0e9f6e] hover:brightness-110 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] z-30">
          <Plus size={20} />
          Registrar Nova RO
        </button>
      </header>

      {/* CONTROLES DE ABAS */}
      <div className="relative z-20 flex gap-2 mb-8 bg-white/[0.02] p-1.5 rounded-2xl w-fit border border-white/5 backdrop-blur-sm">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'dashboard' ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-slate-400 hover:text-white'}`}>
          <Layout size={18} /> Visão Geral
        </button>
        <button onClick={() => setActiveTab('kanban')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'kanban' ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-slate-400 hover:text-white'}`}>
          <Columns size={18} /> Quadro Kanban
        </button>
        <button onClick={() => setActiveTab('tabela')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'tabela' ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-slate-400 hover:text-white'}`}>
          <Table size={18} /> Tabela Interativa
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-[#10b981] z-10 relative">
           <Loader2 size={48} className="animate-spin mb-4" />
           <p className="font-bold tracking-widest uppercase text-sm">Carregando Base de Dados...</p>
        </div>
      ) : (
        <div className="animate-fade-in relative z-10">
          
          {/* =========================================
              ABA 1: DASHBOARD GERAL
             ========================================= */}
          {activeTab === 'dashboard' && (
            <>
              {/* GRID DE KPIS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#0f4c81]/20 rounded-bl-full blur-2xl group-hover:bg-[#0f4c81]/40 transition-colors"></div>
                  <div className="flex justify-between items-center mb-2 relative z-10">
                     <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Total Registrado</h3>
                     <FileWarning size={20} className="text-[#0f4c81]" />
                  </div>
                  <p className="text-4xl md:text-5xl font-black relative z-10">{totalRos}</p>
                </div>
                
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full blur-2xl group-hover:bg-red-500/20 transition-colors"></div>
                  <div className="flex justify-between items-center mb-2 relative z-10">
                     <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Custo Total (Avarias)</h3>
                     <TrendingUp size={20} className="text-red-500" />
                  </div>
                  <p className="text-3xl md:text-4xl font-black text-white relative z-10">{custoFormatado}</p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full blur-2xl group-hover:bg-amber-500/20 transition-colors"></div>
                  <div className="flex justify-between items-center mb-2 relative z-10">
                     <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">ROs Pendentes (Sem N.º)</h3>
                     <AlertCircle size={20} className="text-amber-500" />
                  </div>
                  <p className="text-4xl md:text-5xl font-black relative z-10">{rosAbertas}</p>
                </div>
              </div>

              {/* GRÁFICOS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Gráfico Comparativo Anual */}
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col min-h-[350px]">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
                     <TrendingUp className="text-[#0f4c81]"/> Comparativo Anual
                   </h3>
                   <div className="flex-grow w-full h-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={comparativoAnual} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                         <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                         <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                         <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}/>
                         {anosDisponiveis.map((ano, i) => (
                           <Line key={ano} type="monotone" dataKey={ano} stroke={i === 0 ? '#10b981' : '#0f4c81'} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                         ))}
                       </LineChart>
                     </ResponsiveContainer>
                   </div>
                </div>

                {/* Gráfico Barras Histórico */}
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col min-h-[350px]">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
                     <BarChart2 className="text-[#10b981]"/> Histórico Mensal Geral
                   </h3>
                   <div className="flex-grow w-full h-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={dadosGraficoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                         <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                         <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                         <Bar dataKey="Ocorrencias" radius={[6, 6, 0, 0]}>
                           {dadosGraficoMensal.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={index === dadosGraficoMensal.length - 1 ? '#10b981' : '#0f4c81'} />
                           ))}
                         </Bar>
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                </div>
              </div>

              {/* RANKINGS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
                     <AlertCircle className="text-amber-500"/> Top 5 Equipamentos com Avarias
                   </h3>
                   <div className="flex flex-col gap-3">
                     {rankingEquipamentos.map((item, index) => (
                       <div key={item.equipamento} className="flex items-center justify-between bg-white/[0.03] border border-white/5 p-4 rounded-2xl hover:bg-white/[0.06] transition-colors">
                         <div className="flex items-center gap-4">
                           <span className={`text-lg font-black w-6 text-center ${index === 0 ? 'text-red-500' : index === 1 ? 'text-amber-500' : 'text-slate-500'}`}>{index + 1}º</span>
                           <div>
                             <p className="font-black text-white">{item.equipamento}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">Frota</p>
                           </div>
                         </div>
                         <div className="bg-white/10 px-3 py-1 rounded-lg text-sm font-black">{item.quantidade} <span className="text-[10px] font-normal text-slate-400">ROs</span></div>
                       </div>
                     ))}
                   </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
                     <FileWarning className="text-red-500"/> Ranking por Tipo de Ocorrência
                   </h3>
                   <div className="flex flex-col gap-3">
                     {rankingTipos.map((item, index) => (
                       <div key={item.tipo} className="flex items-center justify-between bg-white/[0.03] border border-white/5 p-4 rounded-2xl hover:bg-white/[0.06] transition-colors">
                         <div className="flex items-center gap-4">
                           <span className={`text-lg font-black w-6 text-center ${index === 0 ? 'text-red-500' : index === 1 ? 'text-amber-500' : 'text-slate-500'}`}>{index + 1}º</span>
                           <div>
                             <p className="font-black text-white capitalize">{item.tipo || 'Não Definido'}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">Categoria</p>
                           </div>
                         </div>
                         <div className="bg-white/10 px-3 py-1 rounded-lg text-sm font-black">{item.quantidade} <span className="text-[10px] font-normal text-slate-400">QTD</span></div>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </>
          )}

          {/* =========================================
              ABA 2: KANBAN DE ACOMPANHAMENTO
             ========================================= */}
          {activeTab === 'kanban' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
              {/* Coluna 1 */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  <h3 className="font-bold text-red-400 uppercase text-xs tracking-widest">Aguardando Solicitação</h3>
                  <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-black">{kAguardandoSolicitacao.length}</span>
                </div>
                {kAguardandoSolicitacao.map(item => (
                  <div key={item.id} className="bg-white/[0.04] p-4 rounded-2xl border border-white/5 hover:border-red-500/30 transition-colors cursor-pointer">
                    <p className="font-black text-lg text-white mb-1">{item.equipamento}</p>
                    <p className="text-xs text-slate-400 mb-2">Ocorrência: <span className="text-slate-200">{item.data_ocorrencia}</span></p>
                    <span className="inline-block px-2 py-1 bg-red-500/20 text-red-300 text-[10px] rounded uppercase font-bold">{item.tipo}</span>
                  </div>
                ))}
              </div>

              {/* Coluna 2 */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                  <h3 className="font-bold text-amber-400 uppercase text-xs tracking-widest">Aguardando RO</h3>
                  <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-black">{kAguardandoRo.length}</span>
                </div>
                {kAguardandoRo.map(item => (
                  <div key={item.id} className="bg-white/[0.04] p-4 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-colors cursor-pointer">
                    <p className="font-black text-lg text-white mb-1">{item.equipamento}</p>
                    <p className="text-xs text-slate-400">Solicitado: <span className="text-slate-200">{item.data_solicitacao}</span></p>
                    <p className="text-xs text-slate-400 mb-2">Chamado: <span className="text-amber-300 font-bold">{item.numero_chamado}</span></p>
                    <span className="inline-block px-2 py-1 bg-amber-500/20 text-amber-300 text-[10px] rounded uppercase font-bold">{item.tipo}</span>
                  </div>
                ))}
              </div>

              {/* Coluna 3 */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between bg-[#10b981]/10 p-3 rounded-xl border border-[#10b981]/20">
                  <h3 className="font-bold text-[#10b981] uppercase text-xs tracking-widest">RO Finalizada (OK)</h3>
                  <span className="bg-[#10b981]/20 text-[#10b981] px-2 py-1 rounded text-xs font-black">{kConcluido.length}</span>
                </div>
                {kConcluido.map(item => (
                  <div key={item.id} className="bg-white/[0.04] p-4 rounded-2xl border border-white/5 hover:border-[#10b981]/30 transition-colors cursor-pointer opacity-70 hover:opacity-100">
                    <p className="font-black text-lg text-white mb-1">{item.equipamento}</p>
                    <p className="text-xs text-slate-400 mb-2">Nº RO: <span className="text-[#10b981] font-bold">{item.numero_ro}</span></p>
                    <span className="inline-block px-2 py-1 bg-[#10b981]/20 text-[#10b981] text-[10px] rounded uppercase font-bold">CONCLUÍDO</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================
              ABA 3: TABELA INTERATIVA
             ========================================= */}
          {activeTab === 'tabela' && (
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-widest">
                      <th className="p-4 font-bold">Equipamento (Passe o Mouse)</th>
                      <th className="p-4 font-bold">Data Ocorrência</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold">Nº RO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ros.map((item, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors group relative cursor-help">
                        <td className="p-4 font-black text-white relative">
                          <div className="flex items-center gap-2">
                            {item.equipamento}
                            <Info size={14} className="text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                          </div>
                          
                          {/* TOOLTIP INTERATIVO */}
                          <div className="absolute left-4 top-12 z-50 hidden group-hover:flex flex-col gap-1 w-64 bg-[#0f172a] border border-[#10b981]/30 p-4 rounded-xl shadow-2xl">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Detalhes da Avaria</p>
                            <p className="text-sm"><span className="text-slate-500">Data:</span> <span className="text-white">{item.data_ocorrencia}</span></p>
                            <p className="text-sm"><span className="text-slate-500">Tipo:</span> <span className="text-[#10b981] font-bold">{item.tipo || 'N/A'}</span></p>
                            <p className="text-sm mt-1 text-slate-300 italic">"{item.avaria || 'Sem descrição informada.'}"</p>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-300">{item.data_ocorrencia || '-'}</td>
                        <td className="p-4">
                          {item.numero_ro ? (
                            <span className="bg-[#10b981]/20 text-[#10b981] px-2 py-1 rounded text-xs font-black uppercase">Finalizado</span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-black uppercase">Pendente</span>
                          )}
                        </td>
                        <td className="p-4 text-sm font-bold text-slate-300">{item.numero_ro || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      <style>{`
        @keyframes fade-in { 
          from { opacity: 0; transform: translateY(10px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-fade-in { 
          animation: fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default ControleRos;
