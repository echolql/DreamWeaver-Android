import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Library, PlusCircle, Star, Moon, Wand2, CreditCard } from 'lucide-react';
import { UserCredits } from '../services/paymentsService';

interface HomeViewProps {
  onStart: () => void;
  onViewLibrary: () => void;
  credits: UserCredits | null;
  onShowPaywall: () => void;
}

export function HomeView({ onStart, onViewLibrary, credits, onShowPaywall }: HomeViewProps) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative mb-12"
      >
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-gold/10 blur-3xl rounded-full animate-pulse" />
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-indigo-deep/30 blur-3xl rounded-full animate-pulse" />
        
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <Wand2 className="w-32 h-32 text-gold mx-auto mb-6 drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
          <motion.div
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="absolute -top-4 -right-4"
          >
            <Sparkles className="w-8 h-8 text-gold-light" />
          </motion.div>
          <motion.div
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
            className="absolute top-10 -left-6"
          >
            <Star className="w-6 h-6 text-gold/60" />
          </motion.div>
        </motion.div>
        
        <p className="text-xl md:text-2xl text-gold-light/80 max-w-2xl mx-auto italic magical-text">
          Unleash your imagination and create custom stories brought to life by AI.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <motion.button
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="group relative overflow-hidden bg-indigo-deep/40 border border-gold/20 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 transition-all"
        >
          <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <PlusCircle className="w-12 h-12 text-gold relative z-10" />
          <div className="relative z-10">
            <h3 className="text-2xl font-bubblegum text-gold mb-2">Create a Story</h3>
            <p className="text-gold-light/60 text-sm font-medium">Weave a new magical tale from your imagination</p>
          </div>
          <Star className="absolute top-4 right-4 w-6 h-6 text-gold/10 animate-spin-slow" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={onViewLibrary}
          className="group relative overflow-hidden bg-indigo-deep/40 border border-gold/20 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 transition-all"
        >
          <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Library className="w-12 h-12 text-gold relative z-10" />
          <div className="relative z-10">
            <h3 className="text-2xl font-bubblegum text-gold mb-2">Story Library</h3>
            <p className="text-gold-light/60 text-sm font-medium">Revisit your favorite adventures</p>
          </div>
          <Moon className="absolute top-4 right-4 w-6 h-6 text-gold/10 animate-pulse" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05, y: -5 }}
          whileTap={{ scale: 0.95 }}
          onClick={onShowPaywall}
          className="group relative overflow-hidden bg-indigo-deep/40 border border-gold/20 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 transition-all"
        >
          <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CreditCard className="w-12 h-12 text-gold relative z-10" />
          <div className="relative z-10">
            <h3 className="text-2xl font-bubblegum text-gold mb-2">Balance & Plan Options</h3>
            <p className="text-gold-light/60 text-sm font-medium">View magic plans and pricing</p>
          </div>
          <Sparkles className="absolute top-4 right-4 w-6 h-6 text-gold/10 animate-pulse" />
        </motion.button>
      </div>

      {/* Removed bottom icons */}
    </div>
  );
}
