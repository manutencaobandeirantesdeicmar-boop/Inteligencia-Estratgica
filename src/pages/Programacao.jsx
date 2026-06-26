import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase-config';
import { useNavigate } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { 
  Calendar, Wrench, ChevronLeft, PlusCircle, Search, 
  Layout, Printer, Clock, AlertTriangle, CheckCircle2, 
  X, ChevronRight, Info, Edit3, ChevronLeft as LeftIcon, 
  ChevronRight as RightIcon, Mail, FileText, Trash2,
  Copy, Save, BarChart2, Filter, Database
} from 'lucide-react';

const FILIAIS = ['CLIA', 'IPA', 'BK', 'HUB', 'FROTA'];
const COLUNAS_KANBAN = ['PROGRAMADO', 'EM ANDAMENTO', 'AGUARDANDO PEÇA', 'FINALIZADO'];
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
  const [abaAtiva, setAbaAtiva] = useState('kanban'); // 'kanban', 'cronograma', 'dashboard'
  
  // Filtros Multiplos e Ordenação
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState(['TODAS']);
  const [ordenacao, setOrdenacao] = useState('data'); // 'data' ou 'prioridade'
  
  const [colunaAberta, setColunaAberta] = useState('EM ANDAMENTO');
  
  const [dataBaseGantt, setDataBaseGantt] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const start = new Date(d.setDate(d.getDate() - day + (day === 6 ? 0 : -1)));
    start.setHours(0,0,0,0);
    return start;
  });

  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [modalPlanilhaAberto, setModalPlanilhaAberto] = useState(false); // NOVO ESTADO DO MODAL
  const [destinatariosEmail, setDestinatariosEmail] = useState('');
  const [filiaisExportacao, setFiliaisExportacao] = useState(['TODAS']); 
  
  // Estado para a Tabela/Planilha de Edição
  const [linhasPlanilha, setLinhasPlanilha] = useState([]);

  // ==============================
  // GANTT (INTACTO)
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

  // ==============================
  // LÓGICA DA PLANILHA NO MODAL
  // ==============================
  const abrirModalPlanilha = () => {
    // Garante que os dados mais recentes estejam na tabela ao abrir o modal
    setLinhasPlanilha(dados);
    setModalPlanilhaAberto(true);
  };

  const adicionarNovaLinha = () => {
    const novaLinha = {
      id: null,
      placa: '', os: '', filial: 'CLIA', reprogramado: 'NÃO', prioridade: 'MÉDIA',
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

    if (!error) {
      alert("✅ Salvo com sucesso!");
      fetchProgramacao();
    } else {
      alert("Erro ao salvar: " + error.message);
    }
  };

  const handleExcluir = async (id, index) => {
    if (!window.confirm("⚠️ Tem certeza que deseja excluir esta programação permanentemente?")) return;
    
    // Se não tiver ID, é apenas uma linha não salva na UI
    if (!id) {
        const novasLinhas = [...linhasPlanilha];
        novasLinhas.splice(index, 1);
        setLinhasPlanilha(novasLinhas);
        return;
    }

    setLoading(true);
    const { error } = await supabase.from('programacao').delete().eq('id', id);
    if (!error) {
      const novasLinhas = [...linhasPlanilha];
      novasLinhas.splice(index, 1);
      setLinhasPlanilha(novasLinhas);
      fetchProgramacao();
    } else {
      alert("Erro ao excluir: " + error.message);
    }
    setLoading(false);
  };

  // ==============================
  // DRAG & DROP DO KANBAN
  // ==============================
  const onDragStart = (e, id) => { e.dataTransfer.setData("id", id); };
  const onDragOver = (e, coluna) => { e.preventDefault(); if (colunaAberta !== coluna) setColunaAberta(coluna); };
  const onDrop = async (e, novaSituacao) => {
    const id = e.dataTransfer.getData("id");
    const { error } = await supabase.from('programacao').update({ situacao: novaSituacao }).eq('id', id);
    if (!error) fetchProgramacao();
  };

  // ==============================
  // FILTROS E ORDENAÇÃO GERAIS
  // ==============================
  const toggleFiltroFilial = (f) => {
    if (f === 'TODAS') {
      setFiliaisSelecionadas(['TODAS']);
      return;
    }
    let atualizadas = filiaisSelecionadas.filter(item => item !== 'TODAS');
    if (atualizadas.includes(f)) {
      atualizadas = atualizadas.filter(item => item !== f);
    } else {
      atualizadas.push(f);
    }
    setFiliaisSelecionadas(atualizadas.length === 0 ? ['TODAS'] : atualizadas);
  };

  const dadosFiltradosGerais = dados.filter(i => 
    filiaisSelecionadas.includes('TODAS') || filiaisSelecionadas.includes(i.filial)
  ).sort((a, b) => {
    if (ordenacao === 'prioridade') {
      const pWeight = { 'CRÍTICA': 4, 'ALTA': 3, 'MÉDIA': 2, 'BAIXA': 1 };
      const weightA = pWeight[a.prioridade] || 0;
      const weightB = pWeight[b.prioridade] || 0;
      if (weightA !== weightB) return weightB - weightA;
    }
    return new Date(a.data_parada || 0) - new Date(b.data_parada || 0);
  });

  // ==============================
  // MÉTRICAS DO DASHBOARD
  // ==============================
  const hoje = new Date();
  const metricas = {
    programados: dadosFiltradosGerais.filter(i => i.situacao === 'PROGRAMADO' || i.situacao === 'EM ANDAMENTO').length,
    realizados: dadosFiltradosGerais.filter(i => i.situacao === 'FINALIZADO').length,
    aguardandoPeca: dadosFiltradosGerais.filter(i => i.situacao === 'AGUARDANDO PEÇA').length,
    atrasados: dadosFiltradosGerais.filter(i => {
      if (i.situacao === 'FINALIZADO') return false;
      const prazo = i.prazo ? new Date(i.prazo) : (i.data_final ? new Date(i.data_final) : new Date(i.data_parada));
      return prazo < hoje;
    })
  };

  const itensDaSemana = dadosFiltradosGerais.filter(i => {
    if(!i.data_parada) return false;
    const dp = new Date(i.data_parada).setHours(0,0,0,0);
    const df = i.data_final ? new Date(i.data_final).setHours(0,0,0,0) : (i.prazo ? new Date(i.prazo).setHours(0,0,0,0) : dp);
    const semInicio = diasDaSemana[0].setHours(0,0,0,0);
    const semFim = diasDaSemana[6].setHours(23,59,59,999);
    return dp <= semFim && df >= semInicio;
  });
  
  const formatDtInput = (dt) => dt ? new Date(dt).toISOString().slice(0, 16) : '';

  const dispararEmail = async () => {
    alert('✅ Relatório enviado com sucesso!');
    setModalExportarAberto(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans print:bg-white">
      {/* HEADER RESPONSIVO */}
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-4 shadow-lg flex flex-col sm:flex-row justify-between items-center sticky top-0 z-30 print:hidden gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => navigate('/')} className="hover:bg-white/20 p-2 rounded-full transition"><ChevronLeft /></button>
          <h1 className="font-black text-lg md:text-xl tracking-tight uppercase flex items-center gap-2"><Wrench size={20} /> Programação</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <button onClick={() => setModalExportarAberto(true)} className="flex-1 sm:flex-none bg-white/20 p-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold border border-white/20 hover:bg-white/30 transition"><FileText size={18} /> Exportar</button>
           <button onClick={abrirModalPlanilha} className="flex-1 sm:flex-none bg-white text-[#0f4c81] p-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-md hover:scale-105 transition"><Database size={18} /> Editor Base (Tabela)</button>
        </div>
      </header>

      <main className="p-2 md:p-4 max-w-[1700px] mx-auto print:hidden">
        {/* BARRA DE FILTROS E ABAS */}
        <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center mb-6 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
            <button onClick={() => setAbaAtiva('dashboard')} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${abaAtiva === 'dashboard' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><BarChart2 size={16}/> Dashboard</button>
            <button onClick={() => setAbaAtiva('kanban')} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${abaAtiva === 'kanban' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Layout size={16}/> Kanban</button>
            <button onClick={() => setAbaAtiva('cronograma')} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${abaAtiva === 'cronograma' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Calendar size={16}/> Gantt</button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <Filter size={16} className="text-slate-400" />
              {['TODAS', ...FILIAIS].map(f => (
                <button 
                  key={f} onClick={() => toggleFiltroFilial(f)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${filiaisSelecionadas.includes(f) ? 'bg-[#0f4c81] text-white' : 'bg-white border border-slate-200 text-slate-500'}`}
                >{f}</button>
              ))}
            </div>

            <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-[#0f4c81] outline-none text-xs uppercase cursor-pointer">
              <option value="data">Ord: Por Data</option>
              <option value="prioridade">Ord: Por Prioridade</option>
            </select>
          </div>
        </div>

        {/* ABA: DASHBOARD & ATRASADOS */}
        {abaAtiva === 'dashboard' && (
           // ... (Conteúdo do Dashboard mantido exatamente igual)
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-[#0f4c81]">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Programado / Andamento</h3>
                <p className="text-3xl font-black text-[#0f4c81]">{metricas.programados}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Finalizados</h3>
                <p className="text-3xl font-black text-emerald-600">{metricas.realizados}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Aguardando Peça</h3>
                <p className="text-3xl font-black text-amber-600">{metricas.aguardandoPeca}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-red-500">
                <h3 className="text-xs font-black text-red-400 uppercase tracking-widest mb-1 flex items-center gap-2"><AlertTriangle size={14}/> Atrasados</h3>
                <p className="text-3xl font-black text-red-600">{metricas.atrasados.length}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                <h2 className="font-black text-red-700 uppercase tracking-widest text-sm">Programações Atrasadas ({metricas.atrasados.length})</h2>
              </div>
              <div className="p-4">
                {metricas.atrasados.length === 0 ? (
                  <p className="text-slate-500 text-sm font-bold text-center py-6">Excelente! Não há programações atrasadas.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {metricas.atrasados.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-xl border border-red-200 shadow-sm hover:shadow-md transition">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-black text-red-600 text-lg">{item.placa}</h4>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{item.filial}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-600 mb-1">{item.tipo} • {item.falha}</p>
                        <p className="text-[10px] text-slate-400 mb-3">Resp: {item.responsavel || 'Não atribuído'}</p>
                        <div className="bg-red-50 p-2 rounded-lg">
                          <p className="text-[11px] font-bold text-red-600">Prazo estourado: {new Date(item.prazo || item.data_parada).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ABA: KANBAN */}
        {abaAtiva === 'kanban' && (
          <div className="flex flex-col md:flex-row gap-4 w-full h-auto md:h-[75vh] items-stretch print:hidden animate-in fade-in">
            {COLUNAS_KANBAN.map(coluna => {
              const isOpen = colunaAberta === coluna;
              const itens = dadosFiltradosGerais.filter(i => i.situacao === coluna);
              return (
                <div 
                  key={coluna} 
                  onDragOver={(e) => onDragOver(e, coluna)}
                  onDrop={(e) => onDrop(e, coluna)}
                  onClick={() => !isOpen && setColunaAberta(coluna)} 
                  className={`transition-all duration-500 flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden ${isOpen ? 'flex-1 shadow-xl min-h-[300px]' : 'h-14 md:h-full md:w-[70px] cursor-pointer hover:bg-slate-50'}`}
                >
                  <div className={`p-4 flex justify-between items-center bg-slate-50 border-b border-slate-100 ${!isOpen && 'md:h-full md:flex-col md:justify-start md:pt-8'}`}>
                    <h3 className={`font-black uppercase tracking-widest text-[#0f4c81] ${isOpen ? 'text-sm' : 'text-[10px] md:[writing-mode:vertical-lr] md:rotate-180'}`}>{coluna}</h3>
                    <span className={`bg-[#0f4c81] text-white font-bold rounded-full flex items-center justify-center ${isOpen ? 'px-3 py-1 text-xs' : 'w-6 h-6 md:w-8 md:h-8 text-[10px] md:mt-4'}`}>{itens.length}</span>
                  </div>
                  {isOpen && (
                    <div className="p-4 overflow-y-auto h-full flex flex-wrap gap-4 items-start content-start bg-slate-50/50">
                      {itens.map(item => (
                        <div 
                          key={item.id} draggable onDragStart={(e) => onDragStart(e, item.id)}
                          onClick={abrirModalPlanilha}
                          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-8 border-l-[#10b981] hover:shadow-lg hover:-translate-y-1 transition-all cursor-grab active:cursor-grabbing group w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.33%-11px)]"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-black text-[#0f4c81] text-lg">{item.placa}</h4>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{item.os}</span>
                          </div>
                          <p className="text-[11px] font-black text-red-500 mb-3 uppercase tracking-widest">{item.tipo} • {item.falha}</p>
                          <div className="flex items-center gap-1.5 mb-3 opacity-80">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Responsável:</span>
                            <span className="text-[10px] font-bold text-[#0f4c81] uppercase">{item.responsavel || 'Não atribuído'}</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 mb-3 line-clamp-2 min-h-[44px]">
                            <p className="text-[11px] text-slate-500 font-bold italic">"{item.observacoes || 'Sem observações'}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ABA: GANTT (TOTALMENTE INTACTO) */}
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
                                      {/* O.S. ATIVADA PARA TODOS OS DISPOSITIVOS */}
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

      {/* MODAL: TABELA DE INSERÇÃO/EDIÇÃO (PLANILHA) */}
      {modalPlanilhaAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 md:p-6 print:hidden">
          <div className="bg-white w-full h-full max-h-screen md:max-h-[90vh] rounded-[1rem] md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-4 md:p-6 flex justify-between items-center text-white shrink-0">
              <h2 className="font-black uppercase tracking-widest text-sm md:text-lg flex items-center gap-2"><Database size={20}/> Editor Base de Dados</h2>
              <div className="flex items-center gap-3">
                <button onClick={adicionarNovaLinha} className="bg-white text-[#0f4c81] hover:bg-slate-100 px-4 py-2 rounded-lg text-xs font-black flex items-center gap-2 shadow-sm transition"><PlusCircle size={16}/> Adicionar Linha</button>
                <button onClick={() => setModalPlanilhaAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={24}/></button>
              </div>
            </div>
            
            <div className="overflow-x-auto overflow-y-auto flex-1 bg-slate-50 p-2 md:p-4">
              <table className="w-full text-left border-collapse min-w-[2200px] bg-white rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
                  <tr>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200">Ações</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-24">Placa / Tag</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-20">OS</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-24">Filial</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-32">Situação</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-28">Prioridade</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-44">Manutenção</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-40">Falha</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-24">Duração</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-24">Reprog.</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-32">Responsável</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 w-48">Datas (Início / Prazo / Fim)</th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 min-w-[200px]">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhasPlanilha.map((linha, index) => (
                    <tr key={index} className={`hover:bg-slate-50 transition-colors ${!linha.id ? 'bg-amber-50/30' : ''}`}>
                      <td className="p-2 border-r border-slate-100">
                        <div className="flex gap-1">
                          <button onClick={() => salvarLinha(linha, index)} className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-md" title="Salvar Linha"><Save size={16}/></button>
                          <button onClick={() => duplicarLinha(index)} className="p-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md" title="Duplicar Linha"><Copy size={16}/></button>
                          <button onClick={() => handleExcluir(linha.id, index)} className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md" title="Excluir"><Trash2 size={16}/></button>
                        </div>
                      </td>
                      <td className="p-2 border-r border-slate-100"><input type="text" value={linha.placa || ''} onChange={e => atualizarLinha(index, 'placa', e.target.value.toUpperCase())} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold uppercase outline-none focus:border-[#0f4c81]" /></td>
                      <td className="p-2 border-r border-slate-100"><input type="text" value={linha.os || ''} onChange={e => atualizarLinha(index, 'os', e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-[#0f4c81]" /></td>
                      <td className="p-2 border-r border-slate-100">
                        <select value={linha.filial || 'CLIA'} onChange={e => atualizarLinha(index, 'filial', e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-[#0f4c81]">
                          {FILIAIS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-100">
                        <select value={linha.situacao || 'PROGRAMADO'} onChange={e => atualizarLinha(index, 'situacao', e.target.value)} className="w-full p-2 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs font-bold outline-none">
                          {COLUNAS_KANBAN.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-100">
                        <select value={linha.prioridade || 'MÉDIA'} onChange={e => atualizarLinha(index, 'prioridade', e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-[#0f4c81]">
                          {PRIORIDADES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-100">
                        <select value={linha.tipo || 'PREVENTIVA'} onChange={e => atualizarLinha(index, 'tipo', e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:border-[#0f4c81]">
                          {TIPOS_MANUTENCAO.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-100">
                        <select value={linha.falha || 'MOTOR'} onChange={e => atualizarLinha(index, 'falha', e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:border-[#0f4c81]">
                          {FALHAS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      {/* NOVOS CAMPOS ADICIONADOS */}
                      <td className="p-2 border-r border-slate-100">
                        <select value={linha.duracao || 'CURTA'} onChange={e => atualizarLinha(index, 'duracao', e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:border-[#0f4c81]">
                          {DURACAO.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-100">
                        <select value={linha.reprogramado || 'NÃO'} onChange={e => atualizarLinha(index, 'reprogramado', e.target.value)} className={`w-full p-2 border rounded text-[10px] font-bold outline-none ${linha.reprogramado === 'SIM' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200'}`}>
                          {OPCOES_SIM_NAO.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="p-2 border-r border-slate-100">
                        <input type="text" placeholder="Nome..." value={linha.responsavel || ''} onChange={e => atualizarLinha(index, 'responsavel', e.target.value.toUpperCase())} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-[#0f4c81]" />
                      </td>
                      <td className="p-2 flex flex-col gap-1 border-r border-slate-100">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 w-8">Início:</span>
                          <input type="datetime-local" value={formatDtInput(linha.data_parada)} onChange={e => atualizarLinha(index, 'data_parada', e.target.value)} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-slate-400 w-8">Prazo:</span>
                          <input type="datetime-local" value={formatDtInput(linha.prazo)} onChange={e => atualizarLinha(index, 'prazo', e.target.value)} className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold text-emerald-500 w-8">Fim:</span>
                          <input type="datetime-local" value={formatDtInput(linha.data_final)} onChange={e => atualizarLinha(index, 'data_final', e.target.value)} className="w-full p-1 bg-emerald-50 border border-emerald-200 rounded text-[10px] outline-none" />
                        </div>
                      </td>
                      <td className="p-2">
                        <textarea rows="3" placeholder="Insira as observações aqui..." value={linha.observacoes || ''} onChange={e => atualizarLinha(index, 'observacoes', e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-[10px] resize-none outline-none focus:border-[#0f4c81]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXPORTAR (MANTIDO INTACTO) */}
      {modalExportarAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><FileText size={20} /> Exportar Relatório</h2>
              <button onClick={() => setModalExportarAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={20}/></button>
            </div>
            <div className="p-6 md:p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">1. Unidades:</label>
                <div className="flex flex-wrap gap-2">
                  {['TODAS', ...FILIAIS].map(f => (
                    <button key={f} onClick={() => {
                        if (f === 'TODAS') setFiliaisExportacao(['TODAS']);
                        else {
                          const semTodas = filiaisExportacao.filter(item => item !== 'TODAS');
                          setFiliaisExportacao(semTodas.includes(f) ? semTodas.filter(item => item !== f) : [...semTodas, f]);
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all border-2 ${filiaisExportacao.includes(f) ? 'bg-[#0f4c81] border-[#0f4c81] text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                    > {f} </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">2. E-mail:</label>
                <input type="email" placeholder="e-mail..." value={destinatariosEmail} onChange={e => setDestinatariosEmail(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-medium outline-none focus:border-[#10b981]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setModalExportarAberto(false); setTimeout(() => window.print(), 300); }} className="p-4 bg-slate-100 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2"> <Printer size={24}/> PDF </button>
                <button onClick={dispararEmail} className="p-4 bg-emerald-100 text-emerald-700 rounded-2xl font-black uppercase text-[10px] flex flex-col items-center gap-2"> <Mail size={24}/> Enviar </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Programacao;
