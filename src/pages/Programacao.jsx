import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase-config';
import { useNavigate } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { 
  Calendar, Wrench, ChevronLeft, PlusCircle, Search, 
  Layout, Printer, Clock, AlertTriangle, CheckCircle2, 
  X, ChevronRight, Info, Edit3, ChevronLeft as LeftIcon, 
  ChevronRight as RightIcon, Mail, FileText 
} from 'lucide-react';

const FILIAIS = ['CLIA', 'IPA', 'BK', 'HUB', 'FROTA'];
const COLUNAS_KANBAN = ['PROGRAMADO', 'EM ANDAMENTO', 'AGUARDANDO PEÇA', 'FINALIZADO'];
const DIAS_SEMANA = ['SÁB', 'DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX'];
const DURACAO = ['CURTA', 'MÉDIA', 'EXTENSA'];
const TIPOS_MANUTENCAO = ['CORRETIVA', 'CORRETIVA PROGRAMADA', 'PREVENTIVA', 'INSPEÇÃO E LUBRIFICAÇÃO', 'VERIFICAR NÍVEIS', 'GERAL'];
const FALHAS = ['ALTERNADOR', 'ANTI BALANÇO', 'AR CONDICIONADO', 'ARLA', 'BANCO', 'BATERIA', 'BICO INJETOR', 'BOMBA', 'BUZINA', 'CARRETA', 'CILINDRO', 'COOLERS', 'CORRENTE', 'CÂMERA', 'DESLOCADOR', 'DIFERENCIAL', 'DIREÇÃO', 'EIXO DIRECIONAL', 'ELÉTRICA', 'EXTINTOR', 'FILTROS', 'FREIOS', 'HIDRÁULICO', 'ILUMINAÇÃO', 'INJETOR', 'JOYSTICK', 'LANÇA', 'LAVAGEM', 'LIMPADOR PARA-BRISA', 'MANGUEIRAS', 'MOTOR', 'PARA-LAMA', 'PARTIDA', 'PNEUMÁTICO / BORRACHARIA', 'PROJETOS', 'QUADRO', 'RADIADOR', 'REFORMA / SOLDA', 'RODA', 'SPREADER', 'SUSPENSÃO', 'TORRE', 'TRANSMISSÃO', 'TURBINA', 'VAZAMENTO', 'ÓLEO'];

const Programacao = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('kanban');
  const [filtroFilial, setFiltroFilial] = useState('TODAS');
  const [colunaAberta, setColunaAberta] = useState('EM ANDAMENTO');
  
  const [dataBaseGantt, setDataBaseGantt] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const start = new Date(d.setDate(d.getDate() - day + (day === 6 ? 0 : -1)));
    start.setHours(0,0,0,0);
    return start;
  });

  const [modalAberto, setModalAberto] = useState(false);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [destinatariosEmail, setDestinatariosEmail] = useState('');
  const [filiaisExportacao, setFiliaisExportacao] = useState(['TODAS']); 
  
  const [formData, setFormData] = useState({
    placa: '', os: '', filial: 'CLIA', reprogramado: 'NÃO',
    data_parada: '', duracao: 'CURTA', tipo: 'PREVENTIVA', responsavel: '',
    falha: 'MOTOR', prazo: '', data_final: '', observacoes: '', situacao: 'PROGRAMADO'
  });

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

  const fetchProgramacao = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('programacao').select('*').order('data_parada', { ascending: true });
    if (!error) setDados(data);
    setLoading(false);
  };

  useEffect(() => { fetchProgramacao(); }, []);

  const handleSalvar = async () => {
    const payload = { ...formData };
    if (payload.data_parada) payload.data_parada = new Date(payload.data_parada).toISOString();
    if (payload.prazo) payload.prazo = new Date(payload.prazo).toISOString();
    if (payload.data_final) payload.data_final = new Date(payload.data_final).toISOString();

    const { error } = itemEditando 
      ? await supabase.from('programacao').update(payload).eq('id', itemEditando.id)
      : await supabase.from('programacao').insert([payload]);

    if (!error) { setModalAberto(false); fetchProgramacao(); } 
    else { alert("Erro ao salvar: " + error.message); }
  };

  const abrirEdicao = (item) => {
    setItemEditando(item);
    const formatDt = (dt) => dt ? new Date(dt).toISOString().slice(0, 16) : '';
    setFormData({ ...item, 
      data_parada: formatDt(item.data_parada), 
      prazo: formatDt(item.prazo), 
      data_final: formatDt(item.data_final) 
    });
    setModalAberto(true);
  };

  const onDragStart = (e, id) => { e.dataTransfer.setData("id", id); };
  const onDragOver = (e, coluna) => { e.preventDefault(); if (colunaAberta !== coluna) setColunaAberta(coluna); };
  const onDrop = async (e, novaSituacao) => {
    const id = e.dataTransfer.getData("id");
    const { error } = await supabase.from('programacao').update({ situacao: novaSituacao }).eq('id', id);
    if (!error) fetchProgramacao();
  };

  const dispararEmail = async () => {
    if (!destinatariosEmail) { alert("⚠️ Por favor, digite o e-mail de destino."); return; }
    try {
      const dadosParaEnvio = dados.filter(i => {
        if(!i.data_parada) return false;
        const atendeFilial = filiaisExportacao.includes('TODAS') || filiaisExportacao.includes(i.filial);
        if (!atendeFilial) return false;
        const dp = new Date(i.data_parada).setHours(0,0,0,0);
        const df = i.data_final ? new Date(i.data_final).setHours(0,0,0,0) : (i.prazo ? new Date(i.prazo).setHours(0,0,0,0) : dp);
        const semInicio = diasDaSemana[0].setHours(0,0,0,0);
        const semFim = diasDaSemana[6].setHours(23,59,59,999);
        return dp <= semFim && df >= semInicio;
      });
      const placasDaSemana = [...new Set(dadosParaEnvio.map(i => i.placa))];
      let equipamentosInfo = [];
      if (placasDaSemana.length > 0) {
        const { data: equipData, error: equipError } = await supabase.from('equipamentos').select('id, descricao_modelo').in('id', placasDaSemana);
        if (!equipError && equipData) equipamentosInfo = equipData;
      }
      const itensOrdenados = dadosParaEnvio.map(item => {
        const equip = equipamentosInfo.find(e => e.id === item.placa);
        return { ...item, descricao_modelo: equip ? equip.descricao_modelo : 'FROTA/OUTRO' };
      }).sort((a, b) => {
        const aIsRS = a.descricao_modelo.toUpperCase().includes('REACH STACKER');
        const bIsRS = b.descricao_modelo.toUpperCase().includes('REACH STACKER');
        if (aIsRS && !bIsRS) return -1;
        if (!aIsRS && bIsRS) return 1;
        return 0;
      });

      let htmlCorpo = `<table width="100%" cellpadding="10" cellspacing="0" style="border: 1px solid #e2e8f0; font-family: sans-serif; font-size: 12px; border-collapse: collapse;">
        <tr style="background-color: #0f4c81; color: white; text-transform: uppercase; font-size: 11px;">
          <th align="left">Identificação</th><th align="left">Manutenção</th><th align="left">Situação</th><th align="left">Prazos</th>
        </tr>`;

      if (itensOrdenados.length === 0) {
        htmlCorpo += `<tr><td colspan="4" align="center" style="padding: 20px; color: #64748b;">Nenhuma O.S. para as unidades selecionadas nesta semana.</td></tr>`;
      } else {
        itensOrdenados.forEach(i => {
          const isRS = i.descricao_modelo.toUpperCase().includes('REACH STACKER');
          const corBg = isRS ? 'background-color: #f0f9ff;' : '';
          const corStatus = i.situacao === 'FINALIZADO' ? '#10b981' : (i.situacao === 'EM ANDAMENTO' ? '#f59e0b' : '#64748b');
          htmlCorpo += `
            <tr style="border-bottom: 1px solid #e2e8f0; ${corBg}">
              <td style="padding: 10px;">
                <strong style="color: #0f4c81; font-size: 14px;">${i.placa}</strong><br>
                <span style="font-size: 10px; color: #64748b;">${i.descricao_modelo} | OS: ${i.os || '-'}</span>
              </td>
              <td style="padding: 10px;">
                <strong style="color: #ef4444; font-size: 11px; text-transform: uppercase;">${i.tipo}</strong><br>
                <span style="color: #475569;">${i.falha}</span>
              </td>
              <td style="padding: 10px;">
                <span style="color: ${corStatus}; font-weight: bold;">${i.situacao}</span>
              </td>
              <td style="padding: 10px; font-size: 11px; color: #475569;">
                Início: ${i.data_parada ? new Date(i.data_parada).toLocaleDateString('pt-BR') : '-'}<br>
                Fim: ${i.data_final ? new Date(i.data_final).toLocaleDateString('pt-BR') : (i.prazo ? new Date(i.prazo).toLocaleDateString('pt-BR') : '-')}
              </td>
            </tr>`;
        });
      }
      htmlCorpo += `</table>`;
      const templateParams = { unidades: filiaisExportacao.join(', '), total_os: itensOrdenados.length, conteudo_html: htmlCorpo, to_email: destinatariosEmail };
      await emailjs.send('service_ql8lpnh', 'template_jucx4wg', templateParams, 'dxlv8dovCZmMHhwgD');
      alert('✅ Relatório enviado com sucesso!');
      setModalExportarAberto(false);
      setDestinatariosEmail('');
    } catch (err) { alert('❌ Erro: ' + (err.text || err.message)); }
  };

  const dadosFiltradosGerais = dados.filter(i => filtroFilial === 'TODAS' || i.filial === filtroFilial);
  const itensDaSemana = dadosFiltradosGerais.filter(i => {
    if(!i.data_parada) return false;
    const dp = new Date(i.data_parada).setHours(0,0,0,0);
    const df = i.data_final ? new Date(i.data_final).setHours(0,0,0,0) : (i.prazo ? new Date(i.prazo).setHours(0,0,0,0) : dp);
    const semInicio = diasDaSemana[0].setHours(0,0,0,0);
    const semFim = diasDaSemana[6].setHours(23,59,59,999);
    return dp <= semFim && df >= semInicio;
  });

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
           <button onClick={() => { setItemEditando(null); setFormData({ filial: 'CLIA', situacao: 'PROGRAMADO', duracao: 'CURTA', tipo: 'PREVENTIVA', falha: 'MOTOR', reprogramado: 'NÃO' }); setModalAberto(true); }} className="flex-1 sm:flex-none bg-white text-[#0f4c81] p-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-md hover:scale-105 transition"><PlusCircle size={18} /> Nova</button>
        </div>
      </header>

      <main className="p-2 md:p-4 max-w-[1700px] mx-auto print:hidden">
        {/* FILTROS RESPONSIVOS */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 print:hidden gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setAbaAtiva('kanban')} className={`flex-1 sm:flex-none px-4 md:px-6 py-2 rounded-lg font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all ${abaAtiva === 'kanban' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}><Layout size={16}/> Acompanhamento </button>
            <button onClick={() => setAbaAtiva('cronograma')} className={`flex-1 sm:flex-none px-4 md:px-6 py-2 rounded-lg font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all ${abaAtiva === 'cronograma' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}><Calendar size={16}/> Cronograma </button>
          </div>
          <select value={filtroFilial} onChange={e => setFiltroFilial(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl font-bold text-[#0f4c81] outline-none text-sm uppercase">
            <option value="TODAS">Todas as Unidades</option>
            {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {abaAtiva === 'kanban' && (
          <div className="flex flex-col md:flex-row gap-4 w-full h-auto md:h-[75vh] items-stretch print:hidden">
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
                          onClick={(e) => { e.stopPropagation(); abrirEdicao(item); }} 
                          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-8 border-l-[#10b981] hover:shadow-lg hover:-translate-y-1 transition-all cursor-grab active:cursor-grabbing group w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.33%-11px)]"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-black text-[#0f4c81] text-lg">{item.placa}</h4>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md">{item.os}</span>
                          </div>
                          <p className="text-[11px] font-black text-red-500 mb-3 uppercase tracking-widest">{item.tipo} • {item.falha}</p>
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
                                onClick={() => abrirEdicao(item)}
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

      {/* MODAL EXPORTAR RESPONSIVO */}
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

      {/* MODAL FORMULÁRIO RESPONSIVO */}
      {modalAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
          <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-auto">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2"><Wrench size={20} /> {itemEditando ? 'Editar O.S.' : 'Nova Ordem'}</h2>
              <button onClick={() => setModalAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={20}/></button>
            </div>
            <div className="p-4 md:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Placa / Tag</label>
                <input type="text" value={formData.placa} onChange={e => setFormData({...formData, placa: e.target.value.toUpperCase()})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black uppercase focus:border-[#10b981] outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nº da O.S.</label>
                <input type="text" value={formData.os} onChange={e => setFormData({...formData, os: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:border-[#10b981] outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Filial</label>
                <select value={formData.filial} onChange={e => setFormData({...formData, filial: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none">
                  {FILIAIS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Situação</label>
                <select value={formData.situacao} onChange={e => setFormData({...formData, situacao: e.target.value})} className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl font-black text-amber-700 outline-none">
                  {COLUNAS_KANBAN.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block text-red-500">Tipo Manutenção</label>
                <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none">
                  {TIPOS_MANUTENCAO.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block text-red-500">Sistema / Falha</label>
                <select value={formData.falha} onChange={e => setFormData({...formData, falha: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none">
                  {FALHAS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block"><Clock size={12}/> Data Parada</label>
                <input type="datetime-local" value={formData.data_parada} onChange={e => setFormData({...formData, data_parada: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block"><Clock size={12}/> Prazo</label>
                <input type="datetime-local" value={formData.prazo} onChange={e => setFormData({...formData, prazo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block text-emerald-600"><Clock size={12}/> Data Final</label>
                <input type="datetime-local" value={formData.data_final} onChange={e => setFormData({...formData, data_final: e.target.value})} className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-bold text-xs outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Duração</label>
                  <select value={formData.duracao} onChange={e => setFormData({...formData, duracao: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">
                    {DURACAO.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Reprog.</label>
                  <select value={formData.reprogramado} onChange={e => setFormData({...formData, reprogramado: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs">
                    <option value="NÃO">NÃO</option><option value="SIM">SIM</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Observações</label>
                <textarea value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} rows="2" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none resize-none" placeholder="Detalhes..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Responsável</label>
                <input type="text" value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" placeholder="Mecânico" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-end">
              <button onClick={() => setModalAberto(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl order-2 sm:order-1">Cancelar</button>
              <button onClick={handleSalvar} className="px-8 py-3 bg-[#0f4c81] text-white font-black uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 transition-transform order-1 sm:order-2">Salvar</button>
            </div>
          </div>
        </div>
      )}
      <div className="hidden print:block p-10 bg-white font-sans text-slate-900">
        <div className="border-b-4 border-[#0f4c81] pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-[#0f4c81] uppercase tracking-tighter">Relatório de Programação</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Status Diário • Bandeirantes Deicmar</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase">Unidade: {filiaisExportacao.join(' / ')}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 text-center">
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">O.S. Programadas</span>
            <strong className="text-3xl text-[#0f4c81]">{itensDaSemana.length}</strong>
          </div>
          <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 text-center">
            <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Concluídas</span>
            <strong className="text-3xl text-emerald-600">{itensDaSemana.filter(i => i.situacao === 'FINALIZADO').length}</strong>
          </div>
          <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100 text-center">
            <span className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Em Andamento</span>
            <strong className="text-3xl text-amber-600">{itensDaSemana.filter(i => i.situacao === 'EM ANDAMENTO').length}</strong>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#0f4c81] text-white">
              <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest rounded-tl-2xl">Equipamento</th>
              <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest">Detalhes da Manutenção</th>
              <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Situação</th>
              <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest rounded-tr-2xl">Prazos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {itensDaSemana.map((i, idx) => (
              <tr key={i.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                <td className="p-4 align-top">
                  <div className="font-black text-[#0f4c81] text-base">{i.placa}</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-1">O.S.: {i.os || '---'}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">{i.filial}</div>
                </td>
                <td className="p-4 align-top">
                  <div className="text-[11px] font-black text-red-500 uppercase">{i.tipo}</div>
                  <div className="text-xs text-slate-800 font-bold mt-0.5">{i.falha}</div>
                  {i.observacoes && <div className="text-[10px] text-slate-500 italic mt-2 border-l-2 border-slate-200 pl-2">{i.observacoes}</div>}
                </td>
                <td className="p-4 align-top text-center">
                  <span className={`inline-block px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${
                    i.situacao === 'FINALIZADO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    i.situacao === 'EM ANDAMENTO' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>{i.situacao}</span>
                </td>
                <td className="p-4 align-top text-right">
                  <div className="text-[10px] font-bold text-slate-600 mb-1"><span className="text-slate-400 font-black">INÍCIO:</span> {i.data_parada ? new Date(i.data_parada).toLocaleDateString('pt-BR') : '-'}</div>
                  <div className="text-[10px] font-bold text-slate-600"><span className="text-slate-400 font-black">FIM:</span> {i.data_final ? new Date(i.data_final).toLocaleDateString('pt-BR') : (i.prazo ? new Date(i.prazo).toLocaleDateString('pt-BR') : '-')}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* --- FIM DO CÓDIGO DE IMPRESSÃO --- */}

    </div> 
  );
};

export default Programacao;
