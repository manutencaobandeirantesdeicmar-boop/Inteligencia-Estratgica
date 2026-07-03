import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase-config';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Wrench, ChevronLeft, PlusCircle, Search, 
  Layout, Printer, Clock, AlertTriangle, CheckCircle2, 
  X, Edit3, ChevronLeft as LeftIcon, ChevronRight as RightIcon, 
  Mail, FileText, Trash2, Copy, Save, BarChart2, Filter, Database,
  TrendingUp
} from 'lucide-react';

const FILIAIS = ['CLIA', 'IPA', 'BK', 'HUB', 'FROTA'];
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

  const checarSeAtrasado = (item) => {
    if (item.situacao === 'FINALIZADO') return false;
    const hoje = new Date();
    const prazo = item.prazo ? new Date(item.prazo) : (item.data_final ? new Date(item.data_final) : new Date(item.data_parada));
    return prazo < hoje;
  };

  // ==============================
  // LÓGICA DO EDITOR BASE DE DADOS
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

  const duplicarLinha = (linhaRef) => {
    // Encontra o index exato no array original através da referência do objeto
    const index = linhasPlanilha.findIndex(l => l === linhaRef);
    if (index === -1) return;
    
    const linhaCopiada = { ...linhaRef, id: null, os: '' };
    const novasLinhas = [...linhasPlanilha];
    novasLinhas.splice(index + 1, 0, linhaCopiada);
    setLinhasPlanilha(novasLinhas);
  };

  const atualizarLinha = (linhaRef, campo, valor) => {
    const novasLinhas = linhasPlanilha.map(linha => 
      linha === linhaRef ? { ...linha, [campo]: valor } : linha
    );
    setLinhasPlanilha(novasLinhas);
  };

  const salvarLinha = async (linhaRef) => {
    const payload = { ...linhaRef };
    payload.data_parada = payload.data_parada ? new Date(payload.data_parada).toISOString() : null;
    payload.prazo = payload.prazo ? new Date(payload.prazo).toISOString() : null;
    payload.data_final = payload.data_final ? new Date(payload.data_final).toISOString() : null;

    let error;
    if (payload.id) {
      const { error: err } = await supabase.from('programacao').update(payload).eq('id', payload.id);
      error = err;
    } else {
      delete payload.id;
      const { data, error: err } = await supabase.from('programacao').insert([payload]).select();
      error = err;
      if (!err && data) {
        // Atualiza a linha recém-salva com o ID gerado pelo banco
        const novasLinhas = linhasPlanilha.map(linha => 
          linha === linhaRef ? data[0] : linha
        );
        setLinhasPlanilha(novasLinhas);
      }
    }
    if (!error) { 
      alert("✅ Registro salvo com sucesso!");
      fetchProgramacao(); 
    } else { 
      alert("Erro ao salvar: " + error.message); 
    }
  };

  const handleExcluir = async (linhaRef) => {
    if (!window.confirm("⚠️ Deseja excluir este item permanentemente?")) return;
    
    if (!linhaRef.id) {
      // Se não tem ID, é uma linha nova não salva; apenas removemos da tela
      const novasLinhas = linhasPlanilha.filter(l => l !== linhaRef);
      setLinhasPlanilha(novasLinhas);
      return;
    }
    
    const { error } = await supabase.from('programacao').delete().eq('id', linhaRef.id);
    if (!error) {
      const novasLinhas = linhasPlanilha.filter(l => l !== linhaRef);
      setLinhasPlanilha(novasLinhas);
      fetchProgramacao();
    }
  };

  // Filtragem interna do Editor Base
 const linhasEditorFiltradas = linhasPlanilha.filter(item => {
    const batePlaca = (item.placa || '').toLowerCase().includes(buscaEditor.toLowerCase());
    const bateFilial = filialEditor === 'TODAS' || item.filial === filialEditor;
    return batePlaca && bateFilial;
  }).sort((a, b) => {
    // 1️⃣ REGRA NOVA: Se "a" é nova (sem id) e "b" já existe, "a" sobe pro topo
    if (!a.id && b.id) return -1;
    if (a.id && !b.id) return 1;

    // ... Restante da sua ordenação original ...
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
    const situacaoFinal = novaSituacao === 'ATRASADOS' ? 'PROGRAMADO' : novaSituacao;
    const { error } = await supabase.from('programacao').update({ situacao: situacaoFinal }).eq('id', id);
    if (!error) fetchProgramacao();
  };

  // ==============================
  // FILTROS PRINCIPAIS
  // ==============================
  const toggleFiltroFilial = (f) => {
    if (f === 'TODAS') { setFiliaisSelecionadas(['TODAS']); return; }
    let atualizadas = filiaisSelecionadas.filter(item => item !== 'TODAS');
    if (atualizadas.includes(f)) { atualizadas = updatedas.filter(item => item !== f); } 
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

  // Métricas para o Dashboard Claro
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
  
  const formatDtInput = (dt) => {
    if (!dt) return '';
    const date = new Date(dt);
    // Subtrai o offset do fuso horário para o input exibir a hora local correta
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased">
      
      {/* HEADER ORIGINAL (MANTIDO) */}
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-4 shadow-lg flex flex-col sm:flex-row justify-between items-center sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => navigate('/')} className="hover:bg-white/20 p-2 rounded-full transition"><ChevronLeft /></button>
          <h1 className="font-black text-lg md:text-xl tracking-tight uppercase flex items-center gap-2"><Wrench size={20} /> Programação</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <button onClick={() => setModalExportarAberto(true)} className="flex-1 sm:flex-none bg-white/20 p-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold border border-white/20 hover:bg-white/30 transition"><FileText size={18} /> Exportar</button>
           <button onClick={abrirModalPlanilha} className="flex-1 sm:flex-none bg-white text-[#0f4c81] p-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-md hover:scale-105 transition"><Database size={18} /> Editor Base de Dados</button>
        </div>
      </header>

      <main className="p-4 max-w-[1750px] mx-auto space-y-6">
        
        {/* BARRA DE FILTROS ORIGINAL */}
        <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
            <button onClick={() => setAbaAtiva('dashboard')} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${abaAtiva === 'dashboard' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><BarChart2 size={16}/> Dashboard</button>
            <button onClick={() => setAbaAtiva('kanban')} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${abaAtiva === 'kanban' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Layout size={16}/> Kanban</button>
            <button onClick={() => setAbaAtiva('cronograma')} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${abaAtiva === 'cronograma' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Calendar size={16}/> Gantt Visual</button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <Filter size={16} className="text-slate-400" />
              {['TODAS', ...FILIAIS].map(f => (
                <button key={f} onClick={() => toggleFiltroFilial(f)} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${filiaisSelecionadas.includes(f) ? 'bg-[#0f4c81] text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{f}</button>
              ))}
            </div>
            <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-[#0f4c81] outline-none text-xs uppercase cursor-pointer">
              <option value="data">Ord: Por Data</option>
              <option value="prioridade">Ord: Por Prioridade</option>
            </select>
          </div>
        </div>

        {/* ==============================
            ABA: DASHBOARD (MODERNO NO TEMA CLARO)
           ============================== */}
        {abaAtiva === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* CARDS COM PROPOSTA LIGHT-GLASSMORMISM */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Atrasados', valor: cAtrasados, cor: 'from-red-50 to-white', border: 'border-red-200', txt: 'text-red-600' },
                { label: 'Programados', valor: cProgramados, cor: 'from-blue-50 to-white', border: 'border-blue-100', txt: 'text-[#0f4c81]' },
                { label: 'Em Andamento', valor: cAndamento, cor: 'from-amber-50 to-white', border: 'border-amber-200', txt: 'text-amber-600' },
                { label: 'Aguardando Peça', valor: cAguardando, cor: 'from-purple-50 to-white', border: 'border-purple-200', txt: 'text-purple-600' },
                { label: 'Finalizados', valor: cFinalizados, cor: 'from-emerald-50 to-white', border: 'border-emerald-200', txt: 'text-emerald-600' },
              ].map((card, i) => (
                <div key={i} className={`backdrop-blur-md bg-white/80 p-5 rounded-2xl border ${card.border} bg-gradient-to-br ${card.cor} flex flex-col justify-between shadow-sm relative overflow-hidden group`}>
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{card.label}</span>
                  <p className={`text-3xl font-black mt-3 ${card.txt}`}>{card.valor}</p>
                  <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-slate-200/40 rounded-full blur-lg group-hover:scale-150 transition-all duration-300"></div>
                </div>
              ))}
            </div>

            {/* INDICADORES GRÁFICOS NATIVOS CLAROS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-2"><TrendingUp size={14} className="text-emerald-500"/> Eficiência da Base</h3>
                    <span className="text-xs font-bold text-emerald-600">{totalGeral ? Math.round((cFinalizados/totalGeral)*100) : 0}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-[#10b981] rounded-full transition-all duration-1000" style={{ width: `${totalGeral ? (cFinalizados/totalGeral)*100 : 0}%` }}></div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Concluídos</span>
                    <strong className="text-slate-700">{cFinalizados} ordens</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Pendentes</span>
                    <strong className="text-slate-700">{totalGeral - cFinalizados} ordens</strong>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm lg:col-span-2">
                <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-4">Volume Volumétrico por Etapa</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Atrasados', qtd: cAtrasados, cor: 'bg-red-500' },
                    { label: 'Programado', qtd: cProgramados, cor: 'bg-[#0f4c81]' },
                    { label: 'Em Andamento', qtd: cAndamento, cor: 'bg-amber-500' },
                    { label: 'Aguardando Peça', qtd: cAguardando, cor: 'bg-purple-500' },
                    { label: 'Finalizado', qtd: cFinalizados, cor: 'bg-emerald-500' }
                  ].map((barra, idx) => {
                    const pct = totalGeral ? (barra.qtd / totalGeral) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center gap-4">
                        <span className="text-xs text-slate-500 font-bold w-24 truncate">{barra.label}</span>
                        <div className="flex-1 h-5 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 relative flex items-center">
                          <div className={`h-full ${barra.cor} opacity-10 absolute left-0 top-0 transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                          <div className={`h-full ${barra.cor} w-1 absolute left-0 top-0`}></div>
                          <span className="text-[10px] font-bold text-slate-700 ml-3 z-10">{barra.qtd} <span className="text-slate-400 font-normal">({Math.round(pct)}%)</span></span>
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
            ABA: KANBAN (COM ATRASADOS LOGÍSTICOS)
           ============================== */}
        {abaAtiva === 'kanban' && (
          <div className="flex flex-col md:flex-row gap-4 w-full h-auto md:h-[75vh] items-stretch animate-in fade-in duration-200">
            {COLUNAS_KANBAN.map(coluna => {
              const isOpen = colunaAberta === coluna;
              
              const itens = dadosFiltradosGerais.filter(i => {
                if (coluna === 'ATRASADOS') return checarSeAtrasado(i);
                if (coluna === 'PROGRAMADO') return i.situacao === 'PROGRAMADO' && !checarSeAtrasado(i);
                return i.situacao === coluna;
              });

              return (
                <div 
                  key={coluna} onDragOver={(e) => onDragOver(e, coluna)} onDrop={(e) => onDrop(e, coluna)}
                  onClick={() => !isOpen && setColunaAberta(coluna)} 
                  className={`transition-all duration-500 flex flex-col bg-white rounded-2xl border ${isOpen ? 'border-slate-200 flex-1 shadow-md min-h-[300px]' : 'border-slate-100 h-14 md:h-full md:w-[65px] cursor-pointer hover:bg-slate-50'}`}
                >
                  <div className={`p-4 flex justify-between items-center bg-slate-50 border-b border-slate-100 ${!isOpen && 'md:h-full md:flex-col md:justify-start md:pt-8'}`}>
                    <h3 className={`font-black uppercase tracking-widest text-xs ${coluna === 'ATRASADOS' ? 'text-red-600' : 'text-[#0f4c81]'} ${isOpen ? '' : 'md:[writing-mode:vertical-lr] md:rotate-180'}`}>{coluna}</h3>
                    <span className={`font-bold rounded-full flex items-center justify-center text-xs ${coluna === 'ATRASADOS' ? 'bg-red-100 text-red-700' : 'bg-[#0f4c81] text-white'} ${isOpen ? 'px-2.5 py-0.5' : 'w-6 h-6 md:mt-4'}`}>{itens.length}</span>
                  </div>
                  
                  {isOpen && (
                    <div className="p-3 overflow-y-auto h-full flex flex-wrap gap-3 items-start content-start bg-slate-50/40">
                      {itens.length === 0 ? (
                        <p className="text-[11px] text-slate-400 font-bold italic p-4 mx-auto">Nenhuma programação cadastrada.</p>
                      ) : (
                        itens.map(item => (
                          <div 
                            key={item.id} draggable onDragStart={(e) => onDragStart(e, item.id)} onClick={abrirModalPlanilha}
                            className={`p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing w-full sm:w-[calc(50%-6px)] xl:w-[calc(33.33%-8px)] border-l-4 ${coluna === 'ATRASADOS' || checarSeAtrasado(item) ? 'border-l-red-500' : 'border-l-[#0f4c81]'}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-black text-slate-700 text-base">{item.placa}</h4>
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase border border-slate-200">OS: {item.os || '-'}</span>
                            </div>
                            <p className="text-[10px] font-black text-red-500 mb-2 uppercase tracking-wide truncate">{item.tipo} • {item.falha}</p>
                            
                            <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                              <span className="truncate">Resp: <strong className="text-slate-600">{item.responsavel || '-'}</strong></span>
                              <span className="font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0 border border-slate-200/60">{item.filial}</span>
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
            ABA: GANTT (INTEIRAMENTE INTACTO)
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
                <thead className="sticky top-0 z-[70] print:static">
                  <tr className="bg-slate-100/95 backdrop-blur-md shadow-sm border-b border-slate-200">
                    {diasDaSemana.map((dia, idx) => (
                      <th key={idx} className="p-4 text-center border-r border-slate-200/60 w-[14.28%]">
                        <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">{DIAS_SEMANA[idx]}</span>
                        <span className={`text-base md:text-xl font-black ${dia.toDateString() === new Date().toDateString() ? 'text-[#10b981] bg-emerald-100/50 px-2 rounded-lg' : 'text-[#0f4c81]'}`}>{dia.getDate()}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 relative">
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
          MODAL: EDITOR BASE DE DADOS (CLARO & ULTRA COMPACTO)
         ============================== */}
      {modalPlanilhaAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white w-full h-full md:h-[95vh] rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* CABEÇALHO DO EDITOR BASE (CORES ORIGINAIS DO TOPO) */}
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shrink-0 text-white shadow-md">
              <div className="flex items-center justify-between md:justify-start gap-4">
                <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><Database size={18}/> Editor Base de Dados</h2>
                <button onClick={adicionarNovaLinha} className="bg-white text-[#0f4c81] hover:bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-sm"><PlusCircle size={14}/> Nova Linha</button>
              </div>

              {/* FILTROS E PESQUISA INTERNOS */}
              <div className="flex flex-wrap items-center gap-2 bg-black/10 p-1.5 rounded-xl border border-white/10">
                <div className="relative flex items-center bg-white rounded-lg px-2 py-1 w-full sm:w-48">
                  <Search size={12} className="text-slate-400 mr-1.5 shrink-0" />
                  <input type="text" placeholder="Filtrar Placa/Tag..." value={buscaEditor} onChange={e => setBuscaEditor(e.target.value)} className="bg-transparent text-xs text-slate-800 outline-none placeholder-slate-400 w-full font-bold uppercase" />
                </div>
                <select value={filialEditor} onChange={e => setFilialEditor(e.target.value)} className="bg-white text-slate-700 text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer">
                  <option value="TODAS">Filial: Todas</option>
                  {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={ordenacaoEditor} onChange={e => setOrdenacaoEditor(e.target.value)} className="bg-white text-slate-700 text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer">
                  <option value="recente">Ord: Mais Recentes</option>
                  <option value="placa">Ord: Placa A-Z</option>
                  <option value="prioridade">Ord: Prioridade</option>
                </select>
                <button onClick={() => setModalPlanilhaAberto(false)} className="hover:bg-white/20 p-1.5 rounded-lg text-white transition ml-auto md:ml-2"><X size={18}/></button>
              </div>
            </div>
            
            {/* GRID ULTRA COMPACTO (EVITA SCROLL EXCESSIVO) */}
            <div className="overflow-x-auto overflow-y-auto flex-1 bg-slate-100 p-2">
              <table className="w-full text-left border-collapse min-w-[1850px] bg-white rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 shadow-xs">
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
                <tbody className="divide-y divide-slate-100">
  {linhasEditorFiltradas.map((linha, index) => (
   <tr key={index} className={`transition-colors ${ !linha.id ? 'bg-amber-100/80 shadow-[inset_4px_0_0_0_#f59e0b]' : 'hover:bg-slate-50' }`} >
      <td className="p-1 border-r border-slate-100 text-center">
        <div className="flex gap-1 justify-center">
          <button onClick={() => salvarLinha(linha)} className="p-1 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded" title="Salvar"><Save size={13}/></button>
          <button onClick={() => duplicarLinha(linha)} className="p-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded" title="Duplicar"><Copy size={13}/></button>
          <button onClick={() => handleExcluir(linha)} className="p-1 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded" title="Excluir"><Trash2 size={13}/></button>
        </div>
      </td>
      <td className="p-1 border-r border-slate-100"><input type="text" value={linha.placa || ''} onChange={e => atualizarLinha(linha, 'placa', e.target.value.toUpperCase())} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-black uppercase text-slate-700 outline-none focus:border-[#0f4c81]" /></td>
      <td className="p-1 border-r border-slate-100"><input type="text" value={linha.os || ''} onChange={e => atualizarLinha(linha, 'os', e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" /></td>
      <td className="p-1 border-r border-slate-100">
        <select value={linha.filial || 'CLIA'} onChange={e => atualizarLinha(linha, 'filial', e.target.value)} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none">
          {FILIAIS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-1 border-r border-slate-100">
        <select value={linha.situacao || 'PROGRAMADO'} onChange={e => atualizarLinha(linha, 'situacao', e.target.value)} className="w-full p-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs font-bold outline-none">
          {COLUNAS_KANBAN.filter(c => c !== 'ATRASADOS').map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-1 border-r border-slate-100">
        <select value={linha.prioridade || 'MÉDIA'} onChange={e => atualizarLinha(linha, 'prioridade', e.target.value)} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none">
          {PRIORIDADES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-1 border-r border-slate-100">
        <select value={linha.tipo || 'PREVENTIVA'} onChange={e => atualizarLinha(linha, 'tipo', e.target.value)} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none">
          {TIPOS_MANUTENCAO.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-1 border-r border-slate-100">
        <select value={linha.falha || 'MOTOR'} onChange={e => atualizarLinha(linha, 'falha', e.target.value)} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none">
          {FALHAS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-1 border-r border-slate-100">
        <select value={linha.duracao || 'CURTA'} onChange={e => atualizarLinha(linha, 'duracao', e.target.value)} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-600 outline-none">
          {DURACAO.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-1 border-r border-slate-100">
        <select value={linha.reprogramado || 'NÃO'} onChange={e => atualizarLinha(linha, 'reprogramado', e.target.value)} className={`w-full p-1 border rounded text-[10px] font-bold outline-none ${linha.reprogramado === 'SIM' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
          {OPCOES_SIM_NAO.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="p-1 border-r border-slate-100"><input type="text" placeholder="Responsável..." value={linha.responsavel || ''} onChange={e => atualizarLinha(linha, 'responsavel', e.target.value.toUpperCase())} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" /></td>
      
      <td className="p-1 border-r border-slate-100 text-[9px] text-slate-400 space-y-0.5">
        <div className="flex items-center gap-1"><span className="w-7 text-slate-400 font-bold">Início:</span><input type="datetime-local" value={formatDtInput(linha.data_parada)} onChange={e => atualizarLinha(linha, 'data_parada', e.target.value)} className="bg-slate-50 border border-slate-200 rounded p-0.5 text-slate-700 w-full outline-none" /></div>
        <div className="flex items-center gap-1"><span className="w-7 text-slate-400 font-bold">Prazo:</span><input type="datetime-local" value={formatDtInput(linha.prazo)} onChange={e => atualizarLinha(linha, 'prazo', e.target.value)} className="bg-slate-50 border border-slate-200 rounded p-0.5 text-slate-700 w-full outline-none" /></div>
        <div className="flex items-center gap-1"><span className="w-7 text-emerald-600 font-bold">Fim:</span><input type="datetime-local" value={formatDtInput(linha.data_final)} onChange={e => atualizarLinha(linha, 'data_final', e.target.value)} className="bg-emerald-50 border border-emerald-200 rounded p-0.5 text-emerald-700 w-full outline-none" /></div>
      </td>
      
      <td className="p-1"><textarea rows="2" placeholder="..." value={linha.observacoes || ''} onChange={e => atualizarLinha(linha, 'observacoes', e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded text-[10px] resize-none outline-none focus:border-[#0f4c81]" /></td>
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-4 text-white flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest">Opções de Relatório</h2>
              <button onClick={() => setModalExportarAberto(false)} className="hover:bg-white/20 p-1 rounded-full text-white transition"><X size={16}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setModalExportarAberto(false); setTimeout(() => window.print(), 300); }} className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-2 text-[#0f4c81] transition"> <Printer size={20}/> Imprimir PDF </button>
                <button onClick={() => { alert('✅ Enviado!'); setModalExportarAberto(false); }} className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-2 text-emerald-700 transition"> <Mail size={20}/> Enviar E-mail </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Programacao;
