import React, { useState, useEffect, useMemo } from 'react';
import { supabaseFrota } from '../services/supabaseFrota-config'; 
import { useNavigate } from 'react-router-dom';
import { 
  Award as Trophy, Truck, Calendar, Filter, ChevronLeft, 
  Star as Medal, Package, Clock, Award, FileDown, X
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

  const hslToRgb = (h, s, l) => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color);
    };
    return [f(0), f(8), f(4)];
  };

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
    
    for (let i = 0; i < turnos.length; i += 2) {
      const tEsquerda = turnos[i];
      const tDireita = turnos[i + 1];
      let finalYEsquerda = yPos;
      let finalYDireita = yPos;

      const minE = Math.min(...tEsquerda[1].map(m => m.total));
      const maxE = Math.max(...tEsquerda[1].map(m => m.total));
      const rangeE = maxE - minE;

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
          if (data.section === 'body') {
            const total = data.row.raw[2];
            if (filtroTipo === 'EXTRA') {
              const ratio = rangeE === 0 ? 0 : (total - minE) / rangeE;
              const hue = 120 - (ratio * 120);
              const bgColor = hslToRgb(hue, 85, 96);
              const txtColor = hslToRgb(hue, 75, 45);
              data.cell.styles.fillColor = bgColor;
              data.cell.styles.textColor = txtColor;
            } else if (data.column.index === 0 && data.row.index === 0) {
              data.cell.styles.fillColor = [254, 249, 195];
            }
          }
        }
      });
      finalYEsquerda = doc.lastAutoTable.finalY;

      if (tDireita) {
        const minD = Math.min(...tDireita[1].map(m => m.total));
        const maxD = Math.max(...tDireita[1].map(m => m.total));
        const rangeD = maxD - minD;
        doc.setTextColor(...azulMarinho);
        doc.text(`TURNO: ${tDireita[0]}`, 110, yPos);
        autoTable(doc, {
          startY: yPos + 4,
          margin: { left: 110, right: 15 },
          head: [['POS', 'MOTORISTA', 'TOTAL']],
          body: tDireita[1].map((m, idx) => [`${idx + 1}º`, m.nome, m.total]),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [71, 85, 105] },
          columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' } },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const total = data.row.raw[2];
              if (filtroTipo === 'EXTRA') {
                const ratio = rangeD === 0 ? 0 : (total - minD) / rangeD;
                const hue = 120 - (ratio * 120);
                const bgColor = hslToRgb(hue, 85, 96);
                const txtColor = hslToRgb(hue, 75, 45);
                data.cell.styles.fillColor = bgColor;
                data.cell.styles.textColor = txtColor;
              }
            }
          }
        });
        finalYDireita = doc.lastAutoTable.finalY;
      }
      yPos = Math.max(finalYEsquerda, finalYDireita) + 15;
      if (yPos > 260 && i + 2 < turnos.length) {
        doc.addPage();
        yPos = 20;
      }
    }
    doc.save(`Ranking_Frota_${filtroMes}_${filtroTipo}.pdf`);
  };

  const renderizarPodio = (posicao) => {
    if (posicao === 0) return <div className="bg-yellow-100 text-yellow-600 p-1.5 md:p-2 rounded-full shadow-sm"><Trophy size={18} className="md:w-5 md:h-5" /></div>;
    if (posicao === 1) return <div className="bg-slate-200 text-slate-500 p-1.5 md:p-2 rounded-full shadow-sm"><Medal size={18} className="md:w-5 md:h-5" /></div>;
    if (posicao === 2) return <div className="bg-amber-100 text-amber-700 p-1.5 md:p-2 rounded-full shadow-sm"><Award size={18} className="md:w-5 md:h-5" /></div>;
    return <div className="bg-slate-50 text-slate-400 p-2 rounded-full font-black text-[10px] md:text-sm w-8 h-8 md:w-9 md:h-9 flex items-center justify-center border border-slate-200">{posicao + 1}º</div>;
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans relative overflow-x-hidden">
      {/* HEADER RESPONSIVO */}
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-4 md:p-6 shadow-lg flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={() => navigate('/')} className="hover:bg-white/20 p-2 rounded-full transition backdrop-blur-sm bg-white/10"><ChevronLeft size={22} className="md:w-6 md:h-6" /></button>
          <div>
            <h1 className="font-black text-base md:text-2xl tracking-tight uppercase flex items-center gap-2 leading-tight"><Truck size={20} className="md:w-6 md:h-6" /> Ranking Frota</h1>
            <p className="hidden sm:block text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">Ranking Total da Operação</p>
          </div>
        </div>
        <button onClick={exportarPDF} className="bg-white text-[#0f4c81] p-2.5 md:px-5 md:py-2.5 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all">
          <FileDown size={18} /> <span className="hidden sm:inline">Exportar PDF</span>
        </button>
      </header>

      <main className="p-3 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* FILTROS RESPONSIVOS */}
        <div className="bg-white p-3 md:p-4 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 text-[#0f4c81] font-black uppercase tracking-widest text-[10px] md:text-sm px-2 w-full md:w-auto">
            <Filter size={16} /> Filtros Operacionais
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:flex-1 md:justify-end">
            <div className="flex items-center bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200 p-1 px-3 flex-1 sm:flex-none">
              <Calendar size={14} className="text-[#0f4c81] mr-2" />
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="bg-transparent font-bold text-[#0f4c81] text-xs md:text-sm outline-none py-2 uppercase cursor-pointer w-full">
                <option value="TODOS">Todos os Meses</option>
                {opcoesFiltros.meses.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center bg-slate-50 rounded-xl md:rounded-2xl border border-slate-200 p-1 px-3 flex-1 sm:flex-none">
              <Package size={14} className="text-[#0f4c81] mr-2" />
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="bg-transparent font-bold text-[#0f4c81] text-xs md:text-sm outline-none py-2 uppercase cursor-pointer w-full">
                <option value="TODOS">Todos os Tipos</option>
                {opcoesFiltros.tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#10b981]"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {Object.entries(rankingPorTurno).map(([turno, motoristasRankeados]) => (
                <div key={turno} className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-md border border-slate-100 overflow-hidden flex flex-col">
                  <div className="bg-slate-50 p-4 md:p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="font-black text-sm md:text-lg text-[#0f4c81] uppercase tracking-widest flex items-center gap-2"><Clock size={18} className="text-[#10b981]" /> {turno}</h2>
                    <span className="bg-[#10b981]/10 text-[#10b981] font-black text-[9px] md:text-xs px-2 md:px-3 py-1 rounded-full uppercase">{motoristasRankeados.length} Mot.</span>
                  </div>
                  <div className="p-3 md:p-4 flex-1 overflow-y-auto max-h-[400px] md:max-h-[500px] space-y-2 md:space-y-3 custom-scrollbar">
                    {motoristasRankeados.map((mot, index) => {
                      const isExtra = filtroTipo === 'EXTRA';
                      let estiloCard = {};
                      let classesCard = "flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 active:scale-95 md:hover:-translate-y-1 md:hover:shadow-md ";
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
                        else classesCard += 'bg-white border border-slate-100';
                        corDoNumero = index < 3 ? '#10b981' : '#475569';
                      }

                      return (
                        <div key={index} className={classesCard} style={estiloCard}>
                          <div className="flex items-center gap-3 md:gap-4 flex-1 truncate">
                            {renderizarPodio(index)}
                            <div className="truncate">
                              <p className={`font-black uppercase text-xs md:text-sm truncate ${index === 0 && !isExtra ? 'text-yellow-700' : 'text-[#0f4c81]'}`}>{mot.nome}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Motorista</p>
                            </div>
                          </div>
                          <div className="text-right ml-2">
                            <p className="font-black text-xl md:text-2xl leading-none" style={{ color: corDoNumero }}>{mot.total}</p>
                            <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{isExtra ? 'Extras' : 'Viagens'}</p>
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        
        @media (max-width: 640px) {
          main { padding-bottom: 5rem; }
        }
      `}</style>
    </div>
  );
};

export default TransporteFrota;
