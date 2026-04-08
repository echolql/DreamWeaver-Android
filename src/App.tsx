import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import { AuthView } from './views/AuthView';
import { HomeView } from './views/HomeView';
import { StoryGeneratorView } from './views/StoryGeneratorView';
import { StoryDetailView } from './views/StoryDetailView';
import { LibraryView } from './views/LibraryView';
import { MeView } from './views/MeView';
import { PaywallView } from './views/PaywallView';
import { Story } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Library, PlusCircle, LogOut, User as UserIcon } from 'lucide-react';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import { getCheckoutSession, getUserCredits, UserCredits } from './services/paymentsService';

type View = 'home' | 'generator' | 'library' | 'detail' | 'me';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [credits, setCredits] = useState<UserCredits | null>(null);

  const reloadCredits = (retries = 0) => {
    if (!user) return;
    
    getUserCredits(user.uid)
      .then(newCredits => {
        // Only update if it actually changed, OR it's the first load
        setCredits(prev => {
          if (!prev || newCredits.totalStoriesAvailable !== prev.totalStoriesAvailable) {
            return newCredits;
          }
          return prev;
        });

        // If we're retrying (waiting for a purchase), keep polling
        if (retries > 0) {
          setTimeout(() => reloadCredits(retries - 1), 2000);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    reloadCredits();

    // Refresh credits when user returns to the app (e.g. from Stripe browser)
    const handleFocus = () => reloadCredits();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  // Handle deep link: storytime://payment/success?session_id=...
  useEffect(() => {
    const handleDeepLink = () => {
      const url = window.location.href;
      if (url.includes('storytime://payment/success')) {
        const params = new URLSearchParams(url.split('?')[1] || '');
        const sessionId = params.get('session_id');
        if (sessionId) {
          // Verify the payment was successful
          getCheckoutSession(sessionId)
            .then(status => {
              if (status.paymentStatus === 'paid') {
                // Payment confirmed — close paywall if open
                setShowPaywall(false);
                // Start polling for credit increase (5 retries = 10 seconds total)
                reloadCredits(5);
              }
            })
            .catch(console.error);
        }
      }
    };

    // Check on load (Capacitor apps may launch with deep link as initial URL)
    handleDeepLink();

    // Also listen for popstate (for web app navigation)
    window.addEventListener('popstate', handleDeepLink);
    return () => window.removeEventListener('popstate', handleDeepLink);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-midnight">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-12 h-12 text-gold" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const navigateToDetail = (story: Story) => {
    setSelectedStory(story);
    setCurrentView('detail');
  };

  return (
    <div className="min-h-screen bg-midnight text-white font-cormorant flex flex-col">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-indigo-deep/30 bg-midnight/80 backdrop-blur-md sticky top-0 z-50">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setCurrentView('home')}
        >
          <Sparkles className="w-8 h-8 text-gold" />
          <h1 className="text-2xl font-bubblegum text-gold tracking-tight">DreamWeaver</h1>
        </div>

        <div className="flex items-center gap-4">
          <div 
            className="hidden md:flex items-center gap-2 text-gold-light/80 cursor-pointer hover:text-gold transition-colors"
            onClick={() => setCurrentView('me')}
          >
            <UserIcon className="w-4 h-4" />
            <span className="text-sm font-medium">{profile?.displayName}</span>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="p-2 hover:bg-indigo-deep/50 rounded-full transition-colors text-gold-light/60 hover:text-gold"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {currentView === 'home' && (
              <HomeView
                onStart={() => setCurrentView('generator')}
                onViewLibrary={() => setCurrentView('library')}
                credits={credits}
                onShowPaywall={() => setShowPaywall(true)}
              />
            )}
            {currentView === 'generator' && (
              <StoryGeneratorView
                onComplete={navigateToDetail}
                onCancel={() => setCurrentView('home')}
                onShowPaywall={() => setShowPaywall(true)}
                credits={credits}
                onRefreshCredits={reloadCredits}
              />
            )}
            {currentView === 'library' && (
              <LibraryView
                onSelectStory={navigateToDetail}
              />
            )}
            {currentView === 'detail' && selectedStory && (
              <StoryDetailView
                story={selectedStory}
                onBack={() => setCurrentView('library')}
              />
            )}
            {currentView === 'me' && (
              <MeView />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Paywall Overlay */}
        <AnimatePresence>
          {showPaywall && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-midnight/95 backdrop-blur-md overflow-y-auto"
            >
              <PaywallView
                onDismiss={() => setShowPaywall(false)}
                onPurchaseSuccess={() => {
                  setShowPaywall(false);
                  // Refresh the generator if user is there
                  if (currentView === 'generator') {
                    setCurrentView('home');
                    setTimeout(() => setCurrentView('generator'), 50);
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden border-t border-indigo-deep/30 bg-midnight/90 backdrop-blur-md p-2 flex justify-around items-center sticky bottom-0 z-50">
        <NavButton
          active={currentView === 'home'}
          onClick={() => setCurrentView('home')}
          icon={<Sparkles className="w-6 h-6" />}
          label="Home"
        />
        <NavButton
          active={currentView === 'generator'}
          onClick={() => setCurrentView('generator')}
          icon={<PlusCircle className="w-6 h-6" />}
          label="Create"
        />
        <NavButton
          active={currentView === 'library'}
          onClick={() => setCurrentView('library')}
          icon={<Library className="w-6 h-6" />}
          label="Library"
        />
        <NavButton
          active={currentView === 'me'}
          onClick={() => setCurrentView('me')}
          icon={<UserIcon className="w-6 h-6" />}
          label="Me"
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 transition-all ${active ? 'text-gold' : 'text-gold-light/40'}`}
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-widest">{label}</span>
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
