import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, FileWarning, ArrowLeft } from 'lucide-react';

const TransporteHub = () => {
  const navigate = useNavigate();

  const opcoes = [
    {
      id: 'ranking',
      titulo: 'Ranking Operacional',
      desc: 'Performance da Frota',
      icon: <Trophy size={48} />,
      path: '/TransporteFrota'
    },
    {
      id: 'ros',
      titulo: 'Controle de ROs',
      desc: 'Relatórios de Ocorrência',
      icon: <FileWarning size={48} />,
      path: '/controle-ros'
    }
  ];

  return (
    <div className="min-h-screen w-full bg-[#030712] flex flex-col items-center p-6 md:p-12 relative overflow-hidden">
      
      {/* AURAS DE FUNDO */}
      <div className="absolute top-[-10%] left-[-10%] w-[700px] h-[700px] bg-[#0f4c81]/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-[#10b981]/15 rounded-full blur-[120px] pointer-events-none"></div>

      {/* HEADER / BOTÃO VOLTAR */}
      <div className="w-full max-w-[1200px] z-10 flex justify-start mb-8">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-[#10b981] transition-colors font-bold tracking-wider"
        >
          <ArrowLeft size={20} />
          VOLTAR AO HUB INICIAL
        </button>
      </div>

      <header className="z-10 flex flex-col items-center mb-16 animate-fade-in text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none mb-4">
          Módulo de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0f4c81] to-[#10b981]">Transporte</span>
        </h1>
        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-sm">
          Selecione a área de gestão
        </p>
      </header>

      {/* GRID DE OPÇÕES */}
      <main className="z-10 w-full max-w-[900px] flex-grow flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full px-4">
          
          {opcoes.map((opcao) => (
            <button
              key={opcao.id}
              onClick={() => navigate(opcao.path)}
              className="group relative w-full p-10 rounded-[2.5rem] transition-all duration-500 flex flex-col items-center text-center gap-6 border bg-white/[0.03] backdrop-blur-2xl border-white/10 hover:border-[#10b981]/50 hover:bg-white/[0.08] shadow-2xl"
            >
              <div className="p-6 rounded-3xl transition-all duration-500 bg-gradient-to-br from-[#0f4c81]/20 to-[#10b981]/20 text-[#10b981] group-hover:scale-110 group-hover:text-white group-hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                {opcao.icon}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white group-hover:text-[#10b981] transition-colors leading-tight">
                  {opcao.titulo}
                </h3>
                <p className="text-xs text-slate-500 font-black uppercase tracking-[0.15em]">
                  {opcao.desc}
                </p>
              </div>
            </button>
          ))}

        </div>
      </main>
    </div>
  );
};

export default TransporteHub;
