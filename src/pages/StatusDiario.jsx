import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase-config';
import { useNavigate } from 'react-router-dom';
import { Truck, ChevronLeft, Filter, Edit3, Share2, PlusCircle, CheckCircle2, AlertCircle, Mail, X, CalendarClock } from 'lucide-react';
import emailjs from '@emailjs/browser';

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

  const dispararEmail = () => {
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
        
        // Incluindo a previsão no HTML do e-mail com destaque visual
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

    const templateParams = {
      unidade: filtroUnidade,
      total_ativos: ativosRelatorio.length,
      total_parados: ativosRelatorio.filter(a => a.status === 'Parada').length,
      detalhes_gerais_html: tabelaHtml, 
      resumo_disponibilidade_html: resumoHtml,
      data_atual: dataFormatada,
      to_email: destinatarios 
    };

    emailjs.send('service_ql8lpnh', 'template_n6464qs', templateParams, 'dxlv8dovCZmMHhwgD')
      .then(() => {
        alert('✅ Relatório enviado com sucesso!');
        setModalEnvioAberto(false);
      })
      .catch((err) => alert('❌ Erro: ' + err.text));
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

      // 1. Atualiza o equipamento/caminhão
      const { error: errorUpdate } = await supabase
        .from(abaAtiva)
        .update(payloadAtualizacao)
        .eq('id', itemSelecionado.id);
      
      if (errorUpdate) throw errorUpdate;

      // 2. CORREÇÃO: Registra no Histórico
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
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="hover:bg-white/20 p-2 rounded-full transition"><ChevronLeft size={24} /></button>
          <div>
            <h1 className="font-black text-xl tracking-tight uppercase flex items-center gap-2"><Truck size={20} /> Status Diário</h1>
            <p className="text-[10px] opacity-80 font-medium">Bandeirantes Deicmar</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setModalEnvioAberto(true)} className="bg-white text-[#0f4c81] p-2 px-4 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md hover:bg-slate-100 transition">
             <Share2 size={18} /> <span className="hidden md:inline">Enviar Status</span>
           </button>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        <div className="flex bg-white p-3 rounded-2xl shadow-sm mb-6 gap-4 items-center">
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setAbaAtiva('equipamentos')} className={`px-6 py-2 rounded-lg font-bold text-sm ${abaAtiva === 'equipamentos' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}>Equipamentos</button>
                <button onClick={() => setAbaAtiva('caminhoes')} className={`px-6 py-2 rounded-lg font-bold text-sm ${abaAtiva === 'caminhoes' ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500'}`}>Caminhões</button>
            </div>
            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="bg-transparent font-bold text-[#0f4c81] outline-none text-sm ml-auto cursor-pointer uppercase">
              <option value="TODAS">TODAS AS UNIDADES</option>
              <option value="BK">BK</option><option value="CLIA">CLIA</option><option value="IPA">IPA</option>
            </select>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
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
      </main>

      {/* MODAL DE ENVIO */}
      {modalEnvioAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2"><Mail size={20} /> Enviar Relatório</h2>
                <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Unidade: {filtroUnidade}</p>
              </div>
              <button onClick={() => setModalEnvioAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={20}/></button>
            </div>
            <div className="p-8">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Destinatários</label>
              <textarea value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-[#10b981] outline-none transition resize-none" rows="3" placeholder="exemplo@email.com, gerencia@email.com" />
              <button onClick={dispararEmail} className="w-full mt-8 py-4 bg-[#0f4c81] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg hover:bg-[#0c3d69] transition-all flex items-center justify-center gap-2"><Share2 size={18}/> Confirmar e Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ATUALIZAÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2"><Edit3 size={20} /> Atualizar Status</h2>
                <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-1">Ativo: {itemSelecionado?.tag || itemSelecionado?.frota}</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Situação Operacional</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setNovoStatus('Liberada')} className={`p-3 rounded-xl font-black uppercase tracking-widest text-xs border-2 transition-all ${novoStatus === 'Liberada' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>Liberada</button>
                  <button onClick={() => setNovoStatus('Parada')} className={`p-3 rounded-xl font-black uppercase tracking-widest text-xs border-2 transition-all ${novoStatus === 'Parada' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>Parada</button>
                </div>
              </div>
              {novoStatus === 'Parada' && (
                <div className="space-y-5 border-t border-slate-100 pt-5 mt-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Motivo da Parada</label>
                    <textarea value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-red-400 outline-none resize-none transition-colors" rows="2" placeholder="Descreva o problema..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Previsão de Liberação</label>
                    <input type="date" value={novaPrevisao} onChange={(e) => setNovaPrevisao(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-amber-400 outline-none transition-colors" />
                  </div>
                </div>
              )}
              <button onClick={handleSalvarStatus} className="w-full mt-6 py-4 bg-[#0f4c81] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg hover:bg-[#0c3d69] transition-all flex items-center justify-center gap-2">
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><CheckCircle2 size={18} /> Salvar Alterações</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fade-in { animation: fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default StatusDiario;