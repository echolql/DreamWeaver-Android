import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Play, Pause, Sparkles, Star, Moon, CloudMoon, ChevronDown } from 'lucide-react';
import { Story } from '../types';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';

interface StoryDetailViewProps {
  story: Story;
  onBack: () => void;
}

const SPEEDS = [0.8, 1, 1.2, 1.5];

export function StoryDetailView({ story, onBack }: StoryDetailViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setIsPlaying(false);
      audio.addEventListener('ended', handleEnded);
      return () => audio.removeEventListener('ended', handleEnded);
    }
  }, []);

  return (
    <div className="min-h-full p-6 max-w-4xl mx-auto pb-24">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gold-light/60 hover:text-gold mb-8 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back to Library</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Visual Content */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl border border-gold/20 bg-indigo-deep/20"
          >
            {story.imageUrl ? (
              <img 
                src={story.imageUrl} 
                alt={story.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gold-light/20">
                <CloudMoon className="w-24 h-24" />
                <p className="font-bubblegum text-xl">A Magical Tale</p>
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-midnight/80 via-transparent to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-end">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-gold" />
                <span className="text-xs font-bold uppercase tracking-widest text-gold">{story.theme}</span>
              </div>
            </div>
          </motion.div>

          {/* Audio Controls */}
          <div className="bg-indigo-deep/40 backdrop-blur-md p-6 rounded-3xl border border-gold/10 flex items-center gap-6 shadow-xl">
            <button 
              onClick={togglePlay}
              className="w-16 h-16 bg-gold hover:bg-gold-light text-midnight rounded-full flex items-center justify-center transition-all shadow-lg shadow-gold/20"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
            
            <div className="flex-1">
              <h4 className="font-bubblegum text-gold text-lg mb-1">Listen to Narration</h4>
              <div className="flex items-center gap-4">
                <p className="text-gold-light/60 text-sm italic">Soothing voice by Kore</p>
              <div className="flex items-center gap-2 bg-midnight/40 rounded-xl px-3 py-2 border border-gold/10">
                  <div className="relative">
                    <select
                      value={playbackRate}
                      onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                      className="bg-transparent text-gold font-bold text-xs outline-none appearance-none pr-4 cursor-pointer"
                    >
                      {SPEEDS.map(speed => (
                        <option key={speed} value={speed} className="bg-midnight">{speed}x</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-gold-light/40 pointer-events-none" />
                  </div>
                </div>
              </div>
              <audio ref={audioRef} src={story.audioUrl} />
            </div>
          </div>
        </div>

        {/* Story Text */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="space-y-2">
            <h2 className="text-5xl font-bubblegum text-gold tracking-tight leading-tight">
              {story.title}
            </h2>
            <div className="flex items-center gap-4 text-gold-light/40 text-sm font-bold uppercase tracking-widest">
              <span>{new Date(story.createdAt).toLocaleDateString()}</span>
              <div className="w-1 h-1 bg-gold/20 rounded-full" />
              <span>{story.character}</span>
            </div>
          </div>

          <div className="prose prose-invert max-w-none">
            <div className="text-xl md:text-2xl text-light-navy leading-relaxed font-cormorant first-letter:text-6xl first-letter:font-bubblegum first-letter:text-gold first-letter:mr-3 first-letter:float-left">
              <Markdown>{story.content}</Markdown>
            </div>
          </div>

          <div className="pt-12 border-t border-gold/10 flex items-center justify-end">
            <div className="flex items-center gap-2 text-gold-light/40 italic">
              <Moon className="w-4 h-4" />
              <span className="text-sm">Sweet dreams...</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
