import React from 'react';
import { ArrowLeft, Plus, BarChart2, TrendingUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ControleRos = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-[#030712] text-white p-6 md:p-8 relative overflow-hidden">
       {/* Auras de fundo */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-[#0f4c81]/10 to-transparent pointer-events-none"></div>

      {/* HEADER */}
      <header className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <button onClick={() => navigate('/transporte-hub')} className="flex items-center gap-2 text-slate-400 hover:text-[#10b981] transition-colors text-sm font-bold tracking-wider mb-2">
            <ArrowLeft size={16} /> VOLTAR
          </button>
          <h1 className="text-3xl font-black tracking-tight">Dashboard de <span className="text-[#10b981]">ROs</span></h1>
          <p className="text-slate-500 text-sm">Relatórios de Ocorrência da Frota</p>
        </div>
        
        <button className="flex items-center gap-2 bg-[#10b981] hover:bg-[#0e9f6e] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <Plus size={20} />
          Registrar Nova RO
        </button>
      </header>

      {/* GRID DE KPIS (Baseado nas colunas custo_avaria, status, etc) */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Exemplo de Card KPI */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-slate-400 text-sm font-bold uppercase">Total Ocorrências (Mês)</h3>
             <AlertCircle size={20} className="text-[#0f4c81]" />
          </div>
          <p className="text-4xl font-black">24</p>
        </div>
        
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-slate-400 text-sm font-bold uppercase">Custo de Avarias</h3>
             <TrendingUp size={20} className="text-red-500" />
          </div>
          <p className="text-4xl font-black">R$ 12.450</p>
        </div>
      </div>

      {/* ÁREA DE GRÁFICOS E RANKING */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Comparativo */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md h-[400px] flex flex-col">
           <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><BarChart2 className="text-[#10b981]"/> Comparativo Anual/Mensal</h3>
           <div className="flex-grow flex items-center justify-center border border-dashed border-white/10 rounded-xl text-slate-600">
             [Área para inserir o Recharts / Chart.js]
           </div>
        </div>

        {/* Ranking de Equipamentos (Baseado na coluna 'equipamento') */}
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 backdrop-blur-md h-[400px] flex flex-col">
           <h3 className="text-lg font-bold mb-4">Ranking: Caminhões com Ocorrências</h3>
           <div className="flex-grow flex items-center justify-center border border-dashed border-white/10 rounded-xl text-slate-600">
             [Tabela / Lista de Ranking]
           </div>
        </div>
      </div>

    </div>
  );
};

export default ControleRos;
