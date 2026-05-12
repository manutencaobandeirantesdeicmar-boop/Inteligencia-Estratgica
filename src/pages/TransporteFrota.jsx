import React, { useState, useEffect, useMemo } from 'react';
import { supabaseFrota } from '../services/supabaseFrota-config'; 
import { useNavigate } from 'react-router-dom';
import { 
  Award as Trophy, Truck, Calendar, Filter, ChevronLeft, 
  Star as Medal, Package, Clock, Award, FileDown
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TransporteFrota = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rankingData, setRankingData] = useState([]);
  const [filtroMes, setFiltroMes] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [opcoesFiltros, setOpcoesFiltros] = useState({ meses: [], tipos: [] });

  useEffect(() => {
    const fetchFiltros = async () => {
      const { data } = await supabaseFrota
        .from('minhas_viagens')
        .select('mes, tipo')
        .order('id', { ascending: false }) 
        .limit(3000);

      if (data) {
        const m = [...new Set(data.map(i => i.mes?.trim().toUpperCase()))].filter(Boolean).sort();
        const t = [...new Set(data.map(i => i.tipo?.trim().toUpperCase()))].filter(Boolean).sort();
        setOpcoesFiltros({ meses: m, tipos: t });
      }
    };
    fetchFiltros();
  }, []);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabaseFrota.rpc('get_ranking_frota', {
          p_mes: filtroMes,
          p_tipo: filtroTipo
        });
        if (error) throw error;
        setRankingData(data || []);
      } catch (error) {
        console.error("Erro ao carregar ranking:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [filtroMes, filtroTipo]);

  const rankingPorTurno = useMemo(() => {
    const grupos = {};
    rankingData.forEach(item => {
      const turno = item.turno_nome || 'NÃO DEFINIDO';
      if (!grupos[turno]) grupos[turno] = [];
      grupos[turno].push({ nome: item.motorista_nome, total: item.total_viagens });
    });
    Object.keys(grupos).forEach(t => {
      grupos[t].sort((a, b) => filtroTipo === 'EXTRA' ? a.total - b.total : b.total - a.total);
    });
    return grupos;
  }, [rankingData, filtroTipo]);

  const exportarPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const azulMarinho = [15, 76, 129];
    const verdeEsmeralda = [16, 185, 129];
    
    // Cabeçalho
    doc.setFillColor(...azulMarinho);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('RANKING OPERACIONAL - FROTA', 15, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`RELATÓRIO: ${filtroTipo} | MÊS: ${filtroMes}`, 15, 28);
    doc.text(`EMITIDO EM: ${new Date().toLocaleDateString('pt-BR')}`, 15, 33);
    doc.setDrawColor(...verdeEsmeralda);
    doc.setLineWidth(1.5);
    doc.line(0, 40, 210, 40);

    let yPos = 50;
    const turnos = Object.entries(rankingPorTurno);
    
    // Processamento de 2 em 2 turnos para colunas
    for (let i = 0; i < turnos.length; i += 2) {
      const tEsquerda = turnos[i];
      const tDireita = turnos[i + 1];

      let finalYEsquerda = yPos;
      let finalYDireita = yPos;

      // LADO ESQUERDO
      doc.setTextColor(...azulMarinho);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`TURNO: ${tEsquerda[0]}`, 15, yPos);

      autoTable(doc, {
        startY: yPos + 4,
        margin: { left: 15, right: 110 },
        head: [['POS', 'MOTORISTA', 'TOTAL']],
        body: tEsquerda[1].map((m, idx) => [`${idx + 1}º`, m.nome, m.total]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: azulMarinho },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0 && data.row.index === 0) {
            data.cell.styles.fillColor = [254, 249, 195];
          }
        }
      });
      finalYEsquerda = doc.lastAutoTable.finalY;

      // LADO DIREITO
      if (tDireita) {
        doc.text(`TURNO: ${tDireita[0]}`, 110, yPos);
        autoTable(doc, {
          startY: yPos + 4,
          margin: { left: 110, right: 15 },
          head: [['POS', 'MOTORISTA', 'TOTAL']],
          body: tDireita[1].map((m, idx) => [`${idx + 1}º`, m.nome, m.total]),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [71, 85, 105] },
          columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' } }
        });
        finalYDireita = doc.lastAutoTable.finalY;
      }

      // O novo Y será o maior valor entre as duas tabelas desenhadas
      yPos = Math.max(finalYEsquerda, finalYDireita) + 15;

      // Verificação de quebra de página
      if (yPos > 260 && i + 2 < turnos.length) {
        doc.addPage();
        yPos = 20;
      }
    }

    doc.save(`Ranking_Frota_${filtroMes}.pdf`);
  };

  const renderizarPodio = (posicao) => {
    if (posicao === 0) return <div className="bg-yellow-100 text-yellow-600 p-2 rounded-full shadow-sm"><Trophy size={20} /></div>;
    if (posicao === 1) return <div className="bg-slate-200 text-slate-500 p-2 rounded-full shadow-sm"><Medal size={20} /></div>;
    if (posicao === 2) return <div className="bg-amber-100 text-amber-700 p-2 rounded-full shadow-sm"><Award size={20} /></div>;
    return <div className="bg-slate-50 text-slate-400 p-2 rounded-full font-black text-sm w-[36px] h-[36px] flex items-center justify-center border border-slate-200">{posicao + 1}º</div>;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-6 shadow-lg flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="hover:bg-white/20 p-2 rounded-full transition backdrop-blur-sm bg-white/10"><ChevronLeft size={24} /></button>
          <div>
            <h1 className="font-black text-2xl tracking-tight uppercase flex items-center gap-2"><Truck size={24} /> Transporte Frota</h1>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mt-1">Ranking Total da Operação</p>
          </div>
        </div>
        <button onClick={exportarPDF} className="bg-white text-[#0f4c81] px-5 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all">
          <FileDown size={18} /> Exportar PDF
        </button>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3 text-[#0f4c81] font-black uppercase tracking-widest text-sm px-2"><Filter size={18} /> Filtros Dinâmicos</div>
          <div className="flex flex-wrap gap-4 flex-1 justify-end">
            <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 p-1 px-3">
              <Calendar size={16} className="text-[#0f4c81] mr-2" />
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="bg-transparent font-bold text-[#0f4c81] text-sm outline-none py-2 uppercase cursor-pointer">
                <option value="TODOS">Todos os Meses</option>
                {opcoesFiltros.meses.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200 p-1 px-3">
              <Package size={16} className="text-[#0f4c81] mr-2" />
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="bg-transparent font-bold text-[#0f4c81] text-sm outline-none py-2 uppercase cursor-pointer">
                <option value="TODOS">Todos os Tipos</option>
                {opcoesFiltros.tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#10b981]"></div></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries(rankingPorTurno).map(([turno, motoristasRankeados]) => (
                <div key={turno} className="bg-white rounded-[2rem] shadow-md border border-slate-100 overflow-hidden flex flex-col">
                  <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="font-black text-lg text-[#0f4c81] uppercase tracking-widest flex items-center gap-2"><Clock size={20} className="text-[#10b981]" /> {turno}</h2>
                    <span className="bg-[#10b981]/10 text-[#10b981] font-black text-xs px-3 py-1 rounded-full uppercase">{motoristasRankeados.length} Motoristas</span>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto max-h-[500px] space-y-3 custom-scrollbar">
                    {motoristasRankeados.map((mot, index) => {
                      const isExtra = filtroTipo === 'EXTRA';
                      let estiloCard = {};
                      let classesCard = "flex items-center justify-between p-4 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-md ";
                      let corDoNumero = '';

                      if (isExtra) {
                        const minTrips = motoristasRankeados[0].total;
                        const maxTrips = motoristasRankeados[motoristasRankeados.length - 1].total;
                        const range = maxTrips - minTrips;
                        const ratio = range === 0 ? 0 : (mot.total - minTrips) / range;
                        const hue = 120 - (ratio * 120);
                        estiloCard = { background: `linear-gradient(to right, hsla(${hue}, 85%, 96%, 1), white)`, borderColor: `hsla(${hue}, 80%, 85%, 1)`, borderWidth: '1px', borderStyle: 'solid' };
                        corDoNumero = `hsl(${hue}, 75%, 45%)`;
                      } else {
                        if (index === 0) classesCard += 'bg-gradient-to-r from-yellow-50 to-white border border-yellow-200';
                        else if (index === 1) classesCard += 'bg-gradient-to-r from-slate-50 to-white border border-slate-200';
                        else if (index === 2) classesCard += 'bg-gradient-to-r from-amber-50 to-white border border-amber-200';
                        else classesCard += 'bg-white border border-slate-100 hover:border-[#10b981]/30';
                        corDoNumero = index < 3 ? '#10b981' : '#475569';
                      }

                      return (
                        <div key={index} className={classesCard} style={estiloCard}>
                          <div className="flex items-center gap-4">
                            {renderizarPodio(index)}
                            <div>
                              <p className={`font-black uppercase text-sm ${index === 0 && !isExtra ? 'text-yellow-700' : 'text-[#0f4c81]'}`}>{mot.nome}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Motorista</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-2xl" style={{ color: corDoNumero }}>{mot.total}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{isExtra ? 'Extras' : 'Viagens'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default TransporteFrota;
