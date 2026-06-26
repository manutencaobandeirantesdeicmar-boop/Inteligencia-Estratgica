import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase-config';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Wrench, ChevronLeft, PlusCircle, Search, 
  Layout, Printer, Clock, AlertTriangle, CheckCircle2, 
  X, Edit3, ChevronLeft as LeftIcon, ChevronRight as RightIcon, 
  Mail, FileText, Trash2, Copy, Save, BarChart2, Filter, Database,
  ArrowUpDown, TrendingUp, SlidersHorizontal
} from 'lucide-react';

const FILIAIS = ['CLIA', 'IPA', 'BK', 'HUB', 'FROTA'];
// Agora o Kanban possui a coluna de Atrasados integrada
const COLUNAS_KANBAN = ['ATRASADOS', 'PROGRAMADO', 'EM ANDAMENTO', 'AGUARDANDO PEÇA', 'FINALIZADO'];
const DIAS_SEMANA = ['SÁB', 'DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX'];
const DURACAO = ['CURTA', 'MÉDIA', 'EXTENSA'];
const TIPOS_MANUTENCAO = ['CORRETIVA', 'CORRETIVA PROGRAMADA', 'PREVENTIVA', 'INSPEÇÃO E LUBRIFICAÇÃO', 'VERIFICAR NÍVEIS', 'GERAL'];
const FALHAS = ['ALTERNADOR', 'ANTI BALANÇO', 'AR CONDICIONADO', 'ARLA', 'BANCO', 'BATERIA', 'BICO INJETOR', 'BOMBA', 'BUZINA', 'CARRETA', 'CILINDRO', 'COOLERS', 'CORRENTE', 'CÂMERA', 'DESLOCADOR', 'DIFERENCIAL', 'DIREÇÃO', 'EIXO DIRECIONAL', 'ELÉTRICA', 'EXTINTOR', 'FILTROS', 'FREIOS', 'HIDRÁULICO', 'ILUMINAÇÃO', 'INJETOR', 'JOYSTICK', 'LANÇA', 'LAVAGEM', 'LIMPADOR PARA-BRISA', 'MANGUEIRAS', 'MOTOR', 'PARA-LAMA', 'PARTIDA', 'PNEUMÁTICO / BORRACHARIA', 'PROJETOS', 'QUADRO', 'RADIADOR', 'REFORMA / SOLDA', 'RODA', 'SPREADER', 'SUSPENSÃO', 'TORRE', 'TRANSMISSÃO', 'TURBINA', 'VAZAMENTO', 'ÓLEO'];
const PRIORIDADES = ['BAIXA', 'MÉDIA', 'ALTA', 'CRÍTICA'];
const OPCOES_SIM_NAO = ['NÃO', 'SIM'];

const Programacao = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('dashboard'); 
  
  // Filtros Globais da Tela Principal
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState(['TODAS']);
  const [ordenacao, setOrdenacao] = useState('data'); 
  const [colunaAberta, setColunaAberta] = useState('EM ANDAMENTO');
  
  // Filtros Exclusivos do Editor Base de Dados
  const [buscaEditor, setBuscaEditor] = useState('');
  const [filialEditor, setFilialEditor] = useState('TODAS');
  const [ordenacaoEditor, setOrdenacaoEditor] = useState('recente');

  const [dataBaseGantt, setDataBaseGantt] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const start = new Date(d.setDate(d.getDate() - day + (day === 6 ? 0 : -1)));
    start.setHours(0,0,0,0);
    return start;
  });

  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [modalPlanilhaAberto, setModalPlanilhaAberto] = useState(false); 
  const [destinatariosEmail, setDestinatariosEmail] = useState('');
  const [filiaisExportacao, setFiliaisExportacao] = useState(['TODAS']); 
  const [linhasPlanilha, setLinhasPlanilha] = useState([]);

  // ==============================
  // GANTT (TOTALMENTE INTACTO)
  // ==============================
  const getDiasGantt = () => Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(dataBaseGantt);
    d.setDate(dataBaseGantt.getDate() + i);
    d.setHours(0,0,0,0);
    return d;
  });
  const diasDaSemana = getDiasGantt();

  const prevWeek = () => setDataBaseGantt(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
  const nextWeek = () => setDataBaseGantt(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
  const resetWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const start = new Date(d.setDate(d.getDate() - day + (day === 6 ? 0 : -1)));
    start.setHours(0,0,0,0);
    setDataBaseGantt(start);
  };

  // ==============================
  // FETCH DE DADOS
  // ==============================
  const fetchProgramacao = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('programacao').select('*').order('data_parada', { ascending: true });
    if (!error) {
      setDados(data);
      setLinhasPlanilha(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProgramacao(); }, []);

  // Lógica Auxiliar para identificar atrasos
  const checarSeAtrasado = (item) => {
    if (item.situacao === 'FINALIZADO') return false;
    const hoje = new Date();
    const prazo = item.prazo ? new Date(item.prazo) : (item.data_final ? new Date(item.data_final) : new Date(item.data_parada));
    return prazo < hoje;
  };

  // ==============================
  // LÓGICA DA PLANILHA NO MODAL (FILTROS INCLUÍDOS)
  // ==============================
  const abrirModalPlanilha = () => {
    setLinhasPlanilha(dados);
    setModalPlanilhaAberto(true);
  };

  const adicionarNovaLinha = () => {
    const novaLinha = {
      id: null, placa: '', os: '', filial: 'CLIA', reprogramado: 'NÃO', prioridade: 'MÉDIA',
      data_parada: '', duracao: 'CURTA', tipo: 'PREVENTIVA', responsavel: '',
      falha: 'MOTOR', prazo: '', data_final: '', observacoes: '', situacao: 'PROGRAMADO'
    };
    setLinhasPlanilha([novaLinha, ...linhasPlanilha]);
  };

  const duplicarLinha = (index) => {
    const linhaCopiada = { ...linhasPlanilha[index], id: null, os: '' }; 
    const novasLinhas = [...linhasPlanilha];
    novasLinhas.splice(index + 1, 0, linhaCopiada);
    setLinhasPlanilha(novasLinhas);
  };

  const atualizarLinha = (index, campo, valor) => {
    const novasLinhas = [...linhasPlanilha];
    novasLinhas[index][campo] = valor;
    setLinhasPlanilha(novasLinhas);
  };

  const salvarLinha = async (linha, index) => {
    const payload = { ...linha };
    if (payload.data_parada) payload.data_parada = new Date(payload.data_parada).toISOString();
    if (payload.prazo) payload.prazo = new Date(payload.prazo).toISOString();
    if (payload.data_final) payload.data_final = new Date(payload.data_final).toISOString();

    let error;
    if (payload.id) {
      const { error: err } = await supabase.from('programacao').update(payload).eq('id', payload.id);
      error = err;
    } else {
      delete payload.id;
      const { data, error: err } = await supabase.from('programacao').insert([payload]).select();
      error = err;
      if (!err && data) {
        const novasLinhas = [...linhasPlanilha];
        novasLinhas[index] = data[0];
        setLinhasPlanilha(novasLinhas);
      }
    }
    if (!error) { alert("✅ Registro salvo!"); fetchProgramacao(); } 
    else { alert("Erro ao salvar: " + error.message); }
  };

  const handleExcluir = async (id, index) => {
    if (!window.confirm("⚠️ Excluir permanentemente?")) return;
    if (!id) {
        const novasLinhas = [...linhasPlanilha];
        novasLinhas.splice(index, 1);
        setLinhasPlanilha(novasLinhas);
        return;
    }
    const { error } = await supabase.from('programacao').delete().eq('id', id);
    if (!error) {
      const novasLinhas = [...linhasPlanilha];
      novasLinhas.splice(index, 1);
      setLinhasPlanilha(novasLinhas);
      fetchProgramacao();
    }
  };

  // Filtragem dinâmica das linhas da tabela interna do Editor
  const linhasEditorFiltradas = linhasPlanilha.filter(item => {
    const batePlaca = (item.placa || '').toLowerCase().includes(buscaEditor.toLowerCase());
    const bateFilial = filialEditor === 'TODAS' || item.filial === filialEditor;
    return batePlaca && bateFilial;
  }).sort((a, b) => {
    if (ordenacaoEditor === 'placa') return (a.placa || '').localeCompare(b.placa || '');
    if (ordenacaoEditor === 'prioridade') {
      const peso = { 'CRÍTICA': 4, 'ALTA': 3, 'MÉDIA': 2, 'BAIXA': 1 };
      return (peso[b.prioridade] || 0) - (peso[a.prioridade] || 0);
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  // ==============================
  // DRAG & DROP DO KANBAN
  // ==============================
  const onDragStart = (e, id) => { e.dataTransfer.setData("id", id); };
  const onDragOver = (e, coluna) => { e.preventDefault(); if (colunaAberta !== coluna) setColunaAberta(coluna); };
  const onDrop = async (e, novaSituacao) => {
    const id = e.dataTransfer.getData("id");
    // Se arrastado para atrasados, mantém como programado mas o status visual de data comanda
    const situacaoFinal = novaSituacao === 'ATRASADOS' ? 'PROGRAMADO' : novaSituacao;
    const { error } = await supabase.from('programacao').update({ situacao: situacaoFinal }).eq('id', id);
    if (!error) fetchProgramacao();
  };

  // ==============================
  // FILTROS TELA PRINCIPAL
  // ==============================
  const toggleFiltroFilial = (f) => {
    if (f === 'TODAS') { setFiliaisSelecionadas(['TODAS']); return; }
    let atualizadas = filiaisSelecionadas.filter(item => item !== 'TODAS');
    if (atualizadas.includes(f)) { atualizadas = atualizadas.filter(item => item !== f); } 
    else { atualizadas.push(f); }
    setFiliaisSelecionadas(atualizadas.length === 0 ? ['TODAS'] : atualizadas);
  };

  const dadosFiltradosGerais = dados.filter(i => 
    filiaisSelecionadas.includes('TODAS') || filiaisSelecionadas.includes(i.filial)
  ).sort((a, b) => {
    if (ordenacao === 'prioridade') {
      const pWeight = { 'CRÍTICA': 4, 'ALTA': 3, 'MÉDIA': 2, 'BAIXA': 1 };
      return (pWeight[b.prioridade] || 0) - (pWeight[a.prioridade] || 0);
    }
    return new Date(a.data_parada || 0) - new Date(b.data_parada || 0);
  });

  // Métricas Dashboard Moderno
  const totalGeral = dadosFiltradosGerais.length;
  const cAtrasados = dadosFiltradosGerais.filter(checarSeAtrasado).length;
  const cAndamento = dadosFiltradosGerais.filter(i => i.situacao === 'EM ANDAMENTO' && !checarSeAtrasado(i)).length;
  const cAguardando = dadosFiltradosGerais.filter(i => i.situacao === 'AGUARDANDO PEÇA').length;
  const cFinalizados = dadosFiltradosGerais.filter(i => i.situacao === 'FINALIZADO').length;
  const cProgramados = dadosFiltradosGerais.filter(i => i.situacao === 'PROGRAMADO' && !checarSeAtrasado(i)).length;

  const itensDaSemana = dadosFiltradosGerais.filter(i => {
    if(!i.data_parada) return false;
    const dp = new Date(i.data_parada).setHours(0,0,0,0);
    const df = i.data_final ? new Date(i.data_final).setHours(0,0,0,0) : (i.prazo ? new Date(i.prazo).setHours(0,0,0,0) : dp);
    return dp <= diasDaSemana[6].setHours(23,59,59,999) && df >= diasDaSemana[0].setHours(0,0,0,0);
  });
  
  const formatDtInput = (dt) => dt ? new Date(dt).toISOString().slice(0, 16) : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white antialiased">
      
      {/* HEADER GLASSMORPHISM */}
      <header className="backdrop-blur-md bg-slate-900/70 border-b border-slate-800 p-4 sticky top-0 z-30 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => navigate('/')} className="hover:bg-slate-800 p-2 rounded-xl transition text-slate-400 hover:text-white"><ChevronLeft /></button>
          <h1 className="font-black text-xl tracking-wider bg-gradient-to-r from-blue-400 via-indigo-200 to-emerald-400 bg-clip-text text-transparent uppercase flex items-center gap-2">
            <Wrench size={22} className="text-blue-400" /> ControlCenter
          </h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <button onClick={() => setModalExportarAberto(true)} className="flex-1 sm:flex-none bg-slate-900 border border-slate-800 hover:border-slate-700 p-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition text-slate-300">
             <FileText size={16} /> Exportar
           </button>
           <button onClick={abrirModalPlanilha} className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 p-2.5 px-5 rounded-xl flex items-center justify-center gap-2 text-xs font-black shadow-lg shadow-indigo-950/50 transition">
             <Database size={16} /> Editor Base de Dados
           </button>
        </div>
      </header>

      <main className="p-4 max-w-[1750px] mx-auto space-y-6">
        
        {/* BARRA DE FILTROS GLOBAL */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center bg-slate-900/40 border border-slate-800/80 backdrop-blur-md p-3 rounded-2xl gap-4">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/60 overflow-x-auto">
            <button onClick={() => setAbaAtiva('dashboard')} className={`px-4 py-2 rounded-lg font-black text-xs flex items-center gap-2 transition-all shrink-0 ${abaAtiva === 'dashboard' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><BarChart2 size={14}/> Dashboard</button>
            <button onClick={() => setAbaAtiva('kanban')} className={`px-4 py-2 rounded-lg font-black text-xs flex items-center gap-2 transition-all shrink-0 ${abaAtiva === 'kanban' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><Layout size={14}/> Kanban</button>
            <button onClick={() => setAbaAtiva('cronograma')} className={`px-4 py-2 rounded-lg font-black text-xs flex items-center gap-2 transition-all shrink-0 ${abaAtiva === 'cronograma' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><Calendar size={14}/> Gantt Visual</button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800/60">
              <Filter size={14} className="text-slate-500 ml-1.5" />
              {['TODAS', ...FILIAIS].map(f => (
                <button key={f} onClick={() => toggleFiltroFilial(f)} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${filiaisSelecionadas.includes(f) ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>{f}</button>
              ))}
            </div>
            <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl font-bold text-xs text-slate-300 outline-none cursor-pointer hover:border-slate-700">
              <option value="data">Ord: Por Data</option>
              <option value="prioridade">Ord: Prioridade</option>
            </select>
          </div>
        </div>

        {/* ==============================
            ABA: DASHBOARD (PROFISSIONAL GLASS)
           ============================== */}
        {abaAtiva === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* CARDS GLASS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Atrasados', valor: cAtrasados, cor: 'from-red-500/20 to-transparent', border: 'border-red-500/30', txt: 'text-red-400' },
                { label: 'Programados', valor: cProgramados, cor: 'from-blue-500/20 to-transparent', border: 'border-blue-500/30', txt: 'text-blue-400' },
                { label: 'Em Andamento', valor: cAndamento, cor: 'from-amber-500/20 to-transparent', border: 'border-amber-500/30', txt: 'text-amber-400' },
                { label: 'Aguardando Peça', valor: cAguardando, cor: 'from-purple-500/20 to-transparent', border: 'border-purple-500/30', txt: 'text-purple-400' },
                { label: 'Finalizados', valor: cFinalizados, cor: 'from-emerald-500/20 to-transparent', border: 'border-emerald-500/30', txt: 'text-emerald-400' },
              ].map((card, i) => (
                <div key={i} className={`backdrop-blur-xl bg-slate-900/40 p-5 rounded-2xl border ${card.border} bg-gradient-to-br ${card.cor} flex flex-col justify-between shadow-lg relative overflow-hidden group`}>
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{card.label}</span>
                  <p className={`text-3xl font-black mt-4 ${card.txt}`}>{card.valor}</p>
                  <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500"></div>
                </div>
              ))}
            </div>

            {/* AREA DOS GRAFICOS NATIVOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico 1: Performance Geral */}
              <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-2"><TrendingUp size={14} className="text-emerald-400"/> Índice de Conclusão</h3>
                    <span className="text-xs font-bold text-emerald-400">{totalGeral ? Math.round((cFinalizados/totalGeral)*100) : 0}%</span>
                  </div>
                  {/* Barra de Progresso Customizada */}
                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000" style={{ width: `${totalGeral ? (cFinalizados/totalGeral)*100 : 0}%` }}></div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Eficiência total</span>
                    <span className="text-sm font-bold text-slate-300">{cFinalizados} concluídas</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Restantes</span>
                    <span className="text-sm font-bold text-slate-300">{totalGeral - cFinalizados} pendentes</span>
                  </div>
                </div>
              </div>

              {/* Gráfico 2: Distribuição de Carga Volumétrica */}
              <div className="backdrop-blur-md bg-slate-900/40 border border-slate-800 p-5 rounded-2xl lg:col-span-2">
                <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-4">Visão Comparativa de Carga de Trabalho</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Atrasados', qtd: cAtrasados, cor: 'bg-red-500' },
                    { label: 'Programado', qtd: cProgramados, cor: 'bg-blue-500' },
                    { label: 'Em Andamento', qtd: cAndamento, cor: 'bg-amber-500' },
                    { label: 'Aguardando Peça', qtd: cAguardando, cor: 'bg-purple-500' },
                    { label: 'Finalizado', qtd: cFinalizados, cor: 'bg-emerald-500' }
                  ].map((barra, idx) => {
                    const pct = totalGeral ? (barra.qtd / totalGeral) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center gap-4">
                        <span className="text-xs text-slate-400 font-bold w-28 text-left truncate">{barra.label}</span>
                        <div className="flex-1 h-5 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/40 relative flex items-center">
                          <div className={`h-full ${barra.cor} opacity-20 absolute left-0 top-0 transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
                          <div className={`h-full ${barra.cor} w-1 rounded-r absolute left-0 top-0`}></div>
                          <span className="text-[10px] font-black text-slate-300 ml-3 z-10">{barra.qtd} <span className="text-[9px] text-slate-500 font-normal">({Math.round(pct)}%)</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==============================
            ABA: KANBAN (COM ATRASADOS INTEGRADOS)
           ============================== */}
        {abaAtiva === 'kanban' && (
          <div className="flex flex-col md:flex-row gap-4 w-full h-auto md:h-[75vh] items-stretch animate-in fade-in duration-300">
            {COLUNAS_KANBAN.map(coluna => {
              const isOpen = colunaAberta === coluna;
              
              // Filtra os itens especificamente para cada coluna, tratando a de atrasados de forma inteligente
              const itens = dadosFiltradosGerais.filter(i => {
                if (coluna === 'ATRASADOS') return checarSeAtrasado(i);
                if (coluna === 'PROGRAMADO') return i.situacao === 'PROGRAMADO' && !checarSeAtrasado(i);
                return i.situacao === coluna;
              });

              return (
                <div 
                  key={coluna} onDragOver={(e) => onDragOver(e, coluna)} onDrop={(e) => onDrop(e, coluna)}
                  onClick={() => !isOpen && setColunaAberta(coluna)} 
                  className={`transition-all duration-500 flex flex-col bg-slate-900/30 rounded-2xl border ${isOpen ? 'border-slate-800/80 flex-1 shadow-2xl min-h-[300px]' : 'border-slate-900 h-14 md:h-full md:w-[65px] cursor-pointer hover:bg-slate-900/50'}`}
                >
                  <div className={`p-4 flex justify-between items-center bg-slate-900/60 backdrop-blur-md border-b border-slate-800/60 ${!isOpen && 'md:h-full md:flex-col md:justify-start md:pt-8'}`}>
                    <h3 className={`font-black uppercase tracking-widest ${coluna === 'ATRASADOS' ? 'text-red-400' : 'text-slate-300'} ${isOpen ? 'text-xs' : 'text-[10px] md:[writing-mode:vertical-lr] md:rotate-180'}`}>{coluna}</h3>
                    <span className={`font-black rounded-xl flex items-center justify-center ${coluna === 'ATRASADOS' ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300'} ${isOpen ? 'px-2.5 py-0.5 text-xs' : 'w-6 h-6 text-[10px] md:mt-4'}`}>{itens.length}</span>
                  </div>
                  
                  {isOpen && (
                    <div className="p-3 overflow-y-auto h-full flex flex-wrap gap-3 items-start content-start bg-slate-950/20">
                      {itens.length === 0 ? (
                        <p className="text-[11px] text-slate-600 font-bold italic p-4 mx-auto">Nenhuma programação nesta coluna.</p>
                      ) : (
                        itens.map(item => (
                          <div 
                            key={item.id} draggable onDragStart={(e) => onDragStart(e, item.id)} onClick={abrirModalPlanilha}
                            className={`p-4 rounded-xl border bg-slate-900/50 hover:bg-slate-900 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing w-full sm:w-[calc(50%-6px)] xl:w-[calc(33.33%-8px)] border-l-4 ${coluna === 'ATRASADOS' || checarSeAtrasado(item) ? 'border-l-red-500 border-slate-800' : 'border-l-indigo-500 border-slate-800'}`}
                          >
                            <div className="flex justify-between items-start mb-1.5">
                              <h4 className="font-black text-slate-200 text-base">{item.placa}</h4>
                              <span className="text-[9px] font-black bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase">{item.os || 'S/OS'}</span>
                            </div>
                            <p className="text-[10px] font-black text-indigo-400 mb-2 uppercase tracking-wide truncate">{item.tipo} • {item.falha}</p>
                            
                            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/60 text-[10px] text-slate-500">
                              <span className="truncate">Resp: <strong className="text-slate-400">{item.responsavel || '-'}</strong></span>
                              <span className="font-bold bg-slate-950 px-1.5 py-0.5 rounded text-slate-400 shrink-0">{item.filial}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ==============================
            ABA: GANTT (TOTALMENTE INTACTO)
           ============================== */}
        {abaAtiva === 'cronograma' && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-white overflow-visible flex flex-col print:shadow-none print:border-none print:rounded-none">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-t-[2rem] border-b border-slate-100 print:hidden">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <h2 className="font-black text-[#0f4c81] uppercase tracking-widest text-sm ml-0 sm:ml-4">Gantt Visual</h2>
                  <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
                      <button onClick={prevWeek} className="p-2 hover:bg-slate-100 rounded-md transition text-slate-500"><LeftIcon size={18}/></button>
                      <button onClick={resetWeek} className="px-2 md:px-4 font-bold text-[10px] md:text-xs uppercase text-[#0f4c81] hover:bg-slate-50 transition">Hoje</button>
                      <button onClick={nextWeek} className="p-2 hover:bg-slate-100 rounded-md transition text-slate-500"><RightIcon size={18}/></button>
                  </div>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[65vh] pb-32 print:pb-0 print:max-h-none print:overflow-visible">
              <table className="w-full text-sm border-collapse min-w-[800px]">
                <tbody className="divide-y divide-slate-100 relative">
                  {/* Cabeçalho da tabela do gantt */}
                  <tr className="bg-slate-100/95 backdrop-blur-md shadow-sm border-b border-slate-200 sticky top-0 z-[70] print:static">
                    {diasDaSemana.map((dia, idx) => (
                      <th key={idx} className="p-4 text-center border-r border-slate-200/60 w-[14.28%]">
                        <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">{DIAS_SEMANA[idx]}</span>
                        <span className={`text-base md:text-xl font-black ${dia.toDateString() === new Date().toDateString() ? 'text-[#10b981] bg-emerald-100/50 px-2 rounded-lg' : 'text-[#0f4c81]'}`}>{dia.getDate()}</span>
                      </th>
                    ))}
                  </tr>
                  {/* Linhas da tabela do gantt */}
                  {itensDaSemana.map((item) => {
                    const dataParada = new Date(item.data_parada); dataParada.setHours(0,0,0,0);
                    const dataFimReal = item.data_final ? new Date(item.data_final) : (item.prazo ? new Date(item.prazo) : dataParada);
                    dataFimReal.setHours(0,0,0,0);
                    let startIdx = diasDaSemana.findIndex(d => d.getTime() === dataParada.getTime());
                    if (startIdx === -1 && dataParada < diasDaSemana[0]) startIdx = 0;
                    let endIdx = diasDaSemana.findIndex(d => d.getTime() === dataFimReal.getTime());
                    if (endIdx === -1 && dataFimReal > diasDaSemana[6]) endIdx = 6;
                    const spanDays = (endIdx - startIdx) + 1;

                    return (
                      <tr key={item.id} className="h-20 relative hover:z-[100] transition-colors">
                        {diasDaSemana.map((_, colIdx) => (
                          <td key={colIdx} className="border-r border-slate-100/50 relative">
                            {startIdx === colIdx && (
                              <div 
                                className="absolute inset-y-2 left-2 z-10 hover:z-[100] group cursor-pointer"
                                style={{ width: `calc(${spanDays * 100}% + ${(spanDays - 1)}px - 16px)` }}
                                onClick={abrirModalPlanilha}
                              >
                                <div className="h-full w-full bg-gradient-to-r from-[#0f4c81] to-[#10b981] rounded-2xl shadow-md p-2 md:p-4 text-white flex items-center justify-between border-2 border-white/20 hover:brightness-110 hover:shadow-lg transition-all relative overflow-hidden">
                                  <div className="flex flex-col truncate pr-2 md:pr-6">
                                    <div className="flex items-center gap-1 md:gap-2">
                                      <span className="font-black text-[10px] md:text-sm uppercase tracking-tighter">{item.placa}</span>
                                      <span className="text-[8px] md:text-[9px] font-black bg-black/20 px-1 md:px-2 py-0.5 rounded uppercase tracking-tighter">OS: {item.os || '-'}</span>
                                    </div>
                                    <span className="text-[9px] md:text-[11px] font-bold opacity-90 truncate italic mt-1">{item.observacoes || item.tipo}</span>
                                  </div>
                                  <div className="absolute right-1 md:right-4 opacity-40 group-hover:opacity-100">
                                    <Edit3 size={14} className="md:w-[18px] md:h-[18px]" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ==============================
          MODAL: EDITOR BASE DE DADOS (OTIMIZADO)
         ============================== */}
      {modalPlanilhaAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-0 md:p-4">
          <div className="bg-slate-900 w-full h-full md:h-[95vh] rounded-none md:rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-98 duration-200">
            
            {/* TOPO DO MODAL */}
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shrink-0">
              <div className="flex items-center justify-between md:justify-start gap-4">
                <h2 className="font-black text-sm uppercase tracking-widest text-slate-200 flex items-center gap-2"><Database size={16} className="text-blue-400"/> Editor da Base</h2>
                <button onClick={adicionarNovaLinha} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-lg shadow-blue-950/50"><PlusCircle size={14}/> Nova Linha</button>
              </div>

              {/* FILTROS INTERNOS DO EDITOR */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                <div className="relative flex items-center bg-slate-950 rounded-lg border border-slate-800 px-2.5 py-1 w-full sm:w-48">
                  <Search size={12} className="text-slate-500 mr-1.5 shrink-0" />
                  <input type="text" placeholder="Filtrar Placa..." value={buscaEditor} onChange={e => setBuscaEditor(e.target.value)} className="bg-transparent text-xs text-white outline-none placeholder-slate-600 w-full font-bold" />
                </div>
                <select value={filialEditor} onChange={e => setFilialEditor(e.target.value)} className="bg-slate-950 text-slate-300 border border-slate-800 text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer">
                  <option value="TODAS">Filial: Todas</option>
                  {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={ordenacaoEditor} onChange={e => setOrdenacaoEditor(e.target.value)} className="bg-slate-950 text-slate-300 border border-slate-800 text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer">
                  <option value="recente">Ord: Recentes</option>
                  <option value="placa">Ord: Placa</option>
                  <option value="prioridade">Ord: Prioridade</option>
                </select>
                <button onClick={() => setModalPlanilhaAberto(false)} className="hover:bg-slate-800 p-1.5 rounded-lg text-slate-400 hover:text-white transition ml-auto md:ml-2"><X size={18}/></button>
              </div>
            </div>
            
            {/* GRID / TABELA ULTRA COMPACTA (DENSE UI) */}
            <div className="overflow-x-auto overflow-y-auto flex-1 bg-slate-950 p-2">
              <table className="w-full text-left border-collapse min-w-[1700px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                <thead className="bg-slate-950 sticky top-0 z-20 border-b border-slate-800 shadow-sm">
                  <tr className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                    <th className="p-2 w-24 text-center">Ações</th>
                    <th className="p-2 w-28">Placa / Tag</th>
                    <th className="p-2 w-24">OS</th>
                    <th className="p-2 w-24">Filial</th>
                    <th className="p-2 w-32">Situação</th>
                    <th className="p-2 w-28">Prioridade</th>
                    <th className="p-2 w-40">Manutenção</th>
                    <th className="p-2 w-40">Falha</th>
                    <th className="p-2 w-24">Duração</th>
                    <th className="p-2 w-24">Reprog.</th>
                    <th className="p-2 w-36">Responsável</th>
                    <th className="p-2 w-52">Datas e Prazos</th>
                    <th className="p-2 min-w-[200px]">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {linhasEditorFiltradas.map((linha, index) => (
                    <tr key={index} className={`hover:bg-slate-800/40 transition-colors ${!linha.id ? 'bg-blue-500/5' : ''}`}>
                      <td className="p-1 border-r border-slate-800/40 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => salvarLinha(linha, index)} className="p-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded border border-emerald-500/20" title="Salvar"><Save size={13}/></button>
                          <button onClick={() => duplicarLinha(index)} className="p-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded border border-blue-500/20" title="Duplicar"><Copy size={13}/></button>
                          <button onClick={() => handleExcluir(linha.id, index)} className="p-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded border border-red-500/20" title="Excluir"><Trash2 size={13}/></button>
                        </div>
                      </td>
                      <td className="p-1 border-r border-slate-800/40"><input type="text" value={linha.placa || ''} onChange={e => atualizarLinha(index, 'placa', e.target.value.toUpperCase())} className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs font-black uppercase text-slate-200 outline-none focus:border-blue-500" /></td>
                      <td className="p-1 border-r border-slate-800/40"><input type="text" value={linha.os || ''} onChange={e => atualizarLinha(index, 'os', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs font-bold text-slate-200 outline-none focus:border-blue-500" /></td>
                      <td className="p-1 border-r border-slate-800/40">
                        <select value={linha.filial || 'CLIA'} onChange={e => atualizarLinha(index, 'filial', e.target.value)} className="w-full p-1 bg-slate-950 border border-slate-800 rounded text-xs font-bold text-slate-300 outline-none">
                          {FILIAIS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-800/40">
                        <select value={linha.situacao || 'PROGRAMADO'} onChange={e => atualizarLinha(index, 'situacao', e.target.value)} className="w-full p-1 bg-slate-950 border border-slate-800 text-amber-400 rounded text-xs font-bold outline-none">
                          {COLUNAS_KANBAN.filter(c => c !== 'ATRASADOS').map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-800/40">
                        <select value={linha.prioridade || 'MÉDIA'} onChange={e => atualizarLinha(index, 'prioridade', e.target.value)} className="w-full p-1 bg-slate-950 border border-slate-800 text-slate-300 rounded text-xs font-bold outline-none">
                          {PRIORIDADES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-800/40">
                        <select value={linha.tipo || 'PREVENTIVA'} onChange={e => atualizarLinha(index, 'tipo', e.target.value)} className="w-full p-1 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px] font-bold outline-none">
                          {TIPOS_MANUTENCAO.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-800/40">
                        <select value={linha.falha || 'MOTOR'} onChange={e => atualizarLinha(index, 'falha', e.target.value)} className="w-full p-1 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px] font-bold outline-none">
                          {FALHAS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-800/40">
                        <select value={linha.duracao || 'CURTA'} onChange={e => atualizarLinha(index, 'duracao', e.target.value)} className="w-full p-1 bg-slate-950 border border-slate-800 text-slate-400 rounded text-[10px] font-bold outline-none">
                          {DURACAO.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-800/40">
                        <select value={linha.reprogramado || 'NÃO'} onChange={e => atualizarLinha(index, 'reprogramado', e.target.value)} className={`w-full p-1 border rounded text-[10px] font-bold outline-none bg-slate-950 ${linha.reprogramado === 'SIM' ? 'border-red-900 text-red-400' : 'border-slate-800 text-slate-400'}`}>
                          {OPCOES_SIM_NAO.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-1 border-r border-slate-800/40"><input type="text" placeholder="Nome..." value={linha.responsavel || ''} onChange={e => atualizarLinha(index, 'responsavel', e.target.value.toUpperCase())} className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs font-bold text-slate-300 outline-none" /></td>
                      
                      {/* Bloco Compactado de Datas */}
                      <td className="p-1 border-r border-slate-800/40 text-[9px] text-slate-400 space-y-0.5">
                        <div className="flex items-center gap-1"><span className="w-7 shrink-0 text-slate-500 font-bold">Início:</span><input type="datetime-local" value={formatDtInput(linha.data_parada)} onChange={e => atualizarLinha(index, 'data_parada', e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-0.5 text-slate-300 w-full outline-none" /></div>
                        <div className="flex items-center gap-1"><span className="w-7 shrink-0 text-slate-500 font-bold">Prazo:</span><input type="datetime-local" value={formatDtInput(linha.prazo)} onChange={e => atualizarLinha(index, 'prazo', e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-0.5 text-slate-300 w-full outline-none" /></div>
                        <div className="flex items-center gap-1"><span className="w-7 shrink-0 text-emerald-500 font-bold">Fim:</span><input type="datetime-local" value={formatDtInput(linha.data_final)} onChange={e => atualizarLinha(index, 'data_final', e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-0.5 text-emerald-400 w-full outline-none" /></div>
                      </td>
                      
                      <td className="p-1"><textarea rows="2" placeholder="..." value={linha.observacoes || ''} onChange={e => atualizarLinha(index, 'observacoes', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-slate-800 text-slate-300 rounded text-[10px] resize-none outline-none focus:border-blue-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXPORTAR */}
      {modalExportarAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-300">Exportar Relatórios</h2>
              <button onClick={() => setModalExportarAberto(false)} className="text-slate-500 hover:text-white p-1 rounded-lg transition"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setModalExportarAberto(false); setTimeout(() => window.print(), 300); }} className="p-4 bg-slate-950 hover:bg-slate-950/60 border border-slate-800 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-2 transition text-slate-300"> <Printer size={20} className="text-blue-400"/> Imprimir PDF </button>
                <button onClick={() => { alert('✅ Relatório enviado!'); setModalExportarAberto(false); }} className="p-4 bg-slate-950 hover:bg-slate-950/60 border border-slate-800 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-2 transition text-slate-300"> <Mail size={20} className="text-emerald-400"/> Via E-mail </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Programacao;
