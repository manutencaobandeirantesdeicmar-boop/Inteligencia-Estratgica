import React, { useState, useEffect, useMemo } from 'react';
import { supabaseFrota } from '../services/supabaseFrota-config'; 
import { useNavigate } from 'react-router-dom';
import { 
  Award as Trophy, Truck, Calendar, Filter, ChevronLeft, 
  Star as Medal, Package, Clock, Award, FileDown, Plane, ChevronDown, ChevronUp
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const TransporteFrota = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rankingData, setRankingData] = useState([]);
  const [motoristasBase, setMotoristasBase] = useState([]); 
  const [filtroMes, setFiltroMes] = useState('TODOS');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [opcoesFiltros, setOpcoesFiltros] = useState({ meses: [], tipos: [] });
  const [feriasExpandido, setFeriasExpandido] = useState(false); // Estado para recolher/expandir Férias

  // ... (funções hslToRgb e useEffects de busca seguem iguais)
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
    const fetchMotoristasBase = async () => {
      const { data } = await supabaseFrota.from('motoristas_cadastrados').select('*');
      if (data) setMotoristasBase(data);
    };
    fetchMotoristasBase();
  }, []);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      const { data } = await supabaseFrota.rpc('get_ranking_frota', { p_mes: filtroMes, p_tipo: filtroTipo });
      setRankingData(data || []);
      setLoading(false);
    };
    fetchRanking();
  }, [filtroMes, filtroTipo]);

  const handleToggleFerias = async (motId, isCurrentlyFerias) => {
    const novoStatus = isCurrentlyFerias ? 'ativo' : 'FÉRIAS';
    setMotoristasBase(prev => prev.map(m => m.id === motId ? { ...m, status: novoStatus } : m));
    await supabaseFrota.from('motoristas_cadastrados').update({ status: novoStatus }).eq('id', motId);
  };

  const rankingPorTurno = useMemo(() => {
    const grupos = { 'FÉRIAS': [] };
    motoristasBase.forEach(mot => {
      if (mot.admin === true) return;
      const dadosViagem = rankingData.find(r => r.motorista_nome === mot.motorista);
      const totalViagens = dadosViagem ? dadosViagem.total_viagens : 0;
      const estaDeFerias = mot.status?.toUpperCase() === 'FÉRIAS';
      const obj = { id: mot.id, nome: mot.motorista, total: totalViagens, ferias: estaDeFerias };
      if (estaDeFerias) grupos['FÉRIAS'].push(obj);
      else {
        const turno = mot.Turno || 'NÃO DEFINIDO';
        if (!grupos[turno]) grupos[turno] = [];
        grupos[turno].push(obj);
      }
    });
    return grupos;
  }, [rankingData, motoristasBase]);

  const turnosOrdenadosTela = Object.keys(rankingPorTurno).sort((a, b) => {
    if (a === 'FÉRIAS') return 1;
    return a.localeCompare(b);
  });

  // ... (exportarPDF segue igual)
  const exportarPDF = () => { /* ... mesma lógica anterior ... */ };
  const renderizarPodio = (posicao) => { /* ... mesma lógica anterior ... */ };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-4 md:p-6 shadow-lg flex justify-between items-center sticky top-0 z-30">
        <h1 className="font-black uppercase flex items-center gap-2"><Truck /> Ranking Frota</h1>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {turnosOrdenadosTela.map((turno) => {
            const motoristasRankeados = rankingPorTurno[turno];
            const isFerias = turno === 'FÉRIAS';
            
            if (isFerias && !feriasExpandido) {
              return (
                <div key="ferias-header" onClick={() => setFeriasExpandido(true)} className="bg-orange-50 border border-orange-200 p-4 rounded-2xl cursor-pointer flex justify-between items-center text-orange-700 font-black">
                  <span>{turno} ({motoristasRankeados.length})</span> <ChevronDown />
                </div>
              );
            }

            return (
              <div key={turno} className="bg-white rounded-[2rem] shadow-md border overflow-hidden flex flex-col">
                <div className={`p-6 border-b flex justify-between items-center ${isFerias ? 'bg-orange-50' : 'bg-slate-50'}`}>
                  <h2 className="font-black uppercase flex items-center gap-2">{isFerias ? <Plane /> : <Clock />} {turno}</h2>
                  {isFerias && <button onClick={() => setFeriasExpandido(false)}><ChevronUp /></button>}
                </div>
                
                <div className="p-4 space-y-4">
                  {motoristasRankeados.map((mot) => (
                    <div key={mot.nome} className="bg-slate-50 p-4 rounded-2xl border flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="truncate">
                          <p className="font-black text-[#0f4c81] truncate">{mot.nome}</p>
                          <p className="text-[10px] text-slate-400">Motorista</p>
                        </div>
                        {!isFerias && <p className="font-black text-xl text-[#10b981]">{mot.total}</p>}
                      </div>
                      
                      {/* Botão abaixo do nome */}
                      <button 
                        onClick={() => handleToggleFerias(mot.id, mot.ferias)}
                        className={`w-full py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 ${
                          mot.ferias ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-400'
                        }`}
                      >
                        <Plane size={14} /> {mot.ferias ? 'Retornar ao Trabalho' : 'Marcar Férias'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default TransporteFrota;
