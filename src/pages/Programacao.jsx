import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase-config';
import { useNavigate } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  
  // Controle Cronograma (Semanas)
  const [dataBaseGantt, setDataBaseGantt] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const start = new Date(d.setDate(d.getDate() - day + (day === 6 ? 0 : -1)));
    start.setHours(0,0,0,0);
    return start;
  });

  // Modais e Formulário
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

  // --- LÓGICA DE DATAS DA SEMANA ---
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

  // --- BUSCA SUPABASE ---
  const fetchProgramacao = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('programacao').select('*').order('data_parada', { ascending: true });
    if (!error) setDados(data);
    setLoading(false);
  };
  useEffect(() => { fetchProgramacao(); }, []);

  // ==============================
  // GERADOR DE RELATÓRIO PDF REAL
  // ==============================
  const gerarRelatorioPDF = () => {
    try {
      // Cria um novo documento A4 em modo paisagem (landscape) para caber mais dados
      const doc = new jsPDF('landscape');

      // 1. Configurações de Título
      doc.setFontSize(22);
      doc.setTextColor(15, 76, 129); // Azul do seu tema (#0f4c81)
      doc.text('Plano de Manutenção Semanal', 14, 20);

      // 2. Informações de Filtro (Subtítulo corrigido)
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Filiais Filtradas: ${filiaisExportacao.join(', ')}`, 14, 28);
      
      const dataInicio = diasDaSemana[0]?.toLocaleDateString('pt-BR');
      const dataFim = diasDaSemana[6]?.toLocaleDateString('pt-BR');
      doc.text(`Período: ${dataInicio} a ${dataFim}`, 14, 33);

      // 3. Filtrar dados respeitando as caixinhas marcadas no Modal (igual ao disparo de E-mail)
      const dadosParaExportacao = dados.filter(i => {
        if(!i.data_parada) return false;
        
        const atendeFilial = filiaisExportacao.includes('TODAS') || filiaisExportacao.includes(i.filial);
        if (!atendeFilial) return false;
        
        const dp = new Date(i.data_parada).setHours(0,0,0,0);
        const df = i.data_final ? new Date(i.data_final).setHours(0,0,0,0) : (i.prazo ? new Date(i.prazo).setHours(0,0,0,0) : dp);
        const semInicio = diasDaSemana[0].setHours(0,0,0,0);
        const semFim = diasDaSemana[6].setHours(23,59,59,999);
        
        return dp <= semFim && df >= semInicio;
      });

      // 4. Montar os dados da Tabela
      const colunas = ["Máquina", "Filial", "OS", "Tipo / Falha", "Período", "Responsável", "Observações"];
      
      const linhas = dadosParaExportacao.map(item => {
        const inicio = new Date(item.data_parada).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        const fim = item.data_final ? new Date(item.data_final).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : (item.prazo ? new Date(item.prazo).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : inicio);
        
        return [
          item.placa,
          item.filial,
          item.os || '-',
          `${item.tipo}\nFalha: ${item.falha}`, // Quebra de linha dentro da célula
          `De: ${inicio}\nAté: ${fim}`,
          item.responsavel || '-',
          item.observacoes || '-'
        ];
      });

      // 5. Gerar a Tabela no PDF
      doc.autoTable({
        startY: 40,
        head: [colunas],
        body: linhas,
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 76, 129], // Fundo azul do cabeçalho
          textColor: 255, 
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { 
          fontSize: 8,
          valign: 'middle' 
        },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'center', cellWidth: 25 }, // Máquina
          1: { halign: 'center', cellWidth: 20 }, // Filial
          2: { halign: 'center', cellWidth: 25 }, // OS
          3: { cellWidth: 45 }, // Tipo/Falha
          4: { cellWidth: 35 }, // Período
          5: { cellWidth: 40 }, // Responsável
          // Observações ocupa o restante do espaço
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250] // Linhas zebradas bem suaves
        },
        emptyMessage: "Nenhuma manutenção programada para a semana e filtros selecionados."
      });

      // 6. Salva e baixa o arquivo na máquina do usuário
      doc.save(`Plano_Manutencao_${dataInicio.replace(/\//g, '-')}.pdf`);

    } catch (error) {
      // Caso ocorra algum outro erro no futuro, um alerta aparecerá na tela em vez de falhar em silêncio
      alert("Erro ao gerar o PDF: " + error.message);
      console.error("Erro detalhado do PDF:", error);
    }
  };

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

  
  // --- FUNÇÃO DE ENVIO DE E-MAIL (COM BUSCA DE MODELO E ORDENAÇÃO) ---
  const dispararEmail = async () => {
    if (!destinatariosEmail) {
      alert("⚠️ Por favor, digite o e-mail de destino.");
      return;
    }

    try {
      // 1. Filtra os dados da semana e das filiais
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

      // 2. Busca a 'descricao_modelo' na tabela equipamentos
      const placasDaSemana = [...new Set(dadosParaEnvio.map(i => i.placa))];
      let equipamentosInfo = [];

      if (placasDaSemana.length > 0) {
        const { data: equipData, error: equipError } = await supabase
          .from('equipamentos')
          .select('id, descricao_modelo')
          .in('id', placasDaSemana);
          
        if (!equipError && equipData) {
          equipamentosInfo = equipData;
        }
      }

      // 3. Junta as informações e Ordena (Reach Stacker no topo)
      const itensOrdenados = dadosParaEnvio.map(item => {
        const equip = equipamentosInfo.find(e => e.id === item.placa);
        return {
          ...item,
          descricao_modelo: equip ? equip.descricao_modelo : 'FROTA/OUTRO'
        };
      }).sort((a, b) => {
        const modeloA = a.descricao_modelo.toUpperCase();
        const modeloB = b.descricao_modelo.toUpperCase();
        
        const aIsRS = modeloA.includes('REACH STACKER');
        const bIsRS = modeloB.includes('REACH STACKER');
        
        if (aIsRS && !bIsRS) return -1;
        if (!aIsRS && bIsRS) return 1;
        return 0; // Mantém a ordem se ambos forem ou não forem Reach Stacker
      });

      // 4. Montagem da Tabela Única HTML
      let htmlCorpo = `<table width="100%" cellpadding="10" cellspacing="0" style="border: 1px solid #e2e8f0; font-family: sans-serif; font-size: 12px; border-collapse: collapse;">
        <tr style="background-color: #0f4c81; color: white; text-transform: uppercase; font-size: 11px;">
          <th align="left">Identificação</th>
          <th align="left">Manutenção</th>
          <th align="left">Situação</th>
          <th align="left">Prazos</th>
        </tr>`;

      if (itensOrdenados.length === 0) {
          htmlCorpo += `<tr><td colspan="4" align="center" style="padding: 20px; color: #64748b;">Nenhuma O.S. para as unidades selecionadas nesta semana.</td></tr>`;
      } else {
          itensOrdenados.forEach(i => {
            const isRS = i.descricao_modelo.toUpperCase().includes('REACH STACKER');
            // Fundo azul claro se for Reach Stacker
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

      // 5. Envio
      const templateParams = {
        unidades: filiaisExportacao.join(', '),
        total_os: itensOrdenados.length,
        conteudo_html: htmlCorpo,
        to_email: destinatariosEmail
      };

      await emailjs.send('service_ql8lpnh', 'template_jucx4wg', templateParams, 'dxlv8dovCZmMHhwgD');
      
      alert('✅ Relatório enviado com sucesso!');
      setModalExportarAberto(false);
      setDestinatariosEmail('');
    } catch (err) {
      alert('❌ Erro: ' + (err.text || err.message));
    }
  };

  // --- DADOS FILTRADOS PARA A SEMANA SELECIONADA ---
  const dadosFiltradosGerais = dados.filter(i => filtroFilial === 'TODAS' || i.filial === filtroFilial);
  
  // Filtra apenas O.S. que sobrepõem a semana visualizada no Gráfico
  const itensDaSemana = dadosFiltradosGerais.filter(i => {
    if(!i.data_parada) return false;
    const dp = new Date(i.data_parada).setHours(0,0,0,0);
    const df = i.data_final ? new Date(i.data_final).setHours(0,0,0,0) : (i.prazo ? new Date(i.prazo).setHours(0,0,0,0) : dp);
    const semInicio = diasDaSemana[0].setHours(0,0,0,0);
    const semFim = diasDaSemana[6].setHours(23,59,59,999);
    // Retorna true se a parada começou antes do fim da semana E terminou depois do início da semana
    return dp <= semFim && df >= semInicio;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans print:bg-white">
      
      {/* HEADER TELA */}
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="hover:bg-white/20 p-2 rounded-full transition"><ChevronLeft /></button>
          <h1 className="font-black text-xl tracking-tight uppercase flex items-center gap-2"><Wrench size={20} /> Programação</h1>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setModalExportarAberto(true)} className="bg-white/20 p-2 px-4 rounded-lg flex items-center gap-2 text-sm font-bold border border-white/20 hover:bg-white/30 transition"><FileText size={18} /> Exportar Relatório</button>
           <button onClick={() => { setItemEditando(null); setFormData({ filial: 'CLIA', situacao: 'PROGRAMADO', duracao: 'CURTA', tipo: 'PREVENTIVA', falha: 'MOTOR', reprogramado: 'NÃO' }); setModalAberto(true); }} className="bg-white text-[#0f4c81] p-2 px-4 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md hover:scale-105 transition"><PlusCircle size={18} /> Nova Parada</button>
        </div>
      </header>

      {/* HEADER CORPORATIVO (IMPRESSÃO) */}
      <div className="hidden print:block mb-8 border-b-4 border-[#0f4c81] pb-6 pt-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-black text-[#0f4c81] uppercase tracking-tighter">Cronograma Semanal de Manutenção</h1>
            <h2 className="text-lg font-bold text-slate-500 uppercase tracking-widest mt-1">Unidade: {filtroFilial}</h2>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-400 uppercase">Bandeirantes Deicmar</p>
            <p className="text-sm font-bold text-emerald-600">Período: {diasDaSemana[0].toLocaleDateString()} a {diasDaSemana[6].toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <main className="p-4 max-w-[1700px] mx-auto print:p-0">

        {/* CABEÇALHO CORPORATIVO DE IMPRESSÃO */}
        <div className="hidden print:flex report-header">
          <div className="flex flex-col">
            <h1 className="report-title">Programação Semanal</h1>
            <p className="text-sm font-bold opacity-80 uppercase tracking-widest">
              Bandeirantes Deicmar - Hub Logístico
            </p>
            <p className="text-xs mt-1">
              Período: {diasDaSemana[0].toLocaleDateString()} a {diasDaSemana[6].toLocaleDateString()}
            </p>
          </div>
          
          <div className="flex flex-col items-end">
            {/* COLOQUE O LINK DO SEU LOGO AQUI */}
            <img 
              src="LINK_DA_SUA_LOGO_AQUI" 
              alt="Logo Empresa" 
              className="report-logo mb-2"
              onError={(e) => e.target.style.display = 'none'} 
            />
            <span className="text-[10px] font-black uppercase opacity-60">
              Unidade: {filtroFilial}
            </span>
          </div>
        </div>
        
        {/* BARRA DE FILTROS DA TELA */}
        <div className="flex justify-between items-center mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 print:hidden">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setAbaAtiva('kanban')} className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${abaAtiva === 'kanban' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}><Layout size={16}/> Acompanhamento </button>
            <button onClick={() => setAbaAtiva('cronograma')} className={`px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${abaAtiva === 'cronograma' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}><Calendar size={16}/> Cronograma </button>
          </div>
          <select value={filtroFilial} onChange={e => setFiltroFilial(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl font-bold text-[#0f4c81] outline-none text-sm uppercase">
            <option value="TODAS">Todas as Unidades</option>
            {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* --- VISÃO 1: KANBAN ACORDEÃO --- */}
        {abaAtiva === 'kanban' && (
          <div className="flex gap-4 overflow-x-hidden w-full h-[75vh] items-stretch print:hidden">
            {COLUNAS_KANBAN.map(coluna => {
              const isOpen = colunaAberta === coluna;
              const itens = dadosFiltradosGerais.filter(i => i.situacao === coluna);
              return (
                <div key={coluna} onClick={() => !isOpen && setColunaAberta(coluna)} className={`transition-all duration-500 flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden ${isOpen ? 'flex-1 shadow-xl' : 'w-[70px] cursor-pointer hover:bg-slate-50'}`}>
                  <div className={`p-4 flex justify-between items-center bg-slate-50 border-b border-slate-100 ${!isOpen && 'h-full flex-col justify-start pt-8'}`}>
                    <h3 className={`font-black uppercase tracking-widest text-[#0f4c81] ${isOpen ? 'text-sm' : 'text-[10px] [writing-mode:vertical-lr] rotate-180'}`}>{coluna}</h3>
                    <span className={`bg-[#0f4c81] text-white font-bold rounded-full flex items-center justify-center ${isOpen ? 'px-3 py-1 text-xs' : 'w-8 h-8 text-[10px] mt-4'}`}>{itens.length}</span>
                  </div>
                  {isOpen && (
                    <div className="p-4 overflow-y-auto h-full flex flex-wrap gap-4 items-start content-start bg-slate-50/50">
                      {itens.map(item => (
                        <div key={item.id} onClick={(e) => { e.stopPropagation(); abrirEdicao(item); }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-8 border-l-[#10b981] hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group w-full md:w-[calc(50%-8px)] lg:w-[calc(33.33%-11px)]">
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

        {/* --- VISÃO 2: CRONOGRAMA PROPORCIONAL GANTT --- */}
        {(abaAtiva === 'cronograma' || window.matchMedia("print").matches) && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-white overflow-visible flex flex-col print:shadow-none print:border-none print:rounded-none">
            
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-t-[2rem] border-b border-slate-100 print:hidden">
              <div className="flex items-center gap-4">
                 <h2 className="font-black text-[#0f4c81] uppercase tracking-widest text-sm ml-4">Gantt Visual</h2>
                 <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
                    <button onClick={prevWeek} className="p-2 hover:bg-slate-100 rounded-md transition text-slate-500"><LeftIcon size={18}/></button>
                    <button onClick={resetWeek} className="px-4 font-bold text-xs uppercase text-[#0f4c81] hover:bg-slate-50 transition">Semana Atual</button>
                    <button onClick={nextWeek} className="p-2 hover:bg-slate-100 rounded-md transition text-slate-500"><RightIcon size={18}/></button>
                 </div>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[65vh] pb-32 print:pb-0 print:max-h-none print:overflow-visible">
              <table className="w-full text-sm border-collapse min-w-[900px]">
                
                {/* 2. O thead agora é sticky, fica no top-0 e tem z-[70] para ficar acima das barras */}
                <thead className="sticky top-0 z-[70] print:static">
                  {/* Fundo levemente opaco para as linhas não ficarem bagunçadas ao passar por baixo */}
                  <tr className="bg-slate-100/95 backdrop-blur-md shadow-sm border-b border-slate-200">
                    {diasDaSemana.map((dia, idx) => (
                      <th key={idx} className="p-4 text-center border-r border-slate-200/60 w-[14.28%]">
                        <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">{DIAS_SEMANA[idx]}</span>
                        <span className={`text-xl font-black ${dia.toDateString() === new Date().toDateString() ? 'text-[#10b981] bg-emerald-100/50 px-2 rounded-lg' : 'text-[#0f4c81]'}`}>{dia.getDate()}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 relative">
                  {itensDaSemana.map((item) => {
                    const dataParada = new Date(item.data_parada);
                    dataParada.setHours(0,0,0,0);
                    
                    const dataFimReal = item.data_final ? new Date(item.data_final) : (item.prazo ? new Date(item.prazo) : dataParada);
                    dataFimReal.setHours(0,0,0,0);
                    
                    // Cálculo das Proporções da Barra (Início e Fim na Semana)
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
                                {/* BARRA VISUAL */}
                                <div className="h-full w-full bg-gradient-to-r from-[#0f4c81] to-[#10b981] rounded-2xl shadow-md p-4 text-white flex items-center justify-between border-2 border-white/20 print:border-black print:text-black print:bg-none print:border-2 hover:brightness-110 hover:shadow-lg transition-all relative overflow-hidden">
                                  <div className="flex flex-col truncate pr-6">
                                    <div className="flex items-center gap-2">
                                      <span className="font-black text-sm uppercase tracking-tighter">{item.placa}</span>
                                      <span className="text-[9px] font-black bg-black/20 px-2 py-0.5 rounded uppercase tracking-tighter hidden md:block">OS: {item.os}</span>
                                    </div>
                                    <span className="text-[11px] font-bold opacity-90 truncate italic mt-1">{item.observacoes || item.tipo}</span>
                                  </div>
                                  <div className="absolute right-4 opacity-40 group-hover:opacity-100 transition-opacity">
                                    <Edit3 size={18} />
                                  </div>
                                </div>

                                {/* TOOLTIP CORRIGIDO (Abre para baixo com top-full e mt-2) */}
                                <div className="hidden group-hover:block absolute top-full left-4 mt-2 w-64 bg-slate-900 text-white text-xs rounded-xl shadow-xl p-3 z-[100] pointer-events-none print:hidden">
                                   <div className="font-black text-emerald-400 mb-1 uppercase">{item.tipo} - {item.falha}</div>
                                   <div><strong className="text-slate-400">Parada:</strong> {new Date(item.data_parada).toLocaleDateString()}</div>
                                   <div><strong className="text-slate-400">Fim Real/Prev:</strong> {dataFimReal.toLocaleDateString()}</div>
                                   <div className="mt-1 pt-1 border-t border-slate-700 italic text-slate-300">Resp: {item.responsavel}</div>
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

            {/* RESUMO DETALHADO (OCULTO NA TELA, VISÍVEL APENAS NA IMPRESSÃO) */}
            <div className="hidden print:block mt-8" style={{ pageBreakBefore: 'always' }}>
               <h3 className="font-black text-[#0f4c81] uppercase tracking-widest text-sm mb-4 border-b-2 border-slate-200 pb-2">
                 Detalhamento Técnico da Semana
               </h3>
               <div className="grid grid-cols-2 gap-4">
                 {itensDaSemana.map(item => {
                   const bgStatus = item.situacao === 'FINALIZADO' ? '#d1fae5' : (item.situacao === 'EM ANDAMENTO' ? '#fef3c7' : '#f1f5f9');
                   const textStatus = item.situacao === 'FINALIZADO' ? '#047857' : (item.situacao === 'EM ANDAMENTO' ? '#b45309' : '#475569');

                   return (
                     <div 
                       key={`det-${item.id}`} 
                       className="p-4 rounded-xl border-2 border-slate-200 h-auto" 
                       style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                     >
                       <div className="flex justify-between items-start mb-2">
                          <span className="font-black text-[#0f4c81] text-sm uppercase">{item.placa}</span>
                          <span 
                            className="text-[9px] font-black uppercase px-2 py-1 rounded print-color-force" 
                            style={{ 
                              backgroundColor: bgStatus, 
                              color: textStatus,
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact'
                            }}
                          >
                            {item.situacao}
                          </span>
                       </div>
                       <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase">
                          OS: {item.os || 'N/A'} | Resp: {item.responsavel || 'N/D'}
                       </div>
                       
                       {/* AQUI ESTÁ A CORREÇÃO DO TEXTO: break-words, whitespace-pre-wrap, h-auto, w-full */}
                       <div 
                         className="p-3 rounded-lg text-[10px] text-slate-800 border border-slate-200 h-auto w-full overflow-hidden print-color-force" 
                         style={{ 
                           backgroundColor: '#f8fafc',
                           WebkitPrintColorAdjust: 'exact',
                           printColorAdjust: 'exact'
                         }}
                       >
                          <strong className="text-red-600 uppercase">{item.tipo} - {item.falha}</strong><br/> 
                          <div className="italic mt-1 whitespace-pre-wrap break-words w-full">
                            {item.observacoes || 'Sem observações registradas.'}
                          </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL EXPORTAR / EMAIL */}
      {modalExportarAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><FileText size={20} /> Exportar Relatório</h2>
              <button onClick={() => setModalExportarAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-6">
              
              {/* ÁREA DE MÚLTIPLA SELEÇÃO DE FILIAIS */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">
                  1. Selecione as Unidades (Clique para marcar):
                </label>
                <div className="flex flex-wrap gap-2">
                  {['TODAS', ...FILIAIS].map(f => (
                    <button
                      key={f}
                      onClick={() => {
                        if (f === 'TODAS') {
                          setFiliaisExportacao(['TODAS']);
                        } else {
                          const semTodas = filiaisExportacao.filter(item => item !== 'TODAS');
                          if (semTodas.includes(f)) {
                            // Se já tem, remove
                            setFiliaisExportacao(semTodas.filter(item => item !== f));
                          } else {
                            // Se não tem, adiciona
                            setFiliaisExportacao([...semTodas, f]);
                          }
                        }
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${
                        filiaisExportacao.includes(f) 
                        ? 'bg-[#0f4c81] border-[#0f4c81] text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">2. E-mail de Destino:</label>
                <input 
                  type="email" 
                  placeholder="exemplo@deicmar.com.br" 
                  value={destinatariosEmail} 
                  onChange={e => setDestinatariosEmail(e.target.value)} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-medium text-slate-700 outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
              <button onClick={() => { setModalExportarAberto(false); gerarRelatorioPDF(); }} className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-2 text-[#0f4c81] transition"> 
                  <Printer size={20}/> Baixar PDF 
                </button>
                <button onClick={dispararEmail} className="p-4 bg-emerald-100 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-2xl font-black uppercase tracking-widest text-xs flex flex-col items-center gap-2 transition-all shadow-sm">
                  <Mail size={24}/> Enviar E-mail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto print:hidden">
          <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 my-8">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2"><Wrench size={20} /> {itemEditando ? 'Editar O.S.' : 'Nova Ordem de Serviço'}</h2>
              <button onClick={() => setModalAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={20}/></button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* LINHA 1 */}
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
                <select value={formData.filial} onChange={e => setFormData({...formData, filial: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 focus:border-[#10b981] outline-none">
                  {FILIAIS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Situação</label>
                <select value={formData.situacao} onChange={e => setFormData({...formData, situacao: e.target.value})} className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl font-black text-amber-700 outline-none">
                  {COLUNAS_KANBAN.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* LINHA 2 */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block text-red-500">Tipo de Manutenção</label>
                <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none">
                  {TIPOS_MANUTENCAO.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block text-red-500">Sistema / Falha</label>
                <select value={formData.falha} onChange={e => setFormData({...formData, falha: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none">
                  {FALHAS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* LINHA 3 */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block flex items-center gap-1"><Clock size={12}/> Data Parada</label>
                <input type="datetime-local" value={formData.data_parada} onChange={e => setFormData({...formData, data_parada: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block flex items-center gap-1"><Clock size={12}/> Prazo Previsto</label>
                <input type="datetime-local" value={formData.prazo} onChange={e => setFormData({...formData, prazo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block flex items-center gap-1 text-emerald-600"><Clock size={12}/> Data Final</label>
                <input type="datetime-local" value={formData.data_final} onChange={e => setFormData({...formData, data_final: e.target.value})} className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-bold text-emerald-700 outline-none text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Duração</label>
                  <select value={formData.duracao} onChange={e => setFormData({...formData, duracao: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none text-xs">
                    {DURACAO.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Reprog.</label>
                  <select value={formData.reprogramado} onChange={e => setFormData({...formData, reprogramado: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none text-xs">
                    <option value="NÃO">NÃO</option><option value="SIM">SIM</option>
                  </select>
                </div>
              </div>

              {/* LINHA 4 */}
              <div className="md:col-span-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Observações do Serviço</label>
                <textarea value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} rows="2" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none resize-none" placeholder="Detalhes..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Responsável</label>
                <input type="text" value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" placeholder="Mecânico" />
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 justify-end">
              <button onClick={() => setModalAberto(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl">Cancelar</button>
              <button onClick={handleSalvar} className="px-8 py-3 bg-[#0f4c81] text-white font-black uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 transition-transform">Salvar Programação</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          /* Configuração da Página */
          @page { 
            size: landscape; 
            margin: 10mm; 
          }

          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }

          /* Esconde elementos desnecessários */
          header, .print\:hidden, button, select { 
            display: none !important; 
          }

          /* Layout do Relatório */
          .report-header {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            margin-bottom: 30px;
            background: linear-gradient(to right, #0f4c81, #10b981) !important;
            color: white !important;
            border-radius: 15px;
          }

          .report-logo {
            height: 60px;
            width: auto;
            background: white;
            padding: 5px;
            border-radius: 8px;
          }

          .report-title {
            font-size: 24pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -1px;
          }

          /* Ajuste da Tabela Gantt no Papel */
          table { 
            width: 100% !important; 
            border-collapse: collapse !important;
          }
          
          th { 
            background-color: #f1f5f9 !important; 
            color: #0f4c81 !important;
            border: 1px solid #e2e8f0 !important;
          }

          td { 
            border: 1px solid #f1f5f9 !important; 
          }

          /* Detalhamento Técnico */
          .tech-details-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 30px;
          }

          .tech-card {
            border-left: 5px solid #0f4c81 !important;
            padding: 10px;
            background: #f8fafc !important;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default Programacao;
