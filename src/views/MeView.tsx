import React, { useState } from 'react';
import { useAuth } from '../AuthProvider';
import { auth, db } from '../firebase';
import { deleteUser } from 'firebase/auth';
import { doc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { motion } from 'motion/react';
import { User as UserIcon, Mail, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';

export function MeView() {
  const { user, profile } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    setError('');

    try {
      // 1. Delete user stories from Firestore
      const storiesRef = collection(db, 'stories');
      const q = query(storiesRef, where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 2. Delete user profile from Firestore
      await deleteDoc(doc(db, 'users', user.uid));

      // 3. Delete user from Firebase Auth
      await deleteUser(user);
      
      // onAuthStateChanged in AuthProvider will handle the redirect
    } catch (err: any) {
      console.error('Account deletion error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For your security, please log out and log back in before deleting your account.');
      } else {
        setError('Failed to delete account. Please try again later.');
      }
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-full p-6 max-w-2xl mx-auto flex flex-col">
      <div className="mb-12">
        <h2 className="text-4xl font-bubblegum text-gold mb-2">My Profile</h2>
        <p className="text-gold-light/80 italic">Managing your magical identity...</p>
      </div>

      <div className="space-y-6 flex-1">
        {/* Profile Card */}
        <div className="bg-indigo-deep/20 border border-gold/20 rounded-3xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gold/20 rounded-full flex items-center justify-center border-2 border-gold/40">
              <UserIcon className="w-10 h-10 text-gold" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gold">{profile?.displayName || 'Dreamer'}</h3>
              <p className="text-gold-light/60 flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4" /> {profile?.email}
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-gold/10">
            <div className="flex items-center gap-3 text-gold-light/80 text-sm mb-4">
              <ShieldCheck className="w-5 h-5 text-gold" />
              <span>Your data is protected and private.</span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="pt-12">
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 text-red-400/60 hover:text-red-400 transition-colors text-sm font-medium ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              Delete my account
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-6 h-6" />
                <h4 className="font-bold">Wait! Are you sure?</h4>
              </div>
              <p className="text-red-400/80 text-sm">
                This will permanently delete your account and all your magical stories. This action cannot be undone.
              </p>
              
              {error && (
                <p className="text-red-500 text-xs font-bold bg-red-500/10 p-2 rounded">
                  {error}
                </p>
              )}

              <div className="flex gap-4">
                <button
                  disabled={isDeleting}
                  onClick={handleDeleteAccount}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-gold-light font-bold py-3 rounded-xl transition-all"
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
