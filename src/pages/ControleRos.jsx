import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, BarChart2, TrendingUp, AlertCircle, FileWarning, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase-config'; // Sua conexão com o banco
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ControleRos = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ros, setRos] = useState([]);

  // ==============================
  // FETCH DE DADOS DO SUPABASE
  // ==============================
  const fetchControleRos = async () => {
    setLoading(true);
    // Busca todos os registros ordenados pela data de ocorrência
    const { data, error } = await supabase
      .from('controle_ros')
      .select('*')
      .order('data_ocorrencia', { ascending: false });

    if (!error && data) {
      setRos(data);
    } else {
      console.error("Erro ao buscar ROs:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchControleRos();
  }, []);

  // ==============================
  // PROCESSAMENTO DOS KPIs E GRÁFICOS
  // ==============================
  
  // 1. Total de ROs
  const totalRos = ros.length;

  // 2. Custo Total de Avarias
  const custoTotal = ros.reduce((acc, curr) => acc + (Number(curr.custo_avaria) || 0), 0);
  const custoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(custoTotal);

  // 3. Status (Quantos em aberto vs Finalizados) - Supondo que exista um status 'ABERTO'
  const rosAbertas = ros.filter(r => r.status && r.status.toUpperCase() !== 'FINALIZADO').length;

  // 4. Dados para o Gráfico Mensal
  const dadosGraficoMensal = ros.reduce((acc, curr) => {
    if (curr.mes) {
      const mesAbrev = curr.mes.substring(0, 3).toUpperCase();
      const itemExistente = acc.find(item => item.name === mesAbrev);
      if (itemExistente) {
        itemExistente.Ocorrencias += 1;
      } else {
        acc.push({ name: mesAbrev, Ocorrencias: 1 });
      }
    }
    return acc;
  }, []).reverse(); // Inverte para ordem cronológica dependendo de como vêm do banco

  // 5. Ranking de Caminhões/Equipamentos (Top 5 com mais problemas)
  const contagemEquipamentos = ros.reduce((acc, curr) => {
    if (curr.equipamento) {
      acc[curr.equipamento] = (acc[curr.equipamento] || 0) + 1;
    }
    return acc;
  }, {});
  
  const rankingEquipamentos = Object.entries(contagemEquipamentos)
    .map(([equipamento, quantidade]) => ({ equipamento, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5); // Pega apenas os 5 piores

  return (
    <div className="min-h-screen w-full bg-[#030712] text-white p-6 md:p-8 relative overflow-hidden font-sans">
       {/* Auras de fundo */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#0f4c81]/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#10b981]/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* HEADER */}
      <header className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
        <div>
          <button onClick={() => navigate('/transporte-hub')} className="flex items-center gap-2 text-slate-400 hover:text-[#10b981] transition-colors text-xs font-black tracking-widest mb-3">
            <ArrowLeft size={16} /> VOLTAR AO HUB
          </button>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3">
            <FileWarning className="text-[#10b981]" size={36} />
            Dashboard de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0f4c81] to-[#10b981]">ROs</span>
          </h1>
          <p className="text-slate-500 text-sm font-bold mt-1 uppercase tracking-wider">Gestão e Relatórios de Ocorrência</p>
        </div>
        
        <button className="flex items-center gap-2 bg-gradient-to-r from-[#10b981] to-[#0e9f6e] hover:brightness-110 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
          <Plus size={20} />
          Registrar Nova RO
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-[#10b981] z-10 relative">
           <Loader2 size={48} className="animate-spin mb-4" />
           <p className="font-bold tracking-widest uppercase text-sm">Carregando Base de Dados...</p>
        </div>
      ) : (
        <>
          {/* GRID DE KPIS */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in">
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#0f4c81]/20 rounded-bl-full blur-2xl group-hover:bg-[#0f4c81]/40 transition-colors"></div>
              <div className="flex justify-between items-center mb-2 relative z-10">
                 <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Total Registrado</h3>
                 <FileWarning size={20} className="text-[#0f4c81]" />
              </div>
              <p className="text-4xl md:text-5xl font-black relative z-10">{totalRos}</p>
            </div>
            
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full blur-2xl group-hover:bg-red-500/20 transition-colors"></div>
              <div className="flex justify-between items-center mb-2 relative z-10">
                 <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Custo Total (Avarias)</h3>
                 <TrendingUp size={20} className="text-red-500" />
              </div>
              <p className="text-3xl md:text-4xl font-black text-white relative z-10">{custoFormatado}</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full blur-2xl group-hover:bg-amber-500/20 transition-colors"></div>
              <div className="flex justify-between items-center mb-2 relative z-10">
                 <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">ROs Pendentes</h3>
                 <AlertCircle size={20} className="text-amber-500" />
              </div>
              <p className="text-4xl md:text-5xl font-black relative z-10">{rosAbertas}</p>
            </div>
          </div>

          {/* ÁREA DE GRÁFICOS E RANKING */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            
            {/* Gráfico Comparativo Mensal */}
            <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col min-h-[400px]">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
                 <BarChart2 className="text-[#10b981]"/> Histórico Mensal de Ocorrências
               </h3>
               
               <div className="flex-grow w-full h-full">
                 {dadosGraficoMensal.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={dadosGraficoMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                       <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                       <Tooltip 
                         cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                         contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                       />
                       <Bar dataKey="Ocorrencias" radius={[6, 6, 0, 0]}>
                         {dadosGraficoMensal.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === dadosGraficoMensal.length - 1 ? '#10b981' : '#0f4c81'} />
                         ))}
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold text-sm">Sem dados suficientes para o gráfico</div>
                 )}
               </div>
            </div>

            {/* Ranking de Caminhões */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md shadow-lg flex flex-col min-h-[400px]">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-2">
                 <AlertCircle className="text-red-500"/> Ranking de Avarias
               </h3>
               
               <div className="flex-grow flex flex-col gap-3">
                 {rankingEquipamentos.length > 0 ? rankingEquipamentos.map((item, index) => (
                   <div key={item.equipamento} className="flex items-center justify-between bg-white/[0.03] border border-white/5 p-4 rounded-2xl hover:bg-white/[0.06] transition-colors">
                     <div className="flex items-center gap-4">
                       <span className={`text-lg font-black w-6 text-center ${index === 0 ? 'text-red-500' : index === 1 ? 'text-amber-500' : 'text-slate-500'}`}>
                         {index + 1}º
                       </span>
                       <div>
                         <p className="font-black text-white">{item.equipamento}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase">Placa / Equipamento</p>
                       </div>
                     </div>
                     <div className="bg-white/10 px-3 py-1 rounded-lg text-sm font-black">
                       {item.quantidade} <span className="text-[10px] font-normal text-slate-400">ROs</span>
                     </div>
                   </div>
                 )) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 font-bold text-sm text-center px-4">
                      <FileWarning size={32} className="mb-2 opacity-50"/>
                      Nenhuma ocorrência registrada no sistema
                    </div>
                 )}
               </div>
            </div>
            
          </div>
        </>
      )}

      <style>{`
        @keyframes fade-in { 
          from { opacity: 0; transform: translateY(20px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-fade-in { 
          animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
      `}</style>
    </div>
  );
};

export default ControleRos;
