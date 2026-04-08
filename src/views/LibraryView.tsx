import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../AuthProvider';
import { Story } from '../types';
import { Library, Trash2, Play, Calendar, Star, Moon, CloudMoon, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface LibraryViewProps {
  onSelectStory: (story: Story) => void;
}

export function LibraryView({ onSelectStory }: LibraryViewProps) {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'stories'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      setStories(storiesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stories');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, storyId: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stories/${storyId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }}>
          <Sparkles className="w-12 h-12 text-gold" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 max-w-6xl mx-auto">
      <div className="mb-12 flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-4xl font-bubblegum text-gold flex items-center gap-4">
            <Library className="w-10 h-10" /> Your Story Library
          </h2>
          <p className="text-gold-light/60 italic">"Revisit your favorite adventures under the moonlight..."</p>
        </div>
        
        <div className="hidden md:flex items-center gap-4 text-gold-light/40 text-sm font-bold uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4" />
            <span>{stories.length} Tales</span>
          </div>
        </div>
      </div>

      {stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <CloudMoon className="w-24 h-24 text-gold-light/20" />
          <div className="space-y-2">
            <h3 className="text-2xl font-bubblegum text-gold-light/40">Your library is empty</h3>
            <p className="text-gold-light/20 max-w-xs mx-auto">The stars are waiting for your first adventure to begin.</p>
          </div>
          <button 
            onClick={() => window.location.reload()} // Simple way to trigger generator if we had a proper router
            className="bg-gold/10 hover:bg-gold/20 text-gold px-8 py-3 rounded-2xl border border-gold/20 transition-all flex items-center gap-2"
          >
            <Wand2 className="w-5 h-5" />
            Start Your First Story
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {stories.map((story, index) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectStory(story)}
                className="group relative bg-indigo-deep/20 border border-gold/10 rounded-3xl overflow-hidden cursor-pointer hover:border-gold/40 transition-all shadow-xl hover:shadow-gold/10"
              >
                {/* Card Image */}
                <div className="aspect-[4/3] relative overflow-hidden">
                  {story.imageUrl ? (
                    <img 
                      src={story.imageUrl} 
                      alt={story.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-indigo-deep/40 flex items-center justify-center">
                      <CloudMoon className="w-12 h-12 text-gold-light/10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/20 to-transparent" />
                  
                  <div className="absolute top-4 right-4 flex gap-2 z-20">
                    <button 
                      onClick={(e) => handleDelete(e, story.id)}
                      className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all shadow-lg"
                      title="Delete Story"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-end">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3 text-gold-light/40" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gold-light/40">
                        {new Date(story.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-6 space-y-3">
                  <h3 className="text-xl font-bubblegum text-gold group-hover:text-gold-light transition-colors line-clamp-1">
                    {story.title}
                  </h3>
                  <p className="text-gold-light/60 text-sm line-clamp-2 italic font-cormorant">
                    {story.content}
                  </p>
                  
                  <div className="pt-4 flex items-center gap-3">
                    <div className="px-3 py-1 bg-gold/10 rounded-full border border-gold/10 flex items-center gap-1">
                      <Star className="w-3 h-3 text-gold" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gold">{story.theme}</span>
                    </div>
                    <div className="px-3 py-1 bg-white/5 rounded-full border border-white/5 flex items-center gap-1">
                      <Moon className="w-3 h-3 text-gold-light/40" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gold-light/40">{story.character}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
