import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wand2, Star, Moon, CloudMoon, Image as ImageIcon, Volume2, ArrowLeft, Loader2, AlertCircle, ChevronDown, Mic2, Palette } from 'lucide-react';
import { generateStory, generateImage, generateNarration, checkSafety } from '../services/geminiService';
import { useAuth } from '../AuthProvider';
import { db, storage, OperationType, handleFirestoreError } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { Story } from '../types';
import { cn } from '../lib/utils';
import { getUserCredits, useCredit } from '../services/paymentsService';
import { VOICES, IMAGE_STYLES } from '../constants/options';

interface StoryGeneratorViewProps {
  onComplete: (story: Story) => void;
  onCancel: () => void;
  onShowPaywall: () => void;
  credits: UserCredits | null;
  onRefreshCredits: () => void;
}

const LANGUAGES = [
  'English', 'Chinese', 'Spanish', 'French', 'German', 'Italian', 'Japanese',
  'Korean', 'Portuguese', 'Russian', 'Arabic', 'Hindi', 'Dutch', 'Swedish',
  'Turkish', 'Vietnamese'
];

const MODES = [
  { id: 'story', label: 'Story Only', icon: <Volume2 className="w-5 h-5" />, description: 'Text and narration' },
  { id: 'story_image', label: 'Story + Image', icon: <ImageIcon className="w-5 h-5" />, description: 'Text, narration, and illustration' }
];

export function StoryGeneratorView({ onComplete, onCancel, onShowPaywall, credits, onRefreshCredits }: StoryGeneratorViewProps) {
  const { user } = useAuth();
  const [theme, setTheme] = useState('');
  const [character, setCharacter] = useState('');
  const [language, setLanguage] = useState('English');
  const [mode, setMode] = useState<'story' | 'story_image'>('story_image');
  const [voice, setVoice] = useState(VOICES[0].id);
  const [imageStyle, setImageStyle] = useState(IMAGE_STYLES[0].id);

  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const hasCredits = credits && credits.totalStoriesAvailable > 0;

  const handleGenerate = async () => {
    if (!theme || !character || !user) return;

    // Check word count
    const themeWords = theme.trim().split(/\s+/).length;
    if (themeWords > 40) {
      setError('Please keep your theme under 40 words.');
      return;
    }

    // Check credits before generating
    if (!hasCredits) {
      onShowPaywall();
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      // 0. Safety Guardrail
      setStatus('Checking for magical safety...');
      const safetyResult = await checkSafety(`${theme} ${character}`);
      if (!safetyResult.isSafe) {
        throw new Error(`The theme is inappropriate, please try different input...`);
      }

      // 1. Start Story and Image generation in parallel
      setStatus('Weaving the story & preparing the illustration...');

      const storyPromise = generateStory(theme, character, language);
      const imagePromise =
        mode === 'story_image'
          ? generateImage(character, theme, imageStyle, (attempt) => {
              // Image retry callback
              if (attempt > 0) {
                // Update status on retry with a nice message
                setStatus(
                  `We're getting a lot of requests for illustrations! We're trying again (attempt ${attempt}/3)...`
                );
              }
            })
          : Promise.resolve('');

      // We need to handle image errors specifically so we don't block the whole generation
      let base64Image = '';
      try {
        base64Image = await imagePromise;
      } catch (imageErr: any) {
        // Log but don't re-throw, we can still generate the text-only story.
        console.error('Image Generation Error (Final):', imageErr);
        // Fallback or show error message for image part if needed, but let's assume
        // for now that we want the text story to finish.
      }

      const [generatedStory] = await Promise.all([storyPromise]);

      let imageUrl = '';
      let audioUrl = '';

      // 2. Handle Image Upload
      if (mode === 'story_image' && base64Image) {
        setStatus('Finalizing the illustration...');
        try {
          const binary = atob(base64Image.split(',')[1]);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const imageBlob = new Blob([bytes], { type: 'image/jpeg' });

          const imageRef = ref(storage, `stories/${user.uid}/${Date.now()}_image.jpg`);
          await uploadBytes(imageRef, imageBlob, { contentType: 'image/jpeg' });
          imageUrl = await getDownloadURL(imageRef);
        } catch (imageErr: any) {
          console.error('Image Storage Error:', imageErr);
          throw new Error(`Failed to save illustration: ${imageErr.message}`);
        }
      }

      // 3. Generate Narration (Must wait for story text)
      setStatus('Preparing the soothing voice...');
      const base64Audio = await generateNarration(generatedStory.content, voice);

      setStatus('Saving the magical voice...');
      try {
        const binary = atob(base64Audio.split(',')[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const audioBlob = new Blob([bytes], { type: 'audio/wav' });

        const audioRef = ref(storage, `stories/${user.uid}/${Date.now()}_audio.wav`);

        const uploadPromise = uploadBytes(audioRef, audioBlob, { contentType: 'audio/wav' });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Upload timed out. Please check your internet connection or Firebase Storage rules.')), 30000)
        );

        await Promise.race([uploadPromise, timeoutPromise]);
        audioUrl = await getDownloadURL(audioRef);
      } catch (storageErr: any) {
        console.error('Storage Error:', storageErr);
        throw new Error(`Failed to save narration: ${storageErr.message}. If this persists, please check your Firebase Storage permissions.`);
      }

      // 4. Save to Firestore
      setStatus('Saving your adventure...');

      const storyData: any = {
        userId: user.uid,
        title: generatedStory.title,
        content: generatedStory.content,
        theme,
        character,
        language,
        mode,
        audioUrl,
        createdAt: Date.now(),
      };

      if (imageUrl) {
        storyData.imageUrl = imageUrl;
      }

      const docRef = await addDoc(collection(db, 'stories'), storyData);

      // Only deduct credit AFTER successful generation
      try {
        await useCredit(user.uid);
        onRefreshCredits();
      } catch (e) {
        // Credit may already be deducted by webhook — ignore
        console.warn('useCredit webhook may have already handled it:', e);
        onRefreshCredits();
      }

      onComplete({ ...storyData, id: docRef.id } as Story);
    } catch (err: any) {
      console.error(err);
      let errorMessage =
        err.message || 'Something went wrong while weaving your story.';

      if (
        errorMessage.includes('403') ||
        errorMessage.includes('permission') ||
        errorMessage.includes('unauthorized')
      ) {
        errorMessage =
          "It looks like there's a permission issue. Please ensure you've enabled Firebase Storage and set the Rules as instructed. If you're seeing this during AI generation, your API key might need additional permissions.";
      } else if (
        errorMessage.includes('503') ||
        errorMessage.includes('busy') ||
        errorMessage.includes('overloaded')
      ) {
        errorMessage =
          "We're getting a lot of requests right now! We tried several times, but the illustration magic is currently unavailable. Please try again in a few minutes.";
      }

      setError(errorMessage);
      // Credits were deducted by useCredit before generation started;
      // if generation failed, they are already spent (no restore needed)
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="mb-8"
        >
          <Wand2 className="w-24 h-24 text-gold drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]" />
        </motion.div>

        <h2 className="text-3xl font-bubblegum text-gold mb-4">{status}</h2>
        <div className="w-64 h-2 bg-indigo-deep/30 rounded-full overflow-hidden mb-8">
          <motion.div
            className="h-full bg-gold"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 15, ease: "linear" }}
          />
        </div>

        <p className="text-gold-light/60 italic max-w-md">
          "The stars are aligning, and the magic is flowing. Your adventure will be ready shortly..."
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto">
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-gold-light/60 hover:text-gold mb-8 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back to Home</span>
      </button>

      <div className="mb-8">
        <h2 className="text-4xl font-bubblegum text-gold mb-2">Weave a New Tale</h2>
        <p className="text-gold-light/80 italic">Tell us about the adventure you want to create...</p>
      </div>

      {/* Credits Banner removed - now in header */}

      <div className="space-y-6">
        {/* Theme Input */}
        <div className="space-y-2">
          <label className="text-gold-light/80 italic flex items-center gap-2">
            <Star className="w-4 h-4" /> Theme
          </label>
          <input
            type="text"
            placeholder="e.g., A magical forest, A journey to the moon, Underwater kingdom"
            value={theme}
            onChange={(e) => setTheme(e.target.value.slice(0, 200))} // Soft cap on input length for UI
            className="w-full bg-indigo-deep/20 border border-white/40 rounded-2xl py-4 px-6 focus:border-white outline-none transition-all text-gold-light placeholder:text-gold-light/20"
          />
          <p className="text-[10px] text-gold-light/40 italic pl-2">
            Max 40 words.
          </p>
        </div>

        {/* Character Input */}
        <div className="space-y-2">
          <label className="text-gold-light/80 italic flex items-center gap-2">
            <Moon className="w-4 h-4" /> Main Character
          </label>
          <input
            type="text"
            placeholder="e.g., A brave little squirrel, A friendly robot, A curious princess"
            value={character}
            onChange={(e) => setCharacter(e.target.value)}
            className="w-full bg-indigo-deep/20 border border-white/40 rounded-2xl py-4 px-6 focus:border-white outline-none transition-all text-gold-light placeholder:text-gold-light/20"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Language Selection */}
          <div className="space-y-2">
            <label className="text-gold-light/80 italic">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-indigo-deep/20 border border-white/40 rounded-2xl py-4 px-6 focus:border-white outline-none transition-all text-gold-light appearance-none cursor-pointer"
            >
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang} className="bg-midnight">{lang}</option>
              ))}
            </select>
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="text-gold-light/80 italic">Magic Mode</label>
            <div className="flex gap-2">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id as any)}
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all gap-1",
                    mode === m.id
                      ? "bg-gold/20 border-gold text-gold"
                      : "bg-indigo-deep/20 border-white/40 text-gold-light/40 hover:border-white"
                  )}
                >
                  {m.icon}
                  <span className="text-[10px] font-bold uppercase tracking-tighter">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="text-gold-light/80 italic flex items-center gap-2">
              <Mic2 className="w-4 h-4" /> Storyteller Voice
            </label>
            <div className="relative">
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full bg-indigo-deep/20 border border-white/40 rounded-2xl py-4 px-6 focus:border-white outline-none transition-all text-gold-light appearance-none cursor-pointer"
              >
                {VOICES.map(v => (
                  <option key={v.id} value={v.id} className="bg-midnight">
                    {v.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-light/40 pointer-events-none" />
            </div>
          </div>

          {/* Style Selection */}
          {mode === 'story_image' && (
            <div className="space-y-2">
              <label className="text-gold-light/80 italic flex items-center gap-2">
                <Palette className="w-4 h-4" /> Illustration Style
              </label>
              <div className="relative">
                <select
                  value={imageStyle}
                  onChange={(e) => setImageStyle(e.target.value)}
                  className="w-full bg-indigo-deep/20 border border-white/40 rounded-2xl py-4 px-6 focus:border-white outline-none transition-all text-gold-light appearance-none cursor-pointer"
                >
                  {IMAGE_STYLES.map(s => (
                    <option key={s.id} value={s.id} className="bg-midnight">
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gold-light/40 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 p-4 rounded-xl border border-red-400/20">
            {error}
          </p>
        )}

        {!hasCredits && (
          <div className="bg-gold/10 border border-gold/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-gold shrink-0" />
            <p className="text-gold text-sm">
              You've used all your free stories.{' '}
              <button onClick={onShowPaywall} className="underline hover:text-gold-light">
                Get more stories
              </button>{' '}
              to continue creating.
            </p>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!theme || !character || isGenerating}
          className="w-full bg-gold hover:bg-gold-light text-midnight font-bubblegum text-2xl py-5 rounded-2xl transition-all shadow-xl shadow-gold/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mt-8"
        >
          <Wand2 className="w-6 h-6" />
          {hasCredits ? 'Weave the Magic' : 'Weave the Magic'}
        </button>
      </div>
    </div>
  );
}
