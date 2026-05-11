import React, { useState } from 'react';
import { auth, googleProvider } from '../services/firebase-config';
import { signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);

  const fazerLoginComGoogle = async () => {
    setCarregando(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // Se der certo, joga pro Hub!
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      alert("Falha ao autenticar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#030712] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* AURAS DE FUNDO (Igual ao Hub) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#0f4c81]/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#10b981]/15 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="z-10 bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-10 md:p-14 rounded-[2.5rem] shadow-2xl flex flex-col items-center text-center max-w-md w-full animate-fade-in">
        
        <div className="bg-gradient-to-br from-[#0f4c81]/30 to-[#10b981]/30 p-5 rounded-3xl mb-6 shadow-inner border border-white/5">
          <ShieldCheck size={48} className="text-[#10b981]" />
        </div>

        <h1 className="text-3xl font-black text-white tracking-tighter mb-2">
          Acesso <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0f4c81] to-[#10b981]">Restrito</span>
        </h1>
        <p className="text-slate-400 text-sm mb-10 font-bold uppercase tracking-widest opacity-80">
          Equipe Manutenção de Equipamentos
        </p>

        <button 
          onClick={fazerLoginComGoogle}
          disabled={carregando}
          className="w-full relative group overflow-hidden rounded-2xl bg-white text-[#030712] font-black uppercase tracking-widest text-sm py-4 px-6 flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          {carregando ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#030712]"></div>
          ) : (
            <>
              {/* Ícone clássico do Google (SVG) */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </>
          )}
        </button>
      </div>
      
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default Login;