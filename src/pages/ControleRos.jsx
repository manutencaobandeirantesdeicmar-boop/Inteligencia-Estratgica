import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, BarChart2, TrendingUp, AlertCircle, FileWarning, 
  Loader2, Layout, Columns, Table, Info, X, Save, Search, Filter, Edit, Download
} from 'lucide-react';
import { supabase } from '../services/supabase-config';
// IMPORT ATUALIZADO: Adicionado 'LabelList'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const ControleRos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ros, setRos] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // ==============================
  // ESTADOS DE FILTRO
  // ==============================
  const [buscaPlaca, setBuscaPlaca] = useState('');
  const [filtroMes, setFiltroMes] = useState('');

  // ==============================
  // EXPORTAÇÃO PARA PDF (ATUALIZADO PARA 2 PÁGINAS)
  // ==============================
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    const elementDashboard = document.getElementById('dashboard-export-area');
    const elementTable = document.getElementById('table-export-area'); // Nova área da tabela
    if (!elementDashboard || !elementTable) return;

    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();

      // --- PÁGINA 1: Capturar Dashboard ---
      const canvasDash = await html2canvas(elementDashboard, {
        scale: 2, 
        backgroundColor: '#030712', 
        useCORS: true, 
      });
      const imgDataDash = canvasDash.toDataURL('image/png');
      const dashHeight = (canvasDash.height * pdfWidth) / canvasDash.width;
      pdf.addImage(imgDataDash, 'PNG', 0, 0, pdfWidth, dashHeight);

      // --- PÁGINA 2: Capturar Tabela Oculta ---
      pdf.addPage();
      const canvasTable = await html2canvas(elementTable, {
        scale: 2, 
        backgroundColor: '#030712', 
        useCORS: true, 
      });
      const imgDataTable = canvasTable.toDataURL('image/png');
      const tableHeight = (canvasTable.height * pdfWidth) / canvasTable.width;
      pdf.addImage(imgDataTable, 'PNG', 0, 0, pdfWidth, tableHeight);

      pdf.save('Resumo_Dashboard_ROs.pdf');
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar o relatório em PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  // ==============================
  // ESTADOS DO MODAL (CRIAR/EDITAR)
  // ==============================
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [formData, setFormData] = useState({
    equipamento: '',
    data_ocorrencia: '',
    tipo: '',
    avaria: '',
    custo_avaria: '',
    data_solicitacao: '',
    numero_chamado: '',
    numero_ro: ''
  });

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
  // HANDLERS DO FORMULÁRIO E MODAL
  // ==============================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const abrirModalNovaRo = () => {
    setEditingId(null);
    setFormData({
      equipamento: '', data_ocorrencia: '', tipo: '', avaria: '', 
      custo_avaria: '', data_solicitacao: '', numero_chamado: '', numero_ro: ''
    });
    setIsModalOpen(true);
  };

  const abrirModalEdicao = (item) => {
    setEditingId(item.id);
    setFormData({
      equipamento: item.equipamento || '',
      data_ocorrencia: item.data_ocorrencia || '',
      tipo: item.tipo || '',
      avaria: item.avaria || '',
      custo_avaria: item.custo_avaria || '',
      data_solicitacao: item.data_solicitacao || '',
      numero_chamado: item.numero_chamado || '',
      numero_ro: item.numero_ro || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmitRO = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const mesOcorrencia = formData.data_ocorrencia 
        ? formData.data_ocorrencia.substring(5, 7) 
        : null;
        
      const payload = {
        equipamento: formData.equipamento.toUpperCase(),
        data_ocorrencia: formData.data_ocorrencia || null,
        tipo: formData.tipo,
        avaria: formData.avaria,
        custo_avaria: formData.custo_avaria ? parseFloat(formData.custo_avaria) : null,
        data_solicitacao: formData.data_solicitacao || null,
        numero_chamado: formData.numero_chamado || null,
        numero_ro: formData.numero_ro || null,
        mes: mesOcorrencia
      };
      
      if (editingId) {
        // ATUALIZAR RO EXISTENTE
        const { error } = await supabase
          .from('controle_ros')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        // INSERIR NOVA RO
        const { error } = await supabase
          .from('controle_ros')
          .insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchControleRos(); // Recarrega os dados

    } catch (error) {
      console.error("Erro ao salvar RO:", error);
      alert("Erro ao salvar os dados. Verifique o console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==============================
  // APLICAÇÃO DOS FILTROS GLOBAIS
  // ==============================
  const rosFiltradas = ros.filter(r => {
    const matchPlaca = buscaPlaca === '' || (r.equipamento && r.equipamento.toLowerCase().includes(buscaPlaca.toLowerCase()));
    const matchMes = filtroMes === '' || (r.data_ocorrencia && r.data_ocorrencia.substring(5, 7) === filtroMes);
    return matchPlaca && matchMes;
  });
  
  // Lista de meses disponíveis nos dados para o Dropdown de Filtro
  const mesesDisponiveis = [...new Set(ros.map(r => r.data_ocorrencia ? r.data_ocorrencia.substring(5, 7) : null).filter(Boolean))].sort();
  const nomeMeses = { '01':'Janeiro', '02':'Fevereiro', '03':'Março', '04':'Abril', '05':'Maio', '06':'Junho', '07':'Julho', '08':'Agosto', '09':'Setembro', '10':'Outubro', '11':'Novembro', '12':'Dezembro' };
  
  // ==============================
  // PROCESSAMENTO DOS KPIs E GRÁFICOS
  // ==============================
  const totalRos = rosFiltradas.length;
  const custoTotal = rosFiltradas.reduce((acc, curr) => acc + (Number(curr.custo_avaria) || 0), 0);
  const custoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoTotal);
  const rosAbertas = rosFiltradas.filter(r => !r.numero_ro).length;
  
  const dadosGraficoMensal = Object.values(rosFiltradas.reduce((acc, curr) => {
    if (curr.data_ocorrencia && curr.data_ocorrencia.length >= 7) {
      const ano = curr.data_ocorrencia.substring(0, 4);
      const mesStr = curr.data_ocorrencia.substring(5, 7);
      const chave = `${ano}-${mesStr}`; 
      
      if (!acc[chave]) {
        const mesAbrev = nomeMeses[mesStr] ? nomeMeses[mesStr].substring(0, 3).toUpperCase() : `MÊS ${mesStr}`;
        acc[chave] = { 
          name: `${mesAbrev}/${ano}`, 
          Ocorrencias: 0,
          chaveOrdenacao: chave
        };
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
  
  const rankingEquipamentos = Object.entries(contagemEquipamentos)
    .map(([equipamento, quantidade]) => ({ equipamento, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);
    
  const contagemTipos = rosFiltradas.reduce((acc, curr) => {
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
  const kAguardandoSolicitacao = rosFiltradas.filter(r => r.data_ocorrencia && !r.numero_ro && (!r.data_solicitacao || !r.numero_chamado));
  const kAguardandoRo = rosFiltradas.filter(r => !r.numero_ro && r.data_solicitacao && r.numero_chamado);
  const kConcluido = rosFiltradas.filter(r => r.numero_ro);
  
  return (
    <div className="min-h-screen w-full bg-[#030712] text-white p-6 md:p-8 relative overflow-hidden font-sans">
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
        
        <div className="flex items-center gap-3 z-30">
          <button 
            onClick={handleExportPDF} 
            disabled={isExporting || activeTab !== 'dashboard'}
            className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={activeTab !== 'dashboard' ? "Acesse a aba 'Visão Geral' para exportar" : "Exportar Dashboard em PDF"}
          >
            {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
            <span className="hidden sm:inline">{isExporting ? 'Gerando...' : 'Exportar PDF'}</span>
          </button>

          <button onClick={abrirModalNovaRo} className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#0e9f6e] hover:brightness-110 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
            <Plus size={20} />
            Registrar Nova RO
          </button>
        </div>
      </header>

      {/* BARRA DE FERRAMENTAS: ABAS E FILTROS */}
      <div className="relative z-20 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
        
        <div className="flex gap-2 bg-white/[0.02] p-1.5 rounded-2xl w-fit border border-white/5 backdrop-blur-sm">
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

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative flex-grow sm:min-w-[250px]">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por placa ou equipamento..." 
              value={buscaPlaca}
              onChange={(e) => setBuscaPlaca(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all"
            />
          </div>
          
          <div className="relative min-w-[150px]">
            <Filter size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <select 
              value={filtroMes} 
              onChange={(e) => setFiltroMes(e.target.value)}
              className="w-full bg-[#0f172a] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all appearance-none cursor-pointer"
            >
              <option value="">Todos os Meses</option>
              {mesesDisponiveis.map(mes => (
                <option key={mes} value={mes}>{nomeMeses[mes] || mes}</option>
              ))}
            </select>
          </div>
        </div>
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
            <div id="dashboard-export-area" className="p-2 -m-2">
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
                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col min-h-[350px]">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
                     <TrendingUp className="text-[#0f4c81]"/> Comparativo Anual
                   </h3>
                   <div className="flex-grow w-full h-full">
                     <ResponsiveContainer width="100%" height="100%">
                       {/* Aumento do margin-top para 25 para os Labels caberem */}
                       <LineChart data={comparativoAnual} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                         <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                         <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                         <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                         <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }}/>
                         {anosDisponiveis.map((ano, i) => (
                           <Line key={ano} type="monotone" dataKey={ano} stroke={i === 0 ? '#10b981' : '#0f4c81'} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                             {/* NOVO: Rótulos de Dados no Gráfico de Linha */}
                             <LabelList dataKey={ano} position="top" fill={i === 0 ? '#10b981' : '#64748b'} fontSize={11} fontWeight="bold" />
                           </Line>
                         ))}
                       </LineChart>
                     </ResponsiveContainer>
                   </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col min-h-[350px]">
                   <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
                     <BarChart2 className="text-[#10b981]"/> Histórico Mensal Geral
                   </h3>
                   <div className="flex-grow w-full h-full overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent' }}>
                     <div style={{ minWidth: `${Math.max(dadosGraficoMensal.length * 60, 400)}px`, height: '100%' }}>
                       <ResponsiveContainer width="100%" height="100%">
                         {/* Aumento do margin-top para 25 para os Labels caberem */}
                         <BarChart data={dadosGraficoMensal} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
                           <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                           <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                           <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                           <Bar dataKey="Ocorrencias" radius={[6, 6, 0, 0]}>
                             {/* NOVO: Rótulos de Dados no Gráfico de Barras */}
                             <LabelList dataKey="Ocorrencias" position="top" fill="#cbd5e1" fontSize={11} fontWeight="bold" />
                             {dadosGraficoMensal.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={index === dadosGraficoMensal.length - 1 ? '#10b981' : '#0f4c81'} />
                             ))}
                           </Bar>
                         </BarChart>
                       </ResponsiveContainer>
                     </div>
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
            </div>
          )}

          {/* ABA 2 E ABA 3 OCULTADAS NESTE BLOCO (MANTIDAS IGUAIS) */}
          {/* ... */}
          {/* =========================================
              ABA 2: KANBAN DE ACOMPANHAMENTO
             ========================================= */}
          {activeTab === 'kanban' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
              {/* Coluna 1: Aguardando Solicitação */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  <h3 className="font-bold text-red-400 uppercase text-xs tracking-widest">Aguardando Solicitação</h3>
                  <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-black">{kAguardandoSolicitacao.length}</span>
                </div>
                {kAguardandoSolicitacao.map(item => (
                  <div 
                    key={item.id} 
                     onClick={() => abrirModalEdicao(item)}
                    className="group bg-white/[0.04] p-4 rounded-2xl border border-white/5 hover:border-red-500/50 hover:bg-white/[0.08] transition-all cursor-pointer relative"
                  >
                    <Edit size={16} className="absolute top-4 right-4 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-red-400 transition-all" />
                     <p className="font-black text-lg text-white mb-1">{item.equipamento}</p>
                    <p className="text-xs text-slate-400 mb-2">Ocorrência: <span className="text-slate-200">{item.data_ocorrencia}</span></p>
                    <span className="inline-block px-2 py-1 bg-red-500/20 text-red-300 text-[10px] rounded uppercase font-bold">{item.tipo}</span>
                  </div>
                 ))}
              </div>

              {/* Coluna 2: Aguardando RO */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                   <h3 className="font-bold text-amber-400 uppercase text-xs tracking-widest">Aguardando RO</h3>
                  <span className="bg-amber-500/20 text-amber-400 px-2 py-1 rounded text-xs font-black">{kAguardandoRo.length}</span>
                </div>
                {kAguardandoRo.map(item => (
                  <div 
                     key={item.id} 
                    onClick={() => abrirModalEdicao(item)}
                    className="group bg-white/[0.04] p-4 rounded-2xl border border-white/5 hover:border-amber-500/50 hover:bg-white/[0.08] transition-all cursor-pointer relative"
                  >
                     <Edit size={16} className="absolute top-4 right-4 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-amber-400 transition-all" />
                    <p className="font-black text-lg text-white mb-1">{item.equipamento}</p>
                    <p className="text-xs text-slate-400">Solicitado: <span className="text-slate-200">{item.data_solicitacao}</span></p>
                    <p className="text-xs text-slate-400 mb-2">Chamado: <span className="text-amber-300 font-bold">{item.numero_chamado}</span></p>
                     <span className="inline-block px-2 py-1 bg-amber-500/20 text-amber-300 text-[10px] rounded uppercase font-bold">{item.tipo}</span>
                  </div>
                ))}
              </div>

              {/* Coluna 3: Concluído */}
              <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between bg-[#10b981]/10 p-3 rounded-xl border border-[#10b981]/20">
                  <h3 className="font-bold text-[#10b981] uppercase text-xs tracking-widest">RO Finalizada (OK)</h3>
                  <span className="bg-[#10b981]/20 text-[#10b981] px-2 py-1 rounded text-xs font-black">{kConcluido.length}</span>
                </div>
                 {kConcluido.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => abrirModalEdicao(item)}
                    className="group bg-white/[0.04] p-4 rounded-2xl border border-white/5 hover:border-[#10b981]/50 hover:bg-white/[0.08] transition-all cursor-pointer opacity-80 hover:opacity-100 relative"
                  >
                    <Edit size={16} className="absolute top-4 right-4 text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-[#10b981] transition-all" />
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
                          <button 
                            onClick={() => abrirModalEdicao(item)}
                             className="text-slate-400 hover:text-[#10b981] bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors"
                            title="Editar Registro"
                          >
                            <Edit size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                     {rosFiltradas.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-500 font-bold">Nenhum registro encontrado para os filtros atuais.</td>
                      </tr>
                     )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        )}

      {/* =========================================
          MODAL DE NOVA/EDITAR RO
         ========================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in">
          <div className="bg-[#0f172a] border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
             {/* Header Modal */}
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/[0.02]">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  {editingId ? <Edit className="text-amber-500" /> : <Plus className="text-[#10b981]" />}
                  {editingId ? 'Editar Ocorrência' : 'Nova Ocorrência'}
                </h2>
                <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">
                  {editingId ? `Atualizando registro do equipamento ${formData.equipamento}` : 'Preencha os dados da frota/equipamento'}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl">
                <X size={20} />
              </button>
             </div>

            {/* Body Modal (Formulário) */}
            <form onSubmit={handleSubmitRO} className="p-6 overflow-y-auto flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Equipamento / Placa *</label>
                  <input required name="equipamento" value={formData.equipamento} onChange={handleInputChange} type="text" placeholder="Ex: CAV-102" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all uppercase" />
                </div>
                
                 <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">Data da Ocorrência *</label>
                  <input required name="data_ocorrencia" value={formData.data_ocorrencia} onChange={handleInputChange} type="date" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all [color-scheme:dark]" />
                </div>
               </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">Tipo de Ocorrência *</label>
                  <input required name="tipo" value={formData.tipo} onChange={handleInputChange} type="text" placeholder="Ex: Mecânica, Elétrica, Colisão" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase ml-1">Custo da Avaria (R$)</label>
                  <input name="custo_avaria" value={formData.custo_avaria} onChange={handleInputChange} type="number" step="0.01" placeholder="0.00" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1">Descrição da Avaria</label>
                <textarea name="avaria" value={formData.avaria} onChange={handleInputChange} rows="3" placeholder="Descreva o problema encontrado no equipamento..." className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 transition-all resize-none"></textarea>
              </div>

              <div className="border-t border-white/10 my-2 pt-4">
                <h3 className="text-xs font-black text-[#0f4c81] uppercase tracking-widest mb-4">Acompanhamento e Status do Kanban</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Data Solicitação</label>
                    <input name="data_solicitacao" value={formData.data_solicitacao} onChange={handleInputChange} type="date" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all [color-scheme:dark]" />
                   </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nº Chamado</label>
                    <input name="numero_chamado" value={formData.numero_chamado} onChange={handleInputChange} type="text" placeholder="Ex: CH-9921" className="bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Nº da RO</label>
                    <input name="numero_ro" value={formData.numero_ro} onChange={handleInputChange} type="text" placeholder="Para finalizar" className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl p-3 text-white focus:outline-none focus:border-[#10b981] transition-all" />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className={`flex items-center gap-2 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg disabled:opacity-50 ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#10b981] hover:bg-[#0e9f6e]'}`}>
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          ÁREA OCULTA: TABELA PARA EXPORTAÇÃO PDF
          (Renderizada fora da tela para não quebrar o layout)
         ========================================= */}
      <div className="absolute top-[-9999px] left-[-9999px]">
        <div id="table-export-area" className="bg-[#030712] text-white p-8 w-[1000px]">
          <div className="border-b border-white/20 pb-4 mb-6">
            <h2 className="text-2xl font-black text-[#10b981] flex items-center gap-2">
              <Table size={24} /> Resumo Analítico
            </h2>
            <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">
              Detalhamento das Ocorrências Apresentadas no Dashboard
            </p>
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#10b981]/30 text-slate-400 text-xs uppercase tracking-widest">
                <th className="p-3 font-bold">Equipamento</th>
                <th className="p-3 font-bold">Data</th>
                <th className="p-3 font-bold">Tipo</th>
                <th className="p-3 font-bold">Custo (R$)</th>
                <th className="p-3 font-bold">Nº RO / Status</th>
                <th className="p-3 font-bold w-1/3">Avaria Relatada</th>
              </tr>
            </thead>
            <tbody>
              {rosFiltradas.length > 0 ? rosFiltradas.map((item, idx) => (
                <tr key={idx} className="border-b border-white/5 text-sm">
                  <td className="p-3 font-black text-white">{item.equipamento}</td>
                  <td className="p-3 text-slate-300">{item.data_ocorrencia || '-'}</td>
                  <td className="p-3 text-slate-300">{item.tipo || '-'}</td>
                  <td className="p-3 text-red-400 font-bold">{item.custo_avaria ? item.custo_avaria.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</td>
                  <td className="p-3 font-bold">{item.numero_ro ? <span className="text-[#10b981]">{item.numero_ro}</span> : <span className="text-amber-500">Pendente</span>}</td>
                  <td className="p-3 text-slate-400 italic text-xs break-words">{item.avaria || 'Nenhuma descrição fornecida.'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-500 font-bold">Nenhum dado para exibir neste filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { 
           from { opacity: 0; transform: translateY(10px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-fade-in { 
          animation: fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default ControleRos;
