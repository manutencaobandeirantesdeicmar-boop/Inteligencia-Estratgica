import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, Wrench, CalendarClock, BarChart3, 
  Settings, LogOut, Trophy, ShieldCheck 
} from 'lucide-react';
import { auth } from '../services/firebase-config';
import { signOut } from 'firebase/auth';

const HubInicial = () => {
  const navigate = useNavigate();

  const modulos = [
    { 
      id: 'status', 
      titulo: 'Status Diário', 
      desc: 'Relação de Equipamento e Status', 
      icon: <Truck size={32} />, 
      active: true, 
      path: '/status',
      posicao: 'md:col-start-1 md:row-start-1 md:justify-self-end'
    },
    { 
      id: 'manutencao', 
      titulo: 'Manutenção', 
      desc: 'Ordens e Planos', 
      icon: <Wrench size={32} />, 
      active: false,
      posicao: 'md:col-start-10 md:row-start-1 md:justify-self-start'
    },
    { 
      id: 'programacao', 
      titulo: 'Programação', 
      desc: 'Dimensionamento', 
      icon: <CalendarClock size={32} />, 
      active: true,
      path: '/Programacao',
      posicao: 'md:col-start-1 md:row-start-2 md:justify-self-end'
    },
    { 
      id: 'indicadores', 
      titulo: 'Indicadores', 
      desc: 'Performance & BI', 
      icon: <BarChart3 size={32} />, 
      active: false,
      posicao: 'md:col-start-10 md:row-start-2 md:justify-self-start'
    },
    { 
      id: 'frota', 
      titulo: 'Transporte Frota', 
      desc: 'Ranking Operacional', 
      icon: <Trophy size={32} />, 
      active: true,
      path: '/TransporteFrota',
      posicao: 'md:col-start-1 md:row-start-3 md:justify-self-end'
    },
    { 
      id: 'seguranca', 
      titulo: 'Segurança', 
      desc: 'Controle de Acesso', 
      icon: <ShieldCheck size={32} />, 
      active: false,
      posicao: 'md:col-start-10 md:row-start-3 md:justify-self-start'
    },
  ];

  // Função de Logout corrigida
  const fazerLogout = () => {
    signOut(auth).then(() => {
      navigate('/login');
    }).catch((error) => {
      console.error("Erro ao encerrar sessão:", error);
    });
  };

  return (
    <div className="min-h-screen w-full bg-[#030712] flex flex-col items-center p-6 md:p-12 relative overflow-hidden">
      
      {/* AURAS DE FUNDO */}
      <div className="absolute top-[-10%] left-[-10%] w-[700px] h-[700px] bg-[#0f4c81]/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-[#10b981]/15 rounded-full blur-[120px] pointer-events-none"></div>

      {/* HEADER */}
      <header className="z-10 flex flex-col items-center mb-8 md:mb-14 animate-fade-in text-center">
        <div className="h-16 md:h-24 mb-6">
          <img 
            src="https://i.ibb.co/Y4jjxnVb/08f3d902-e667-4927-8741-c47dfe39329b.png" 
            alt="Logo Deicmar" 
            className="h-full object-contain filter brightness-125 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          />
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-none">
          Inteligência <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0f4c81] to-[#10b981]">Estratégica</span>
        </h1>
      </header>

      {/* GRID CENTRAL */}
      <main className="z-10 w-full max-w-[1600px] flex-grow flex items-center justify-center">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-6 md:gap-y-12 items-center w-full">
          
          <div className="col-span-2 md:col-span-6 md:col-start-4 md:row-start-1 md:row-span-3 flex justify-center order-1 md:order-2 relative px-4">
             <div className="absolute inset-0 bg-[#0f4c81]/30 rounded-full blur-[80px] scale-125 opacity-30 animate-pulse"></div>
             <img 
                src="https://i.ibb.co/Kxx70spx/8e65be83-2509-4c60-8a6c-e01c71b8b8e1.png" 
                alt="Operação Central" 
                className="relative z-10 w-64 md:w-full md:max-w-[550px] object-contain animate-float filter drop-shadow-[0_30px_60px_rgba(0,0,0,0.7)]"
             />
          </div>

          {modulos.map((m, index) => (
            <button
              key={m.id}
              onClick={() => m.active ? navigate(m.path) : null}
              className={`
                col-span-1 md:col-span-3
                ${m.posicao}
                ${index < 2 ? 'order-2' : 'order-3'}
                group relative w-full p-6 md:p-10 rounded-[2.5rem] transition-all duration-500
                flex flex-col items-center text-center gap-4 border
                ${m.active 
                  ? 'bg-white/[0.03] backdrop-blur-2xl border-white/10 hover:border-[#10b981]/50 hover:bg-white/[0.08] shadow-2xl' 
                  : 'bg-black/40 border-white/5 opacity-40 grayscale cursor-not-allowed'}
              `}
            >
              <div className={`p-5 rounded-2xl transition-all duration-500
                ${m.active ? 'bg-gradient-to-br from-[#0f4c81]/20 to-[#10b981]/20 text-[#10b981] group-hover:scale-110 group-hover:text-white group-hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'text-slate-600'}`}>
                {React.cloneElement(m.icon, { size: 36 })}
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base md:text-2xl font-bold text-white group-hover:text-[#10b981] transition-colors leading-tight">
                  {m.titulo}
                </h3>
                <p className="hidden md:block text-[11px] text-slate-500 font-black uppercase tracking-[0.15em] opacity-70">
                  {m.desc}
                </p>
              </div>

              {!m.active && (
                <span className="absolute top-4 right-6 text-[8px] font-black bg-white/5 text-slate-500 px-2 py-1 rounded-full uppercase">Breve</span>
              )}
            </button>
          ))}

        </div>
      </main>

      {/* RODAPÉ COM LOGOUT FUNCIONAL */}
      <footer className="z-10 mt-12 w-full flex flex-row justify-center gap-12 text-slate-500 font-black text-[10px] tracking-[0.4em] uppercase opacity-60">
        <button className="hover:text-[#0f4c81] transition-all flex items-center gap-2 group">
          <Settings size={16} className="group-hover:rotate-90 transition-transform duration-500" /> <span>Configurações</span>
        </button>
        
        {/* CONECTADO: Agora o botão chama a função fazerLogout */}
        <button 
          onClick={fazerLogout} 
          className="hover:text-red-500 transition-all flex items-center gap-2 group"
        >
          <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          <span>Encerrar</span>
        </button>
      </footer>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>

    </div>
  );
};

export default HubInicial;