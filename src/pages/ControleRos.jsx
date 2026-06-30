import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, BarChart2, TrendingUp, TrendingDown, AlertCircle, FileWarning, Loader2, Layout, Columns, Table, Info, X, Save, Search, Filter, Edit, Download } from 'lucide-react';
import { supabase } from '../services/supabase-config';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const ControleRos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ros, setRos] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [buscaPlaca, setBuscaPlaca] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [formData, setFormData] = useState({
    equipamento: '', data_ocorrencia: '', tipo: '', avaria: '',
    custo_avaria: '', data_solicitacao: '', numero_chamado: '', numero_ro: ''
  });

  const handleExportPDF = async () => {
    const elementDash = document.getElementById('export-page-1');
    const elementTable = document.getElementById('export-page-2');
    if (!elementDash || !elementTable) return;

    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Página 1: Dashboard
      const canvasDash = await html2canvas(elementDash, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const dashHeight = (canvasDash.height * pdfWidth) / canvasDash.width;
      pdf.addImage(canvasDash.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, dashHeight);

      // Páginas Seguintes: Tabela Matriz com quebra automática
      pdf.addPage();
      const canvasTable = await html2canvas(elementTable, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const tableImgHeight = (canvasTable.height * pdfWidth) / canvasTable.width;
      
      let heightLeft = tableImgHeight;
      let position = 0;

      pdf.addImage(canvasTable.toDataURL('image/png'), 'PNG', 0, position, pdfWidth, tableImgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(canvasTable.toDataURL('image/png'), 'PNG', 0, position, pdfWidth, tableImgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('Relatorio_ROs.pdf');
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar o PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const fetchControleRos = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('controle_ros').select('*').order('data_ocorrencia', { ascending: false });
    if (!error && data) setRos(data);
    setLoading(false);
  };

  useEffect(() => { fetchControleRos(); }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const abrirModalNovaRo = () => {
    setEditingId(null);
    setFormData({ equipamento: '', data_ocorrencia: '', tipo: '', avaria: '', custo_avaria: '', data_solicitacao: '', numero_chamado: '', numero_ro: '' });
    setIsModalOpen(true);
  };

  const abrirModalEdicao = (item) => {
    setEditingId(item.id);
    setFormData({
      equipamento: item.equipamento || '', data_ocorrencia: item.data_ocorrencia || '', tipo: item.tipo || '',
      avaria: item.avaria || '', custo_avaria: item.custo_avaria || '', data_solicitacao: item.data_solicitacao || '',
      numero_chamado: item.numero_chamado || '', numero_ro: item.numero_ro || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmitRO = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const mesOcorrencia = formData.data_ocorrencia ? formData.data_ocorrencia.substring(5, 7) : null;
      const payload = {
        equipamento: formData.equipamento.toUpperCase(), data_ocorrencia: formData.data_ocorrencia || null, tipo: formData.tipo,
        avaria: formData.avaria, custo_avaria: formData.custo_avaria ? parseFloat(formData.custo_avaria) : null,
        data_solicitacao: formData.data_solicitacao || null, numero_chamado: formData.numero_chamado || null,
        numero_ro: formData.numero_ro || null, mes: mesOcorrencia
      };
      
      if (editingId) {
        await supabase.from('controle_ros').update(payload).eq('id', editingId);
      } else {
        await supabase.from('controle_ros').insert([payload]);
      }
      setIsModalOpen(false);
      fetchControleRos();
    } catch (error) {
      alert("Erro ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const rosFiltradas = ros.filter(r => {
    const matchPlaca = buscaPlaca === '' || (r.equipamento && r.equipamento.toLowerCase().includes(buscaPlaca.toLowerCase()));
    const matchMes = filtroMes === '' || (r.data_ocorrencia && r.data_ocorrencia.substring(5, 7) === filtroMes);
    return matchPlaca && matchMes;
  });
  
  const mesesDisponiveis = [...new Set(ros.map(r => r.data_ocorrencia ? r.data_ocorrencia.substring(5, 7) : null).filter(Boolean))].sort();
  const nomeMeses = { '01':'Janeiro', '02':'Fevereiro', '03':'Março', '04':'Abril', '05':'Maio', '06':'Junho', '07':'Julho', '08':'Agosto', '09':'Setembro', '10':'Outubro', '11':'Novembro', '12':'Dezembro' };
  
  const totalRos = rosFiltradas.length;
  const custoTotal = rosFiltradas.reduce((acc, curr) => acc + (Number(curr.custo_avaria) || 0), 0);
  const custoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoTotal);
  const rosAbertas = rosFiltradas.filter(r => !r.numero_ro).length;

  const anosOcorrencia = rosFiltradas.reduce((acc, curr) => {
    if(curr.data_ocorrencia) {
      const ano = curr.data_ocorrencia.substring(0,4);
      acc[ano] = (acc[ano] || 0) + 1;
    }
    return acc;
  }, {});
  
  const anosOrd = Object.keys(anosOcorrencia).sort();
  const anoAtualStr = anosOrd[anosOrd.length - 1];
  const anoAnteriorStr = anosOrd[anosOrd.length - 2];
  const mesAtual = new Date().getMonth() + 1; 
  const nomeMesYTD = nomeMeses[mesAtual.toString().padStart(2, '0')]?.substring(0,3).toUpperCase() || '';
  
  let qtdAnoAtualYTD = 0;
  let qtdAnoAnteriorYTD = 0;

  rosFiltradas.forEach(r => {
    if(r.data_ocorrencia) {
      const ano = r.data_ocorrencia.substring(0, 4);
      const mes = parseInt(r.data_ocorrencia.substring(5, 7), 10);
      if (mes <= mesAtual) {
        if (ano === anoAtualStr) qtdAnoAtualYTD++;
        if (ano === anoAnteriorStr) qtdAnoAnteriorYTD++;
      }
    }
  });

  let variacao = 0;
  let textoVariacao = "N/A";
  let isAumento = false;
  let isQueda = false;

  if (qtdAnoAnteriorYTD > 0) {
    variacao = ((qtdAnoAtualYTD - qtdAnoAnteriorYTD) / qtdAnoAnteriorYTD) * 100;
    isAumento = variacao > 0;
    isQueda = variacao < 0;
    textoVariacao = `${isAumento ? '+' : ''}${variacao.toFixed(1)}%`;
  }
  
  const dadosGraficoMensal = Object.values(rosFiltradas.reduce((acc, curr) => {
    if (curr.data_ocorrencia && curr.data_ocorrencia.length >= 7) {
      const ano = curr.data_ocorrencia.substring(0, 4);
      const mesStr = curr.data_ocorrencia.substring(5, 7);
      const chave = `${ano}-${mesStr}`; 
      if (!acc[chave]) {
        const mesAbrev = nomeMeses[mesStr] ? nomeMeses[mesStr].substring(0, 3).toUpperCase() : `MÊS ${mesStr}`;
        acc[chave] = { name: `${mesAbrev}/${ano}`, Ocorrencias: 0, chaveOrdenacao: chave };
      }
      acc[chave].Ocorrencias += 1;
    }
    return acc;
  }, {})).sort((a, b) => a.chaveOrdenacao.localeCompare(b.chaveOrdenacao));
  
  const processarComparativoAnual = () => {
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const dadosAnuais = meses.map(m => ({ name: m }));
    const anosPresentes = [...new Set(rosFiltradas.map(r => r.data_ocorrencia ? r.data_ocorrencia.substring(0, 4) : null).filter(Boolean))];
    
    rosFiltradas.forEach(r => {
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
  
  const contagemEquipamentos = rosFiltradas.reduce((acc, curr) => {
    if (curr.equipamento) acc[curr.equipamento] = (acc[curr.equipamento] || 0) + 1;
    return acc;
  }, {});
  const rankingEquipamentos = Object.entries(contagemEquipamentos).map(([equipamento, quantidade]) => ({ equipamento, quantidade })).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
  
  const contagemTipos = rosFiltradas.reduce((acc, curr) => {
    if (curr.tipo) acc[curr.tipo] = (acc[curr.tipo] || 0) + 1;
    return acc;
  }, {});
  const rankingTipos = Object.entries(contagemTipos).map(([tipo, quantidade]) => ({ tipo, quantidade })).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5);
    
  const kAguardandoSolicitacao = rosFiltradas.filter(r => r.data_ocorrencia && !r.numero_ro && (!r.data_solicitacao || !r.numero_chamado));
  const kAguardandoRo = rosFiltradas.filter(r => !r.numero_ro && r.data_solicitacao && r.numero_chamado);
  const kConcluido = rosFiltradas.filter(r => r.numero_ro);

  const resumoPlacaAno = {};
  rosFiltradas.forEach(r => {
    if (!r.equipamento || !r.data_ocorrencia) return;
    const ano = r.data_ocorrencia.substring(0, 4);
    const placa = r.equipamento;
    if (!resumoPlacaAno[placa]) {
      resumoPlacaAno[placa] = { total: 0 };
      anosDisponiveis.forEach(a => resumoPlacaAno[placa][a] = 0);
    }
    resumoPlacaAno[placa][ano] = (resumoPlacaAno[placa][ano] || 0) + 1;
    resumoPlacaAno[placa].total += 1;
  });
  const arrayResumo = Object.entries(resumoPlacaAno).map(([placa, dados]) => ({ placa, ...dados })).sort((a,b) => b.total - a.total);

  return (
    <div className="min-h-screen w-full bg-[#030712] text-white p-6 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#0f4c81]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#10b981]/10 rounded-full blur-[100px] pointer-events-none"></div>

      <header className="relative z-20 flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/10 pb-6">
        <div>
          <button onClick={() => navigate('/transporte-hub')} className="flex items-center gap-2 text-slate-400 hover:text-[#10b981] transition-colors text-xs font-black tracking-widest mb-3">
            <ArrowLeft size={16} /> VOLTAR AO HUB
          </button>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
            <FileWarning className="text-[#10b981]" size={36} /> Dashboard de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0f4c81] to-[#10b981]">ROs</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 z-30">
          <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50">
            {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
            <span className="hidden sm:inline">{isExporting ? 'Gerando...' : 'Exportar PDF'}</span>
          </button>
          <button onClick={abrirModalNovaRo} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#0e9f6e] hover:brightness-110 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Plus size={20} /> Registrar Nova RO
          </button>
        </div>
      </header>

      <div className="relative z-20 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
        <div className="flex gap-2 bg-white/[0.02] p-1.5 rounded-2xl w-fit border border-white/5 backdrop-blur-sm">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'dashboard' ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-slate-400 hover:text-white'}`}><Layout size={18} /> Visão Geral</button>
          <button onClick={() => setActiveTab('kanban')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'kanban' ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-slate-400 hover:text-white'}`}><Columns size={18} /> Quadro Kanban</button>
          <button onClick={() => setActiveTab('tabela')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'tabela' ? 'bg-[#10b981]/20 text-[#10b981]' : 'text-slate-400 hover:text-white'}`}><Table size={18} /> Dados Brutos</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative flex-grow sm:min-w-[250px]">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por placa..." value={buscaPlaca} onChange={(e) => setBuscaPlaca(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-[#10b981]/50 transition-all" />
          </div>
          <div className="relative min-w-[150px]">
            <Filter size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-[#10b981]/50 transition-all appearance-none">
              <option value="">Todos os Meses</option>
              {mesesDisponiveis.map(mes => (<option key={mes} value={mes}>{nomeMeses[mes] || mes}</option>))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-[#10b981] z-10 relative"><Loader2 size={48} className="animate-spin mb-4" /></div>
      ) : (
        <div className="animate-fade-in relative z-10">
          
          {activeTab === 'dashboard' && (
            <div className="p-2 -m-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
                  <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Total Registrado</h3>
                  <p className="text-4xl font-black">{totalRos}</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
                  <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Custo de Avarias</h3>
                  <p className="text-3xl font-black">{custoFormatado}</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
                  <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Pendentes (Sem N.º)</h3>
                  <p className="text-4xl font-black">{rosAbertas}</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                     <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Variação (JAN-{nomeMesYTD})</h3>
                     {isAumento ? <TrendingUp size={20} className="text-red-500" /> : <TrendingDown size={20} className={isQueda ? "text-[#10b981]" : "text-slate-500"} />}
                  </div>
                  <div className="flex items-end gap-3">
                    <p className={`text-3xl font-black ${isAumento ? 'text-red-400' : isQueda ? 'text-[#10b981]' : 'text-slate-300'}`}>{textoVariacao}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">{anoAnteriorStr ? `${anoAnteriorStr} ➔ ${anoAtualStr}` : '-'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md flex flex-col min-h-[350px]">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6">Comparativo Anual</h3>
                   <div className="flex-grow w-full h-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={comparativoAnual} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                         <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                         <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                         <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                         <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}/>
                         {anosDisponiveis.map((ano, i) => (
                           <Line key={ano} type="monotone" dataKey={ano} stroke={i === 0 ? '#10b981' : '#0f4c81'} strokeWidth={3} dot={{ r: 4 }}>
                             <LabelList dataKey={ano} position="top" fill={i === 0 ? '#10b981' : '#64748b'} fontSize={11} fontWeight="bold" />
                           </Line>
                         ))}
                       </LineChart>
                     </ResponsiveContainer>
                   </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md flex flex-col min-h-[350px]">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6">Histórico Mensal</h3>
                   <div className="flex-grow w-full h-full overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'thin' }}>
                     <div style={{ minWidth: `${Math.max(dadosGraficoMensal.length * 60, 400)}px`, height: '100%' }}>
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={dadosGraficoMensal} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                           <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                           <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                           <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                           <Bar dataKey="Ocorrencias" radius={[6, 6, 0, 0]}>
                             <LabelList dataKey="Ocorrencias" position="top" fill="#cbd5e1" fontSize={11} fontWeight="bold" />
                             {dadosGraficoMensal.map((entry, index) => (<Cell key={`cell-${index}`} fill={index === dadosGraficoMensal.length - 1 ? '#10b981' : '#0f4c81'} />))}
                           </Bar>
                         </BarChart>
                       </ResponsiveContainer>
                     </div>
                   </div>
                </div>
              </div>

              {/* RETORNO DOS RANKINGS NO DASHBOARD UI */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-4 flex items-center gap-2">
                     <AlertCircle className="text-amber-500"/> Top 5 Equipamentos
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
                     <FileWarning className="text-red-500"/> Ranking por Tipo
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
            </div>
          )}

          {activeTab === 'kanban' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex justify-between bg-red-500/10 p-3 rounded-xl border border-red-500/20"><h3 className="font-bold text-red-400 text-xs tracking-widest">Aguardando Sol.</h3></div>
                {kAguardandoSolicitacao.map(item => (
                  <div key={item.id} onClick={() => abrirModalEdicao(item)} className="bg-white/[0.04] p-4 rounded-2xl border border-white/5 cursor-pointer"><p className="font-black text-white">{item.equipamento}</p></div>
                 ))}
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex justify-between bg-amber-500/10 p-3 rounded-xl border border-amber-500/20"><h3 className="font-bold text-amber-400 text-xs tracking-widest">Aguardando RO</h3></div>
                {kAguardandoRo.map(item => (
                  <div key={item.id} onClick={() => abrirModalEdicao(item)} className="bg-white/[0.04] p-4 rounded-2xl border border-white/5 cursor-pointer"><p className="font-black text-white">{item.equipamento}</p></div>
                ))}
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex justify-between bg-[#10b981]/10 p-3 rounded-xl border border-[#10b981]/20"><h3 className="font-bold text-[#10b981] text-xs tracking-widest">Concluído</h3></div>
                 {kConcluido.map(item => (
                  <div key={item.id} onClick={() => abrirModalEdicao(item)} className="bg-white/[0.04] p-4 rounded-2xl border border-white/5 cursor-pointer"><p className="font-black text-white">{item.equipamento}</p></div>
                ))}
              </div>
            </div>
           )}

          {activeTab === 'tabela' && (
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-xs uppercase">
                    <th className="p-4 font-bold">Equipamento (Passe o Mouse)</th>
                    <th className="p-4 font-bold">Data</th>
                    <th className="p-4 font-bold">Status</th>
                    <th className="p-4 font-bold">Nº RO</th>
                    <th className="p-4 font-bold text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rosFiltradas.map((item, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors group relative cursor-help">
                      <td className="p-4 font-black text-white relative">
                        <div className="flex items-center gap-2">
                          {item.equipamento}
                          <Info size={14} className="text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
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
                      <td className="p-4 text-center">
                        <button onClick={() => abrirModalEdicao(item)} className="text-slate-400 hover:text-[#10b981] bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors"><Edit size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {rosFiltradas.length === 0 && (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-bold">Nenhum registro encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in">
          <div className="bg-[#0f172a] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/[0.02]">
              <h2 className="text-xl font-black text-white">{editingId ? 'Editar Ocorrência' : 'Nova Ocorrência'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitRO} className="p-6 overflow-y-auto flex flex-col gap-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input required name="equipamento" value={formData.equipamento} onChange={handleInputChange} type="text" placeholder="Equipamento" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white uppercase" />
                  <input required name="data_ocorrencia" value={formData.data_ocorrencia} onChange={handleInputChange} type="date" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white [color-scheme:dark]" />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input required name="tipo" value={formData.tipo} onChange={handleInputChange} type="text" placeholder="Tipo" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
                  <input name="custo_avaria" value={formData.custo_avaria} onChange={handleInputChange} type="number" step="0.01" placeholder="Custo R$" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
               </div>
               <textarea name="avaria" value={formData.avaria} onChange={handleInputChange} rows="3" placeholder="Descrição..." className="bg-white/5 border border-white/10 rounded-xl p-3 text-white resize-none"></textarea>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/10 pt-4">
                  <input name="data_solicitacao" value={formData.data_solicitacao} onChange={handleInputChange} type="date" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white [color-scheme:dark]" />
                  <input name="numero_chamado" value={formData.numero_chamado} onChange={handleInputChange} type="text" placeholder="Chamado" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white" />
                  <input name="numero_ro" value={formData.numero_ro} onChange={handleInputChange} type="text" placeholder="Nº RO" className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl p-3 text-white" />
               </div>
               <div className="mt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-300">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="bg-[#10b981] text-white px-8 py-3 rounded-xl font-bold">{isSubmitting ? 'Salvando...' : 'Salvar'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* ÁREA DE EXPORTAÇÃO PDF OCULTA */}
      <div className="absolute top-[-9999px] left-[-9999px]">
        <div id="export-page-1" className="bg-white text-slate-800 p-8 w-[1000px]">
          <h2 className="text-3xl font-black text-slate-800 mb-6 border-b border-slate-200 pb-4">Relatório de Gestão - ROs</h2>
          <div className="grid grid-cols-4 gap-4 mb-10">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="text-slate-500 text-[10px] font-black uppercase mb-1">Total Registrado</h3><p className="text-2xl font-black">{totalRos}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="text-slate-500 text-[10px] font-black uppercase mb-1">Custo Total</h3><p className="text-2xl font-black">{custoFormatado}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="text-slate-500 text-[10px] font-black uppercase mb-1">Pendentes</h3><p className="text-2xl font-black">{rosAbertas}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h3 className="text-slate-500 text-[10px] font-black uppercase mb-1">Var YTD (JAN-{nomeMesYTD})</h3>
              <p className={`text-2xl font-black ${isAumento ? 'text-red-500' : isQueda ? 'text-[#10b981]' : 'text-slate-800'}`}>{textoVariacao}</p>
            </div>
          </div>
          <div className="mb-10 h-[350px]">
            <h3 className="text-lg font-black text-slate-800 mb-4">Comparativo Anual</h3>
            <LineChart width={936} height={300} data={comparativoAnual} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#334155' }}/>
              {anosDisponiveis.map((ano, i) => (
                <Line key={ano} type="monotone" dataKey={ano} stroke={i === 0 ? '#10b981' : '#0f4c81'} strokeWidth={3} dot={{ r: 4 }}>
                  <LabelList dataKey={ano} position="top" fill={i === 0 ? '#10b981' : '#64748b'} fontSize={11} fontWeight="bold" />
                </Line>
              ))}
            </LineChart>
          </div>
          <div className="h-[350px]">
            <h3 className="text-lg font-black text-slate-800 mb-4">Histórico Mensal Geral</h3>
            <BarChart width={936} height={300} data={dadosGraficoMensal} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Bar dataKey="Ocorrencias" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="Ocorrencias" position="top" fill="#64748b" fontSize={11} fontWeight="bold" />
                {dadosGraficoMensal.map((entry, index) => (<Cell key={`cell-${index}`} fill={index === dadosGraficoMensal.length - 1 ? '#10b981' : '#0f4c81'} />))}
              </Bar>
            </BarChart>
          </div>
        </div>

        {/* NOTA: Removido o fixed height 'h-[1414px]' daqui para a tabela crescer livremente */}
        <div id="export-page-2" className="bg-white text-slate-800 p-8 w-[1000px]">
          <h2 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-200 pb-4">Matriz Analítica - Equipamentos por Ano</h2>
          <table className="w-full text-left border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-xs uppercase tracking-widest">
                <th className="p-3 border border-slate-300 font-bold">Placa</th>
                {anosDisponiveis.map(ano => <th key={ano} className="p-3 border border-slate-300 font-bold text-center">{ano}</th>)}
                <th className="p-3 border border-slate-300 font-bold text-center">Total Geral</th>
              </tr>
            </thead>
            <tbody>
              {arrayResumo.map(row => (
                <tr key={row.placa} className="border-b border-slate-200 text-sm">
                  <td className="p-3 border border-slate-300 font-black">{row.placa}</td>
                  {anosDisponiveis.map(ano => <td key={ano} className="p-3 border border-slate-300 text-center">{row[ano] || '-'}</td>)}
                  <td className="p-3 border border-slate-300 font-bold text-center bg-slate-50">{row.total}</td>
                </tr>
              ))}
              <tr className="bg-slate-800 text-white font-bold text-sm">
                 <td className="p-3 border border-slate-600">TOTAIS (GERAL)</td>
                 {anosDisponiveis.map(ano => (
                   <td key={ano} className="p-3 border border-slate-600 text-center">{arrayResumo.reduce((acc, curr) => acc + (curr[ano] || 0), 0)}</td>
                 ))}
                 <td className="p-3 border border-slate-600 text-center">{arrayResumo.reduce((acc, curr) => acc + curr.total, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default ControleRos;
