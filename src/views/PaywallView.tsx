import React, { useState, useEffect } from 'react';
import { Sparkles, CreditCard, Loader2, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MAGIC_PACKS, getUserCredits, createCheckoutSession } from '../services/paymentsService';
import { useAuth } from '../AuthProvider';

interface PaywallViewProps {
  onDismiss: () => void;
  onPurchaseSuccess: () => void;
}

export function PaywallView({ onDismiss, onPurchaseSuccess }: PaywallViewProps) {
  const { user } = useAuth();
  const [credits, setCredits] = useState<{ freeStoriesRemaining: number; magicCredits: number; totalStoriesAvailable: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserCredits(user.uid)
      .then(setCredits)
      .catch(() => setError('Could not load credit balance'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleBuy = async (priceId: string) => {
    if (!user) return;
    setPurchasing(priceId);
    setError('');
    try {
      const session = await createCheckoutSession(user.uid, priceId);
      // Open Stripe Checkout in the browser / external browser
      window.location.href = session.url;
      // After redirecting to Stripe, user will come back via deep link.
      // We close the paywall and wait for the deep link to refresh credits.
      onDismiss();
    } catch (err: any) {
      setError(err.message || 'Failed to start purchase');
      setPurchasing(null);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const pricePerStory = (cents: number, stories: number) =>
    `$${(cents / 100 / stories).toFixed(2)}/story`;

  if (!user) return null;

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-gold" />
          <div>
            <h2 className="text-3xl font-bubblegum text-gold">Get More Stories</h2>
            <p className="text-gold-light/60 text-sm">Continue your magical journey</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-2 hover:bg-indigo-deep/50 rounded-full transition-colors text-gold-light/60 hover:text-gold"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Balance Card */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </div>
      ) : credits ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-indigo-deep/30 border border-gold/30 rounded-3xl p-6 mb-8 text-center"
        >
          <p className="text-gold-light/60 text-sm mb-1">Your Balance</p>
          <p className="text-5xl font-bubblegum text-gold">{credits.totalStoriesAvailable}</p>
          <p className="text-gold-light/60 text-sm mt-1">stories remaining</p>
          {(credits.freeStoriesRemaining > 0 || credits.magicCredits > 0) && (
            <p className="text-gold-light/40 text-xs mt-2">
              {credits.freeStoriesRemaining} free + {credits.magicCredits} purchased
            </p>
          )}
        </motion.div>
      ) : null}

      {error && (
        <p className="text-red-400 text-sm bg-red-400/10 p-4 rounded-xl border border-red-400/20 mb-4">
          {error}
        </p>
      )}

      {/* Pack Options */}
      <h3 className="text-xl font-bubblegum text-gold mb-4">Choose a Magic Pack</h3>
      <div className="space-y-4">
        {MAGIC_PACKS.map((pack) => (
          <motion.div
            key={pack.priceId}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="bg-indigo-deep/20 border border-white/10 rounded-2xl p-5 flex items-center justify-between"
          >
            <div>
              <p className="font-bubblegum text-gold text-lg">{pack.name}</p>
              <p className="text-gold-light/60 text-sm">{pack.stories} stories</p>
              <p className="text-gold-light/40 text-xs mt-1">
                {formatPrice(pack.priceCents)} ({pricePerStory(pack.priceCents, pack.stories)})
              </p>
            </div>
            <button
              onClick={() => handleBuy(pack.priceId)}
              disabled={purchasing !== null}
              className="bg-gold hover:bg-gold-light text-midnight font-bubblegum px-6 py-3 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {purchasing === pack.priceId ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Buy
                </>
              )}
            </button>
          </motion.div>
        ))}
      </div>

      <p className="text-center text-gold-light/30 text-xs mt-8">
        🔒 Payments powered by Stripe. Your card details are never stored.
      </p>
    </div>
  );
}
