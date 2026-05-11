import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './services/firebase-config'; 
import { onAuthStateChanged } from 'firebase/auth';

import Login from './pages/Login';
import HubInicial from './pages/HubInicial';
import StatusDiario from './pages/StatusDiario';
import Programacao from './pages/Programacao'; 
import TransporteFrota from './pages/TransporteFrota';

// --- COMPONENTE DE ROTA PRIVADA ---
// Se não tiver usuário, joga para a tela de Login
const RotaPrivada = ({ children, usuario }) => {
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);

  // Fica escutando para ver se o Google já logou o usuário em background
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCarregandoAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Mostra tela preta de loading enquanto o Firebase verifica a sessão
  if (carregandoAuth) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#10b981]"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ROTA PÚBLICA */}
        <Route path="/login" element={<Login />} />
        
        {/* ROTAS PRIVADAS (Envolvidas pelo nosso componente de segurança) */}
        <Route path="/" element={<RotaPrivada usuario={usuario}><HubInicial /></RotaPrivada>} />
        <Route path="/status" element={<RotaPrivada usuario={usuario}><StatusDiario /></RotaPrivada>} />
        <Route path="/programacao" element={<RotaPrivada usuario={usuario}><Programacao /></RotaPrivada>} />
        <Route path="/TransporteFrota" element={<RotaPrivada usuario={usuario}><TransporteFrota /></RotaPrivada>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;