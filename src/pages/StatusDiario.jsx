import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase-config';
import { useNavigate } from 'react-router-dom';
import { Truck, ChevronLeft, Filter, Edit3, Share2, PlusCircle, CheckCircle2, AlertCircle, Mail, X, CalendarClock } from 'lucide-react';

const EMAIL_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_EMAIL_URL || '';
const FORM_GESTAO_INICIAL = {
  id: '', tag: '', frota: '', placa: '', modelo: '',
  familia: '', ccusto: '', local: 'BK', operacao: 'BK', descricao_modelo: '',
};

const escaparHtml = (valor) => String(valor ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const StatusDiario = () => {
  const navigate = useNavigate();
  const [dados, setDados] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('equipamentos');
  const [filtroUnidade, setFiltroUnidade] = useState('TODAS');
  const [loading, setLoading] = useState(true);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [modalEnvioAberto, setModalEnvioAberto] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  
  const [novoStatus, setNovoStatus] = useState('Liberada');
  const [novoMotivo, setNovoMotivo] = useState('');
  const [novaPrevisao, setNovaPrevisao] = useState(''); 
  const [destinatarios, setDestinatarios] = useState('carina.ribeiro@band-deicmar.com.br');
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // Novos estados para Cadastro e Transferência
  const [modalGestaoAberto, setModalGestaoAberto] = useState(false);
  const [abaGestao, setAbaGestao] = useState('equipamento'); // 'equipamento', 'caminhao' ou 'transferencia'
  const [formGestao, setFormGestao] = useState(FORM_GESTAO_INICIAL);

  const handleSalvarGestao = async () => {
    setLoading(true);
    try {
      if (abaGestao === 'transferencia') {
        if (!formGestao.tag || !formGestao.local) {
          throw new Error('Selecione o equipamento e o destino da transferência.');
        }

        // Lógica de Transferência (Update)
        const { error } = await supabase
          .from('equipamentos')
          .update({ local: formGestao.local, ultimaAtualizacao: new Date().toISOString() })
          .eq('tag', formGestao.tag);
        if (error) throw error;
        alert("✅ Equipamento transferido com sucesso!");
      } else {
        const tabela = abaGestao === 'equipamento' ? 'equipamentos' : 'caminhoes';
        const idEquipamento = formGestao.id.trim();
        const frota = formGestao.frota.trim();
        const placa = formGestao.placa.trim();
        const identificacao = abaGestao === 'equipamento'
          ? formGestao.tag.trim()
          : (frota || placa);
        const unidade = abaGestao === 'equipamento' ? formGestao.local : formGestao.operacao;

        if (!identificacao || !formGestao.modelo.trim() || !unidade || (abaGestao === 'equipamento' && !idEquipamento) || (abaGestao === 'caminhao' && !placa)) {
          throw new Error(abaGestao === 'equipamento'
            ? 'Preencha o ID, a TAG, o modelo e a unidade antes de salvar.'
            : 'Preencha a placa, o modelo e a unidade antes de salvar.');
        }

        const payload = abaGestao === 'equipamento'
          ? {
              id: idEquipamento,
              tag: identificacao,
              modelo: formGestao.modelo.trim(),
              descricao_modelo: formGestao.modelo.trim(),
              local: unidade,
              status: 'Liberada',
              ultimaAtualizacao: new Date().toISOString(),
            }
          : {
              id: identificacao,
              frota: frota || null,
              placa,
              modelo: formGestao.modelo.trim(),
              operacao: unidade,
              status: 'Liberada',
              ultimaAtualizacao: new Date().toISOString(),
            };

        const { data, error } = await supabase
          .from(tabela)
          .insert([payload])
          .select()
          .single();
        if (error) throw error;

        if (abaAtiva === tabela) {
          setDados((anteriores) => [...anteriores, data].sort((a, b) => (
            (abaAtiva === 'equipamentos' ? a.tag : a.frota)
              .localeCompare(abaAtiva === 'equipamentos' ? b.tag : b.frota)
          )));
        }

        alert(`✅ ${abaGestao.toUpperCase()} cadastrado com sucesso!`);
      }
      setModalGestaoAberto(false);
      setFormGestao(FORM_GESTAO_INICIAL);
    } catch (err) {
      const mensagem = err?.code === '23505'
        ? 'Já existe um ativo com essa identificação.'
        : err?.code === '42501'
          ? 'Seu usuário não possui permissão para incluir equipamentos. Verifique a política de INSERT no Supabase.'
          : err.message;
      alert("Erro na operação: " + mensagem);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from(abaAtiva)
        .select('*')
        .order(abaAtiva === 'equipamentos' ? 'tag' : 'frota', { ascending: true });
      if (!error && data) setDados(data);
      setLoading(false);
    };
    fetchData();
  }, [abaAtiva]);

  const formatarData = (dataString) => {
    if (!dataString) return '';
    return dataString.split('-').reverse().join('/');
  };

  const postarNoGoogleScript = (payload) => {
    const iframeName = 'status-diario-email-frame';
    let iframe = document.querySelector(`iframe[name="${iframeName}"]`);
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = EMAIL_SCRIPT_URL;
    form.target = iframeName;
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(payload);
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    window.setTimeout(() => form.remove(), 1000);
  };

  const dispararEmail = () => {
    if (!destinatarios.trim()) {
      alert('Informe pelo menos um destinatário.');
      return;
    }
    if (!EMAIL_SCRIPT_URL) {
      alert('Configure VITE_GOOGLE_SCRIPT_EMAIL_URL com a URL do Web App do Google Apps Script.');
      return;
    }

    const ativosRelatorio = dadosExibidos;
    const dataFormatada = new Date().toLocaleDateString('pt-BR').replaceAll('/', '.');

    const grupos = ativosRelatorio.reduce((acc, item) => {
      const grupo = item.descricao_modelo || 'GERAL';
      if (!acc[grupo]) acc[grupo] = [];
      acc[grupo].push(item);
      return acc;
    }, {});

    let tabelaHtml = `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-family: sans-serif;">`;
    
    Object.entries(grupos).forEach(([nomeGrupo, itens]) => {
      tabelaHtml += `
        <tr style="background-color: #f1f5f9;">
          <td colspan="3" style="padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 900; color: #0f4c81; text-transform: uppercase; border-left: 5px solid #10b981; border-bottom: 1px solid #e2e8f0;">
            ${nomeGrupo}
          </td>
        </tr>`;

      itens.forEach(i => {
        const icon = i.status === 'Parada' ? '🔴' : '🟢';
        const corStatus = i.status === 'Parada' ? '#e11d48' : '#059669';
        const previsaoHtml = (i.status === 'Parada' && i.previsao_liberacao) 
          ? `<div style="font-size: 10px; color: #d97706; font-weight: bold; margin-top: 4px; background-color: #fffbeb; padding: 2px 6px; border-radius: 4px; display: inline-block; border: 1px solid #fef3c7;">⏳ PREV: ${formatarData(i.previsao_liberacao)}</div>` 
          : '';
        
        tabelaHtml += `
          <tr style="border-bottom: 1px solid #f8fafc;">
            <td style="padding: 14px; font-size: 13px; font-weight: 800; color: #0f4c81; text-align: center;">${i.tag || i.frota}</td>
            <td style="padding: 14px; font-size: 12px; color: #64748b; text-align: center;">${i.modelo || i.marca_modelo || ''}</td>
            <td style="padding: 14px; font-size: 11px; font-weight: 900; color: ${corStatus}; text-align: center; text-transform: uppercase;">
              ${icon} ${i.status || 'LIBERADA'}
              ${i.motivo ? `<div style="font-size: 9px; color: #94a3b8; font-weight: normal; margin-top: 2px;">${i.motivo}</div>` : ''}
              ${previsaoHtml}
            </td>
          </tr>`;
      });
    });
    tabelaHtml += `</table>`;

    let resumoHtml = `<div style="text-align: center; padding: 10px;">`;
    Object.entries(grupos).forEach(([nomeGrupo, itens]) => {
      const operacionais = itens.filter(a => a.status !== 'Parada').length;
      const parados = itens.filter(a => a.status === 'Parada').length;
      resumoHtml += `
        <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px dashed #e2e8f0;">
          <div style="font-size: 11px; font-weight: 900; color: #0f4c81; text-transform: uppercase; letter-spacing: 1px;">${nomeGrupo}</div>
          <div style="font-size: 16px; margin-top: 8px; font-weight: 800;">
            <span style="color: #059669;">✅ ${operacionais}</span> 
            <span style="margin: 0 15px; color: #cbd5e1;">|</span> 
            <span style="color: #e11d48;">🛑 ${parados}</span>
          </div>
        </div>`;
    });
    resumoHtml += `</div>`;

    const totalParados = ativosRelatorio.filter(a => a.status === 'Parada').length;
    const html = [
      '<div style="font-family:Segoe UI,Roboto,sans-serif;background-color:#f3f6f9;padding:30px 10px;color:#1e293b;">',
      '<table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 20px 40px rgba(15,76,129,0.08);border:1px solid #e1e8ed;">',
      '<tr><td style="background:linear-gradient(135deg,#0f4c81 0%,#10b981 100%);padding:45px 20px;text-align:center;">',
      '<img src="https://i.ibb.co/Y4jjxnVb/08f3d902-e667-4927-8741-c47dfe39329b.png" alt="Logo" style="max-height:60px;width:auto;margin-bottom:25px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.15));">',
      '<h1 style="color:#ffffff;margin:0;font-size:24px;text-transform:uppercase;letter-spacing:4px;font-weight:900;">Status Diário</h1>',
      `<p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:13px;font-weight:600;letter-spacing:1px;">UNIDADE: <span style="color:#ffffff;">${escaparHtml(filtroUnidade)}</span> | ${dataFormatada}</p>`,
      '</td></tr>',
      '<tr><td style="padding:30px 25px 10px;"><table width="100%" cellspacing="0" cellpadding="0"><tr>',
      `<td align="center" width="48%" style="background-color:#f8fafc;padding:18px;border-radius:20px;border:1px solid #e2e8f0;"><span style="display:block;font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Frota Total</span><span style="font-size:30px;font-weight:900;color:#0f4c81;">${ativosRelatorio.length}</span></td>`,
      '<td width="4%">&nbsp;</td>',
      `<td align="center" width="48%" style="background-color:#fff1f2;padding:18px;border-radius:20px;border:1px solid #fecdd3;"><span style="display:block;font-size:10px;color:#e11d48;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Fora de Operação</span><span style="font-size:30px;font-weight:900;color:#e11d48;">${totalParados}</span></td>`,
      '</tr></table></td></tr>',
      `<tr><td style="padding:25px;"><div style="border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">${tabelaHtml}</div></td></tr>`,
      `<tr><td style="padding:0 25px 40px;"><div style="background-color:#f8fafc;border:2px solid #0f4c81;border-radius:24px;padding:30px;text-align:center;"><h3 style="color:#0f4c81;font-size:16px;margin:0 0 25px;text-transform:uppercase;letter-spacing:2px;font-weight:900;border-bottom:1px solid #e2e8f0;padding-bottom:12px;">Resumo de Disponibilidade</h3><div style="color:#0f4c81;">${resumoHtml}</div></div></td></tr>`,
      '<tr><td style="background-color:#f1f5f9;padding:25px;text-align:center;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Bandeirantes Deicmar • 2026</td></tr>',
      '</table></div>',
    ].join('');

    setEnviandoEmail(true);
    try {
      postarNoGoogleScript({
        to: destinatarios,
        subject: `Status Diário - ${filtroUnidade} - ${dataFormatada}`,
        html,
      });
      alert('✅ Solicitação enviada ao Google Apps Script.');
      setModalEnvioAberto(false);
    } catch (err) {
      alert('❌ Erro ao preparar o envio: ' + err.message);
    } finally {
      window.setTimeout(() => setEnviandoEmail(false), 1000);
    }
  };

  const autorizarEmailGoogle = () => {
    if (!EMAIL_SCRIPT_URL) {
      alert('Configure VITE_GOOGLE_SCRIPT_EMAIL_URL com a URL do Web App do Google Apps Script.');
      return;
    }
    window.open(EMAIL_SCRIPT_URL, '_blank', 'noopener,noreferrer');
  };

  const handleSalvarStatus = async () => {
    if (!itemSelecionado) return;
    setLoading(true);
    try {
      const payloadAtualizacao = { 
        status: novoStatus, 
        motivo: novoStatus === 'Liberada' ? '' : novoMotivo,
        previsao_liberacao: novoStatus === 'Liberada' ? null : (novaPrevisao || null),
        ultimaAtualizacao: new Date() 
      };

      const { error: errorUpdate } = await supabase
        .from(abaAtiva)
        .update(payloadAtualizacao)
        .eq('id', itemSelecionado.id);
      
      if (errorUpdate) throw errorUpdate;

      const { error: errorHistorico } = await supabase
        .from('historico')
        .insert([{
            equipamento_id: itemSelecionado.id,
            identificacao: itemSelecionado.tag || itemSelecionado.frota,
            status_anterior: itemSelecionado.status || 'Não Definido',
            status_novo: novoStatus,
            motivo: novoStatus === 'Liberada' ? 'Equipamento Liberado' : novoMotivo,
            previsao_liberacao: novoStatus === 'Liberada' ? null : (novaPrevisao || null),
            data_evento: new Date()
        }]);

      if (errorHistorico) throw errorHistorico;

      setDados(dados.map(d => d.id === itemSelecionado.id ? { ...d, ...payloadAtualizacao } : d));
      setModalAberto(false);
      setItemSelecionado(null);
      alert("✅ Status e Histórico atualizados com sucesso!");
    } catch (err) { 
      alert("Erro ao atualizar: " + err.message); 
    } finally {
      setLoading(false);
    }
  };

  const dadosExibidos = dados.filter(i => {
    const localValue = abaAtiva === 'equipamentos' ? i.local : i.operacao;
    return filtroUnidade === 'TODAS' || localValue === filtroUnidade;
  });

  const gruposTabela = dadosExibidos.reduce((acc, item) => {
    const grupo = item.descricao_modelo || 'OUTROS';
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-x-hidden">
      {/* HEADER: Ajustado para mobile (flex-col e botões largura total se necessário) */}
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => navigate('/')} className="hover:bg-white/20 p-1.5 md:p-2 rounded-full transition"><ChevronLeft size={22} /></button>
          <div>
            <h1 className="font-black text-lg md:text-xl tracking-tight uppercase flex items-center gap-2 leading-tight"><Truck size={18} className="md:w-5 md:h-5" /> Status Diário</h1>
            <p className="text-[9px] md:text-[10px] opacity-80 font-medium">Bandeirantes Deicmar</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            setAbaGestao(abaAtiva === 'equipamentos' ? 'equipamento' : 'caminhao');
            setFormGestao(FORM_GESTAO_INICIAL);
            setModalGestaoAberto(true);
          }}
          className="bg-[#10b981] text-white p-2 md:px-4 rounded-lg flex items-center gap-2 text-xs md:text-sm font-bold shadow-md hover:bg-emerald-600 transition" >
        <PlusCircle size={16} /> <span className="hidden sm:inline">Novo / Transferir</span>
        </button>
           <button onClick={() => setModalEnvioAberto(true)} className="bg-white text-[#0f4c81] p-2 md:px-4 rounded-lg flex items-center gap-2 text-xs md:text-sm font-bold shadow-md hover:bg-slate-100 transition">
             <Share2 size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden sm:inline">Enviar Status</span>
           </button>
        </div>
      </header>

      <main className="p-3 md:p-4 max-w-7xl mx-auto">
        {/* FILTROS: Empilhados no mobile, lado a lado no PC */}
        <div className="flex flex-col md:flex-row bg-white p-3 rounded-2xl shadow-sm mb-6 gap-4 md:items-center">
            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                <button onClick={() => setAbaAtiva('equipamentos')} className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${abaAtiva === 'equipamentos' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}>Equipamentos</button>
                <button onClick={() => setAbaAtiva('caminhoes')} className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-lg font-bold text-xs md:text-sm transition-all ${abaAtiva === 'caminhoes' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}>Caminhões</button>
            </div>
            <div className="flex items-center justify-between md:ml-auto">
              <span className="md:hidden text-[10px] font-black text-slate-400 uppercase">Unidade:</span>
              <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="bg-transparent font-black text-[#0f4c81] outline-none text-xs md:text-sm cursor-pointer uppercase">
                <option value="TODAS">TODAS AS UNIDADES</option>
                <option value="BK">BK</option><option value="CLIA">CLIA</option><option value="IPA">IPA</option><option value="FROTA">FROTA</option>
              </select>
            </div>
        </div>

        {/* VISUALIZAÇÃO DESKTOP: Mantém a tabela original */}
        <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4 text-center">Identificação</th>
                <th className="p-4 text-center">Modelo</th>
                <th className="p-4 text-center">Unidade</th>
                <th className="p-4 text-center">Situação</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && dados.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-400 font-medium">Carregando dados...</td></tr>
              ) : (
                Object.entries(gruposTabela).map(([grupo, itens]) => (
                  <React.Fragment key={grupo}>
                    <tr className="bg-slate-100/60">
                      <td colSpan="5" className="p-3 px-6 text-[11px] font-black text-[#0f4c81] uppercase tracking-widest border-l-4 border-[#10b981] text-left">
                        {grupo}
                      </td>
                    </tr>
                    {itens.map(item => (
                      <tr key={item.id} className={`${item.status === 'Parada' ? 'bg-red-50/40' : 'hover:bg-slate-50'} transition-colors`}>
                        <td className="p-4 font-black text-[#0f4c81] text-center">{item.tag || item.frota}</td>
                        <td className="p-4 text-slate-500 text-center font-medium text-xs">{item.modelo || item.marca_modelo}</td>
                        <td className="p-4 text-slate-400 text-center text-xs font-bold">{abaAtiva === 'equipamentos' ? item.local : item.operacao}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border uppercase ${item.status === 'Parada' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                            {item.status || 'LIBERADA'}
                          </span>
                          {item.status === 'Parada' && item.motivo && <div className="text-[9px] text-red-500 mt-1 font-bold block">{item.motivo}</div>}
                          {item.status === 'Parada' && item.previsao_liberacao && (
                            <div className="text-[10px] text-amber-600 mt-1 font-black flex justify-center items-center gap-1">
                               <CalendarClock size={12}/> Prev: {formatarData(item.previsao_liberacao)}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => { 
                            setItemSelecionado(item); 
                            setNovoStatus(item.status || 'Liberada'); 
                            setNovoMotivo(item.motivo || ''); 
                            setNovaPrevisao(item.previsao_liberacao || '');
                            setModalAberto(true); 
                          }} className="p-2 text-[#0f4c81] hover:bg-slate-100 rounded-lg transition-colors"><Edit3 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* VISUALIZAÇÃO MOBILE: Cards individuais por item */}
        <div className="md:hidden space-y-4">
          {loading && dados.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-medium">Carregando dados...</div>
          ) : (
            Object.entries(gruposTabela).map(([grupo, itens]) => (
              <div key={grupo} className="space-y-3">
                <div className="sticky top-[72px] z-20 py-2 px-1 bg-slate-50/95 backdrop-blur-sm">
                  <h3 className="text-[10px] font-black text-[#0f4c81] uppercase tracking-[0.2em] border-l-4 border-[#10b981] pl-3">
                    {grupo}
                  </h3>
                </div>
                {itens.map(item => (
                  <div key={item.id} className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between gap-3 ${item.status === 'Parada' ? 'ring-1 ring-red-100' : ''}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-base text-[#0f4c81]">{item.tag || item.frota}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${item.status === 'Parada' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                          {item.status || 'LIBERADA'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[200px]">
                        {item.modelo || item.marca_modelo} • {abaAtiva === 'equipamentos' ? item.local : item.operacao}
                      </div>
                      {item.status === 'Parada' && (
                        <div className="mt-2 space-y-1">
                          {item.motivo && <p className="text-[10px] text-red-500 font-medium leading-tight">{item.motivo}</p>}
                          {item.previsao_liberacao && (
                            <div className="text-[10px] text-amber-600 font-black flex items-center gap-1">
                              <CalendarClock size={11}/> Prev: {formatarData(item.previsao_liberacao)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => { 
                        setItemSelecionado(item); 
                        setNovoStatus(item.status || 'Liberada'); 
                        setNovoMotivo(item.motivo || ''); 
                        setNovaPrevisao(item.previsao_liberacao || '');
                        setModalAberto(true); 
                      }} 
                      className="bg-slate-50 p-3 rounded-xl text-[#0f4c81] active:bg-[#0f4c81] active:text-white transition-all shadow-sm"
                    >
                      <Edit3 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </main>

      {/* MODAL GESTÃO DE ATIVOS */}
      {modalGestaoAberto && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] md:rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Truck size={20} /> Gestão de Ativos
              </h2>
              <button onClick={() => setModalGestaoAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={24}/></button>
            </div>

            {/* ABAS DO MODAL */}
            <div className="flex bg-slate-100 p-1 m-6 rounded-xl">
              <button onClick={() => { setAbaGestao('equipamento'); setFormGestao(FORM_GESTAO_INICIAL); }} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition ${abaGestao === 'equipamento' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}>Novo Equip.</button>
              <button onClick={() => { setAbaGestao('caminhao'); setFormGestao(FORM_GESTAO_INICIAL); }} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition ${abaGestao === 'caminhao' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}>Novo Caminhão</button>
              <button onClick={() => { setAbaGestao('transferencia'); setFormGestao(FORM_GESTAO_INICIAL); }} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition ${abaGestao === 'transferencia' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}>Transferir</button>
            </div>

            <div className="px-6 pb-8 space-y-4 max-h-[60vh] overflow-y-auto">
              {abaGestao === 'transferencia' ? (
                <>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Equipamento (Tag)</label>
                    <select 
                      value={formGestao.tag}
                      onChange={(e) => setFormGestao({...formGestao, tag: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-[#0f4c81]"
                    >
                      <option value="">Selecione o Equipamento...</option>
                      {dados.filter(d => d.tag).map(d => <option key={d.id} value={d.tag}>{d.tag} - {d.descricao_modelo}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Novo Local (Destino)</label>
                    <select 
                      value={formGestao.local}
                      onChange={(e) => setFormGestao({...formGestao, local: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-[#10b981]"
                    >
                      <option value="">Selecione o Destino...</option>
                      <option value="BK">BK</option><option value="CLIA">CLIA</option><option value="IPA">IPA</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {abaGestao === 'equipamento' && (
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">ID do Sistema</label>
                      <input
                        type="text"
                        placeholder="Ex: CMB0001"
                        value={formGestao.id}
                        onChange={(e) => setFormGestao({...formGestao, id: e.target.value.toUpperCase()})}
                        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-[#0f4c81]"
                      />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                      {abaGestao === 'equipamento' ? 'Tag do Equipamento' : 'Número de Frota'}
                    </label>
                    <input 
                      type="text" 
                      placeholder={abaGestao === 'equipamento' ? 'Ex: EE01' : 'Ex: 5020 — deixe vazio para carreta'}
                      value={abaGestao === 'equipamento' ? formGestao.tag : formGestao.frota}
                      onChange={(e) => setFormGestao(abaGestao === 'equipamento' ? {...formGestao, tag: e.target.value.toUpperCase()} : {...formGestao, frota: e.target.value.toUpperCase()})}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-[#0f4c81]" 
                    />
                  </div>
                  {abaGestao === 'caminhao' && (
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Placa do Caminhão ou Carreta</label>
                      <input type="text" placeholder="ABC-1234" value={formGestao.placa} onChange={(e) => setFormGestao({...formGestao, placa: e.target.value.toUpperCase()})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-[#0f4c81]" />
                      <p className="mt-1 text-[10px] text-slate-400">Para carreta, deixe o número de frota vazio: a placa será usada como ID.</p>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Modelo</label>
                    <input type="text" value={formGestao.modelo} onChange={(e) => setFormGestao({...formGestao, modelo: e.target.value.toUpperCase()})} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-[#0f4c81]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Unidade/Operação</label>
                    <select 
                      value={abaGestao === 'equipamento' ? formGestao.local : formGestao.operacao}
                      onChange={(e) => setFormGestao(abaGestao === 'equipamento' ? {...formGestao, local: e.target.value} : {...formGestao, operacao: e.target.value})}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-[#0f4c81]"
                    >
                      <option value="BK">BK</option><option value="CLIA">CLIA</option><option value="IPA">IPA</option>
                    </select>
                  </div>
                </div>
              )}
              
              <button 
                onClick={handleSalvarGestao}
                className="w-full py-4 bg-[#0f4c81] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "Confirmar Operação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ENVIO: Ajustado para telas pequenas */}
      {modalEnvioAberto && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2"><Mail size={20} /> Enviar Status</h2>
                <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Unidade: {filtroUnidade}</p>
              </div>
              <button onClick={() => setModalEnvioAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={24}/></button>
            </div>
            <div className="p-6 md:p-8">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Destinatários</label>
              <textarea value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-[#10b981] outline-none transition resize-none text-sm" rows="3" placeholder="exemplo@email.com" />
              <button onClick={autorizarEmailGoogle} className="w-full mt-4 py-3 border-2 border-[#10b981] text-[#047857] font-black uppercase tracking-widest rounded-2xl text-xs hover:bg-emerald-50 transition">
                1. Autorizar meu e-mail Google
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-400">Necessário apenas no primeiro envio por usuário.</p>
              <button onClick={dispararEmail} disabled={enviandoEmail} className="w-full mt-6 mb-4 md:mb-0 py-4 bg-[#0f4c81] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"><Share2 size={18}/> {enviandoEmail ? 'Enviando...' : 'Confirmar e Enviar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ATUALIZAÇÃO: Ajustado para telas pequenas */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight flex items-center gap-2"><Edit3 size={20} /> Atualizar Status</h2>
                <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-1">Ativo: {itemSelecionado?.tag || itemSelecionado?.frota}</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={24}/></button>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Situação Operacional</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setNovoStatus('Liberada')} className={`py-4 rounded-2xl font-black uppercase tracking-widest text-xs border-2 transition-all ${novoStatus === 'Liberada' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>Liberada</button>
                  <button onClick={() => setNovoStatus('Parada')} className={`py-4 rounded-2xl font-black uppercase tracking-widest text-xs border-2 transition-all ${novoStatus === 'Parada' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>Parada</button>
                </div>
              </div>
              {novoStatus === 'Parada' && (
                <div className="space-y-4 border-t border-slate-100 pt-5 mt-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Motivo da Parada</label>
                    <textarea value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-red-400 outline-none resize-none transition-colors text-sm" rows="2" placeholder="Descreva o problema..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Previsão de Liberação</label>
                    <input type="date" value={novaPrevisao} onChange={(e) => setNovaPrevisao(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-amber-400 outline-none transition-colors" />
                  </div>
                </div>
              )}
              <button onClick={handleSalvarStatus} className="w-full mt-6 mb-8 md:mb-0 py-4 bg-[#0f4c81] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><CheckCircle2 size={18} /> Salvar Alterações</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        /* Ajuste do scroll para não esconder conteúdo atrás do header fixo no mobile */
        @media (max-width: 768px) {
          main { padding-bottom: 2rem; }
        }
      `}</style>
    </div>
  );
};

export default StatusDiario;
