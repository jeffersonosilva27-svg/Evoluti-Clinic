import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, deleteField } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  testRole: UserRole | null;
  setTestRole: (role: UserRole | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [testRole, setTestRole] = useState<UserRole | null>(null);


  useEffect(() => {
    // Safety timeout: if auth takes too long, stop loading
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(safetyTimeout);
      
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      try {
        setUser(user);
        if (user) {
          const profileRef = doc(db, 'users', user.uid);
          const profileSnap = await getDoc(profileRef);

          if (!profileSnap.exists()) {
            if (user.email === 'jefferson.osilva27@gmail.com') {
              const newProfile: UserProfile = {
                uid: user.uid,
                name: user.displayName || 'Usuário',
                email: user.email || '',
                role: 'ADM_SISTEMA',
                status: 'approved',
                clinics: [],
                createdAt: new Date(),
              };
              await setDoc(profileRef, newProfile);
              setProfile(newProfile);
              unsubProfile = onSnapshot(profileRef, (snap) => {
                if (snap.exists()) setProfile(snap.data() as UserProfile);
              });
            } else {
              setProfile(null);
            }
          } else {
            const currentData = profileSnap.data() as UserProfile;
            
            // Auto upgrade jefferson
            if (user.email === 'jefferson.osilva27@gmail.com' && (currentData.role !== 'ADM_SISTEMA' || currentData.profession === 'Fisioterapeuta' || currentData.status !== 'approved')) {
              currentData.role = 'ADM_SISTEMA';
              currentData.status = 'approved';
              delete currentData.profession;
              await setDoc(profileRef, { role: 'ADM_SISTEMA', status: 'approved', profession: deleteField() }, { merge: true });
            }

            setProfile(currentData);
            // Subscribe to profile changes
            unsubProfile = onSnapshot(profileRef, (snap) => {
              if (snap.exists()) setProfile(snap.data() as UserProfile);
            }, (err) => {
              console.error("Profile sync error:", err);
            });
          }
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        // We still set loading to false so the app doesn't stay stuck
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const effectiveProfile = profile ? { ...profile, role: testRole || profile.role } : null;

  return (
    <AuthContext.Provider value={{ user, profile: effectiveProfile, loading, signIn, logout, testRole, setTestRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
