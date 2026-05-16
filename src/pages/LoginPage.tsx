import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';

export default function LoginPage() {
  const { signIn, loading, user, profile, logout } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration fields
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('Fisioterapeuta');
  const [registry, setRegistry] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  React.useEffect(() => {
    if (user && !profile) {
      setIsLogin(false);
      if (user.email) setEmail(user.email);
      if (user.displayName) setName(user.displayName);
    }
  }, [user, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !user) {
      setErrorMsg("Preencha email e senha.");
      return;
    }
    setErrorMsg('');
    setSubmitLoading(true);

    try {
      if (user && !profile) {
         // Completing Google sign up
        if (!name || !registry || !phone) {
          setErrorMsg("Preencha todos os campos obrigatórios.");
          setSubmitLoading(false);
          return;
        }
        await setDoc(doc(db, 'users', user.uid), {
          name,
          profession,
          professionalRegistry: registry,
          phone,
          status: 'pending',
          role: 'PENDING',
          email: user.email || email,
          uid: user.uid,
          clinics: []
        }, { merge: true });
        
        window.location.reload();
        return;
      }

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name || !registry || !phone) {
          setErrorMsg("Preencha todos os campos obrigatórios.");
          setSubmitLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // Set additional profile fields
        await setDoc(doc(db, 'users', cred.user.uid), {
          name,
          profession,
          professionalRegistry: registry,
          phone,
          status: 'pending',
          role: 'PENDING',
          email,
          uid: cred.user.uid,
          clinics: []
        }, { merge: true });
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrorMsg("E-mail ou senha incorretos.");
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMsg("Este e-mail já está em uso.");
      } else if (error.code === 'auth/operation-not-allowed') {
        setErrorMsg("Este método de login não está ativado. Ative-o em: Firebase Console > Authentication > Sign-in method.");
      } else {
        setErrorMsg(error.message || "Erro de autenticação.");
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-slate-200/50 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 p-8 md:p-12 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-slate-900/20 mb-6 group transition-transform hover:rotate-6">
            EC
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Evoluti Clinic</h1>
          <p className="text-slate-500 font-medium leading-relaxed">
            Gestão clínica inteligente com foco em excelência e rigor terapêutico.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100">
              {errorMsg}
            </div>
          )}

          {!isLogin && (
            <>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm font-medium"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Profissão</label>
                <select 
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm font-medium"
                >
                  <option value="Fisioterapeuta">Fisioterapeuta</option>
                  <option value="Médico(a)">Médico(a)</option>
                  <option value="Fonoaudiólogo(a)">Fonoaudiólogo(a)</option>
                  <option value="Terapeuta Ocupacional">Terapeuta Ocupacional</option>
                  <option value="Psicólogo(a)">Psicólogo(a)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Reg. Profissional</label>
                  <input 
                    type="text" 
                    value={registry}
                    onChange={(e) => setRegistry(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm font-medium"
                    placeholder="Ex: 12345"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Telefone</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm font-medium"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!(user && !profile)}
              className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm font-medium disabled:opacity-50"
              placeholder="seu@email.com"
            />
          </div>
          {(!user || profile) && (
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm font-medium"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitLoading || loading}
            className="w-full h-14 bg-brand-primary hover:brightness-125 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-md shadow-slate-900/20 active:scale-95 disabled:opacity-50 mt-2"
          >
            {submitLoading ? "Aguarde..." : (isLogin ? "Acessar" : "Solicitar Cadastro")}
          </button>
        </form>

        {(!user || profile) && (
          <div className="text-center mb-6">
            <button 
              type="button" 
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-bold text-brand-secondary hover:brightness-110 underline underline-offset-4"
            >
              {isLogin ? "Não tem conta? Solicite cadastro" : "Já tem conta? Fazer login"}
            </button>
          </div>
        )}

        {(!user || profile) ? (
          <div className="space-y-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-100"></span>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase text-slate-400 font-black tracking-widest bg-white px-4">
                OU
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  await signIn();
                } catch (error: any) {
                  console.error(error);
                  if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
                    // Just ignore if the user closed the popup
                  } else if (error.code === 'auth/operation-not-allowed') {
                    setErrorMsg("O login com Google não está ativado no Firebase Console.");
                  } else {
                    setErrorMsg(error.message || "Erro ao entrar com Google.");
                  }
                }
              }}
              disabled={loading || submitLoading}
              className="w-full h-14 bg-white border-2 border-slate-100 hover:border-brand-primary text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              <span>Entrar com Google</span>
            </button>
            
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <ShieldCheck className="w-5 h-5 text-brand-secondary mb-2" />
                <p className="text-[10px] font-bold text-slate-800 uppercase leading-tight">Segurança LGPD</p>
                <p className="text-[10px] text-slate-500 mt-1">Dados criptografados</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <Sparkles className="w-5 h-5 text-brand-primary mb-2" />
                <p className="text-[10px] font-bold text-slate-800 uppercase leading-tight">Multi-Unidade</p>
                <p className="text-[10px] text-slate-500 mt-1">Gestão centralizada</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <button 
              onClick={logout}
              className="text-sm font-bold text-slate-500 hover:text-slate-700 underline underline-offset-4"
            >
              Cancelar e Sair
            </button>
          </div>
        )}

        <footer className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            &copy; 2026 EVOLUTICLINIC INC.
          </p>
        </footer>
      </motion.div>
    </div>
  );
}
