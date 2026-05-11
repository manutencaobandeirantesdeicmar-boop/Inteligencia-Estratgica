import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// ⚠️ Substitua com os dados do seu painel do Firebase > Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyCHzHb6DD9VwAMNpo93RBUx_K5pr7Ky8zE",
  authDomain: "status-diario-a6b80.firebaseapp.com",
  projectId: "status-diario-a6b80",
  storageBucket: "status-diario-a6b80.firebasestorage.app",
  messagingSenderId: "341269307650",
  appId: "1:341269307650:web:8ad50a7bd531695e01e21b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Força o Google a pedir a conta caso o usuário tenha mais de uma logada
googleProvider.setCustomParameters({
  prompt: 'select_account'
});