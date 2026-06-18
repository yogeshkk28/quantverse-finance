import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Mail, Lock, TrendingUp } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await (isLogin ? signIn : signUp)(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="blob-1" /><div className="blob-2" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 w-full max-w-md relative z-10 mx-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="w-7 h-7 text-accent-orange" />
            <h1 className="text-3xl font-extrabold"><span className="text-gradient-orange">Q</span>uantVerse</h1>
          </div>
          <p className="text-white/30 text-sm">Quantitative Finance Dashboard</p>
        </div>
        <h2 className="text-lg font-extrabold text-center mb-6">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" /><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/8 rounded-xl pl-11 pr-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-orange/40 transition" required /></div>
          <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" /><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/8 rounded-xl pl-11 pr-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-orange/40 transition" required minLength={6} /></div>
          {error && <p className="text-loss text-xs text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-gradient-orange text-white font-bold py-3 rounded-xl hover:opacity-90 transition disabled:opacity-40">{loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}</button>
        </form>
        <p className="text-center text-white/25 text-xs mt-6">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-accent-orange hover:underline">{isLogin ? 'Sign Up' : 'Sign In'}</button>
        </p>
      </motion.div>
    </div>
  );
}
