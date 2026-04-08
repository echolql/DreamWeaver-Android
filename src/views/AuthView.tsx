import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Sparkles, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react';
import { cn } from '../lib/utils';

export function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email,
          displayName,
          createdAt: Date.now(),
        });
      }
    } catch (err: any) {
      setError('Username or password is wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center p-4 font-cormorant">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-indigo-deep/20 backdrop-blur-xl p-8 rounded-3xl border border-gold/20 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Sparkles className="w-16 h-16 text-gold mb-4" />
          </motion.div>
          <h1 className="text-4xl font-bubblegum text-gold tracking-tight mb-2">DreamWeaver</h1>
          <p className="text-gold-light/60 text-center italic">"Where Every Night is a New Adventure"</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-light/40" />
              <input
                type="text"
                placeholder="Your Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-midnight/50 border border-gold/10 rounded-xl py-3 pl-10 pr-4 focus:border-gold/50 outline-none transition-all text-gold-light"
                required
              />
            </div>
          )}
          
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-light/40" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-midnight/50 border border-gold/10 rounded-xl py-3 pl-10 pr-4 focus:border-gold/50 outline-none transition-all text-gold-light"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-light/40" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-midnight/50 border border-gold/10 rounded-xl py-3 pl-10 pr-4 focus:border-gold/50 outline-none transition-all text-gold-light"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-gold-light text-midnight font-bold text-xl py-3 rounded-xl transition-all shadow-lg shadow-gold/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <Sparkles className="w-5 h-5" />
              </motion.div>
            ) : (
              <>
                {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                {isLogin ? 'Enter the Dream' : 'Begin Your Journey'}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-4">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-gold-light/60 hover:text-gold text-sm transition-colors text-center"
          >
            {isLogin ? "New here? Sign up for your first 5 stories free!" : "Already have an account? Log in"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
