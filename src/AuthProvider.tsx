import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import { OperationType, handleFirestoreError } from './firebase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (user) {
        const profileRef = doc(db, 'users', user.uid);

        // Listen for profile changes
        profileUnsubscribe = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
            setLoading(false);
          } else {
            // Create profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Dreamer',
              createdAt: Date.now(),
            };
            setDoc(profileRef, newProfile).catch(err => {
              console.error('Error creating profile:', err);
              handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
            });
            // onSnapshot will trigger again after setDoc
          }
        }, (error) => {
          console.error('Error listening to profile:', error);
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
