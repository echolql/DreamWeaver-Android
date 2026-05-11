import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { auth, db } from '../firebase';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch, updateDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  User as UserIcon,
  Mail,
  Trash2,
  ShieldCheck,
  Edit2,
  Save,
  X,
  CheckCircle2,
  Palette,
  Check,
  Type,
  ChevronRight,
  ShieldAlert,
  FileText,
  ArrowLeft,
  Lock
} from 'lucide-react';

const MAGICAL_AVATARS = [
  '🧙‍♂️', '🧚', '🦄', '🐉', '🌙', '🌟', '🎨', '🎭', '🔮', ' Phoenix', '✨', '🦉'
];

const MAGICAL_COLORS = [
  { name: 'Gold', class: 'bg-gold' },
  { name: 'Indigo', class: 'bg-indigo-600' },
  { name: 'Purple', class: 'bg-purple-600' },
  { name: 'Rose', class: 'bg-rose-500' },
  { name: 'Sky', class: 'bg-sky-500' },
  { name: 'Emerald', class: 'bg-emerald-500' }
];

const PRIVACY_POLICY_CONTENT = `# Privacy Policy

**Last Updated: April 24, 2026**

This Privacy Policy describes how your personal information is collected, used, and shared when you use the DreamWeaver application (the "App").

## 1. Information Collection and Use
For a better experience, while using our Service, we may require you to provide us with certain personally identifiable information. The information that we request will be retained on your device and is not collected by us in any way.

## 2. Children's Privacy
**This App does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13.**

In the case we discover that a child under 13 has provided us with personal information, we immediately delete this from our servers. If you are a parent or guardian and you become aware that your child has provided us with personal information, please contact us so that we will be able to take the necessary actions and **delete that information immediately upon request.**

## 3. Third-Party Services
The app does use third-party services that may collect information used to identify you.

- Google Gemini: https://support.google.com/gemini/answer/13594961
- Firebase: https://firebase.google.com/support/privacy
- Google Play Services: https://policies.google.com/privacy

## 4. Security
We value your trust in providing us your Personal Information, thus we are striving to use commercially acceptable means of protecting it. But remember that no method of transmission over the internet, or method of electronic storage is 100% secure and reliable, and we cannot guarantee its absolute security.

## 5. Changes to This Privacy Policy
We may update our Privacy Policy from time to time. Thus, you are advised to review this page periodically for any changes. We will notify you of any changes by posting the new Privacy Policy on this page.

## 6. Contact Us
If you have any questions or suggestions about our Privacy Policy, or to request the removal of data provided by a minor, do not hesitate to contact us.

**echolql@gmail.com**`;

export function MeView() {
  const { user, profile } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Privacy Policy state
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    favoriteColor: '',
    photoURL: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        favoriteColor: profile.favoriteColor || 'Gold',
        photoURL: profile.photoURL || ''
      });
    }
  }, [profile, isEditing]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    setError('');

    try {
      const profileRef = doc(db, 'users', user.uid);
      await setDoc(profileRef, {
        displayName: formData.displayName,
        bio: formData.bio,
        favoriteColor: formData.favoriteColor,
        photoURL: formData.photoURL
      }, { merge: true });

      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Profile update error:', err);
      // Show the actual Firebase error code — important for diagnosing Firestore rules
      const message = err?.message || String(err);
      const code = err?.code || '';
      setError(`Failed to update profile. ${code ? `(${code})` : ''} Try again or check your internet connection.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !user.email) return;

    setIsDeleting(true);
    setError('');

    try {
      // Step 1: Always re-authenticate first (Firebase deleteUser requires recent login)
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      // Step 2: Delete all user's stories from Firestore
      const storiesRef = collection(db, 'stories');
      const q = query(storiesRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);

      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Step 3: Delete user profile from Firestore
      await deleteDoc(doc(db, 'users', user.uid));

      // Step 4: Delete Firebase Auth user
      await deleteUser(user);
    } catch (err: any) {
      console.error('Account deletion error:', err);
      const code = err?.code || '';
      const message = err?.message || String(err);
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Incorrect password. Please try again.');
      } else if (code === 'auth/requires-recent-login') {
        setError('Your session has expired. Please log out and log back in, then try again.');
      } else if (code.startsWith('auth/')) {
        setError(`Authentication error (${code}). Please log out and back in.`);
      } else if (code === 'permission-denied') {
        setError('Firebase permission denied. Please check Firestore security rules.');
      } else if (code === 'unavailable' || message.includes('network')) {
        setError('Network error. Check your internet connection (disable VPN if active).');
      } else {
        setError(`Failed to delete account. (${code || 'unknown error'}) Please try again later.`);
      }
      setIsDeleting(false);
    }
  };

  const handleStartDelete = () => {
    setShowConfirm(true);
    setDeletePassword('');
    setError('');
  };

  if (showPrivacyPolicy) {
    return (
      <div className="min-h-full p-6 max-w-3xl mx-auto">
        <button
          onClick={() => setShowPrivacyPolicy(false)}
          className="flex items-center gap-2 text-gold-light/60 hover:text-gold mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Profile</span>
        </button>

        <h2 className="text-4xl font-bubblegum text-gold mb-6">Privacy Policy</h2>

        <div className="bg-indigo-deep/20 border border-gold/20 rounded-3xl p-8">
          <div className="prose prose-invert max-w-none text-gold-light/90 leading-relaxed whitespace-pre-line">
            {PRIVACY_POLICY_CONTENT.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return (
                  <h3 key={i} className="text-xl font-bubblegum text-gold mt-6 mb-3">
                    {line.replace('## ', '')}
                  </h3>
                );
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return (
                  <p key={i} className="text-gold-light font-bold my-2">
                    {line.replace(/\*\*/g, '')}
                  </p>
                );
              }
              if (line.startsWith('- ')) {
                return (
                  <li key={i} className="text-gold-light/80 ml-4 list-disc">
                    {line.replace('- ', '')}
                  </li>
                );
              }
              if (line.trim() === '') return <div key={i} className="h-2" />;
              return (
                <p key={i} className="text-gold-light/80 mb-2">
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto flex flex-col">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bubblegum text-gold mb-2">My Profile</h2>
          <p className="text-gold-light/80 italic">Managing your magical identity</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gold/10 hover:bg-gold/20 text-gold rounded-full transition-all text-sm font-medium border border-gold/20"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </button>
        )}
      </div>

      <div className="space-y-6 flex-1">
        {/* Profile Card */}
        <div className="bg-indigo-deep/20 border border-gold/20 rounded-3xl p-8 space-y-8 relative overflow-hidden">
          {saveSuccess && (
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-sm font-bold border border-emerald-500/20 z-10"
            >
              <CheckCircle2 className="w-4 h-4" />
              Changes saved!
            </motion.div>
          )}

          <div className="flex flex-col md:flex-row gap-8">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 bg-gold/20 rounded-full flex items-center justify-center border-4 border-gold/40 text-4xl shadow-lg shadow-gold/10">
                {formData.photoURL || <UserIcon className="w-12 h-12 text-gold" />}
              </div>

              {isEditing && (
                <div className="grid grid-cols-4 gap-2 p-2 bg-white/5 rounded-2xl border border-white/10">
                  {MAGICAL_AVATARS.map(avatar => (
                    <button
                      key={avatar}
                      onClick={() => setFormData(prev => ({ ...prev, photoURL: avatar }))}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                        formData.photoURL === avatar ? 'bg-gold/30 border-2 border-gold' : 'hover:bg-white/10'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info Section */}
            <div className="flex-1 space-y-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-gold-light/60 text-xs font-bold uppercase tracking-wider mb-2 block ml-1">
                      Display Name
                    </label>
                    <div className="relative">
                      <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/40" />
                      <input
                        type="text"
                        value={formData.displayName}
                        onChange={e => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                        className="w-full bg-white/5 border border-gold/20 rounded-xl py-3 pl-11 pr-4 text-gold-light focus:outline-none focus:border-gold transition-colors"
                        placeholder="Your magical name..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-gold-light/60 text-xs font-bold uppercase tracking-wider mb-2 block ml-1">
                      Magical Bio
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                      className="w-full bg-white/5 border border-gold/20 rounded-xl py-3 px-4 text-gold-light focus:outline-none focus:border-gold transition-colors min-h-[100px] resize-none"
                      placeholder="Tell us about your magic..."
                    />
                  </div>

                  <div>
                    <label className="text-gold-light/60 text-xs font-bold uppercase tracking-wider mb-2 block ml-1">
                      Favorite Magical Essence
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {MAGICAL_COLORS.map(color => (
                        <button
                          key={color.name}
                          onClick={() => setFormData(prev => ({ ...prev, favoriteColor: color.name }))}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                            formData.favoriteColor === color.name
                              ? 'bg-gold/20 border-gold text-gold'
                              : 'bg-white/5 border-white/10 text-gold-light/60 hover:border-gold/30'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${color.class}`} />
                          <span className="text-sm">{color.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-3xl font-bold text-gold">{profile?.displayName || 'Dreamer'}</h3>
                    <div className="text-gold-light/60 flex items-center flex-wrap gap-2 mt-2">
                      <Mail className="w-4 h-4 text-gold/40" /> {profile?.email}
                      {user?.emailVerified && (
                        <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold uppercase tracking-wider">
                          <Check className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {profile?.bio && (
                    <p className="text-gold-light/80 leading-relaxed italic">
                      "{profile.bio}"
                    </p>
                  )}

                  {profile?.favoriteColor && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold/10 rounded-full border border-gold/20">
                      <Palette className="w-3 h-3 text-gold" />
                      <span className="text-xs font-bold text-gold/80">{profile.favoriteColor} Essence</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Edit profile error display — added so user sees save errors */}
          {isEditing && error && (
            <div className="px-2">
              <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                {error}
              </p>
            </div>
          )}

          {isEditing && (
            <div className="pt-6 border-t border-gold/10 flex flex-col gap-4">
              {!error && isEditing && error === '' && (
                /* This empty check ensures we don't duplicate errors */
                null
              )}
              <div className="flex gap-4">
                <button
                  disabled={isSaving}
                  onClick={handleSaveProfile}
                  className="flex-1 bg-gold hover:bg-gold-light text-indigo-950 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-indigo-950/30 border-t-indigo-950 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Magical Identity
                    </>
                  )}
                </button>
                <button
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
                  className="px-6 bg-white/5 hover:bg-white/10 text-gold-light font-bold py-3 rounded-xl transition-all flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {!isEditing && (
            <div className="pt-6 border-t border-gold/10">
              <div className="flex items-center gap-3 text-gold-light/80 text-sm">
                <ShieldCheck className="w-5 h-5 text-gold" />
                <span>Your identity is protected by ancient magic.</span>
              </div>
            </div>
          )}
        </div>

        {/* Action List Section */}
        <div className="bg-indigo-deep/20 border border-gold/20 rounded-3xl overflow-hidden divide-y divide-gold/10">
          {/* Privacy Policy - now with onClick */}
          <button
            onClick={() => setShowPrivacyPolicy(true)}
            className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                <FileText className="w-5 h-5 text-gold" />
              </div>
              <span className="text-gold-light font-medium">Privacy Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gold/30 group-hover:text-gold/60" />
          </button>

          {/* Delete Account Option - gold text, consistent styling */}
          {!showConfirm ? (
            <button
              onClick={handleStartDelete}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                  <Trash2 className="w-5 h-5 text-gold" />
                </div>
                <span className="text-gold-light font-medium">Delete My Account</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gold/30 group-hover:text-gold/60" />
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-6 space-y-4 border-t border-gold/10"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-gold" />
                <span className="text-gold-light text-sm">
                  This will permanently delete your account and all your magical stories. This action cannot be undone.
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-gold-light/60 text-xs font-bold uppercase tracking-wider block ml-1">
                  Enter your password to confirm
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/40" />
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full bg-white/5 border border-gold/20 rounded-xl py-3 pl-11 pr-4 text-gold-light focus:outline-none focus:border-gold transition-colors"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-xs font-bold bg-red-500/10 p-2 rounded">
                  {error}
                </p>
              )}

              <div className="flex gap-4">
                <button
                  disabled={isDeleting || !deletePassword}
                  onClick={handleDeleteAccount}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => { setShowConfirm(false); setDeletePassword(''); setError(''); }}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
