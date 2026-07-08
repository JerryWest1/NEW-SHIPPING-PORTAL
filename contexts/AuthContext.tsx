import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile as updateAuthProfile,
  User as FirebaseUser,
  deleteUser
} from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';

interface User {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  updateProfile: (name: string, email: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Watch for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const email = firebaseUser.email.toLowerCase();
          
          // 1. Try UID-based lookup first (Standard)
          let userDocRef = doc(db, 'users', firebaseUser.uid);
          let userSnapshot = await getDoc(userDocRef);
          
          // 2. If not found, try Email-based lookup (Pending Invites or Legacy)
          if (!userSnapshot.exists()) {
            const emailDocRef = doc(db, 'users', email);
            const emailSnapshot = await getDoc(emailDocRef);
            
            if (emailSnapshot.exists()) {
              userDocRef = emailDocRef;
              userSnapshot = emailSnapshot;
            }
          }

          if (userSnapshot.exists()) {
            const userData = userSnapshot.data();
            
            // If the document doesn't have the UID yet (e.g. it was a pending invite), update it
            if (userData.uid !== firebaseUser.uid) {
              await setDoc(userDocRef, { 
                uid: firebaseUser.uid, 
                status: 'active',
                lastLogin: new Date() 
              }, { merge: true });
            }

            setUser({
              id: userSnapshot.id,
              uid: firebaseUser.uid,
              email: email,
              name: userData.name || firebaseUser.displayName || '',
              role: (userData.role?.toLowerCase() as 'admin' | 'user') || 'user',
              status: (userData.status as 'active' | 'pending') || 'active'
            });
          } else {
            // NO RECORD FOUND in Firestore 'users' collection.
            // We do NOT auto-create a record here anymore to prevent "crossing over"
            // from contacts or accidental user creation.
            setUser({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email: email,
              name: firebaseUser.displayName || '',
              role: 'user', // Default role for authenticated but unregistered users
              status: 'active'
            });
          }
        } catch (error) {
          console.error('Error fetching user record:', error);
          setUser({
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email.toLowerCase(),
            name: firebaseUser.displayName || '',
            role: 'user',
            status: 'active'
          });
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    
    try {
      // 1. Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      
      // 2. Set display name in Auth
      await updateAuthProfile(userCredential.user, { displayName: name.trim() });
      
      // 3. Check for existing record (invite) by email
      const emailDocRef = doc(db, 'users', normalizedEmail);
      const emailSnapshot = await getDoc(emailDocRef);
      
      let existingRole: 'admin' | 'user' = 'user';
      let inviteData = {};
      
      if (emailSnapshot.exists()) {
        inviteData = emailSnapshot.data();
        existingRole = (inviteData as any).role || 'user';
        // Update the existing email-based doc to 'active' and set UID
        await updateDoc(emailDocRef, {
          ...inviteData,
          uid: userCredential.user.uid,
          status: 'active',
          name: name.trim(),
          updatedAt: new Date()
        });
      } else {
        // 4. No invite record found - delete the auth user and throw error
        await deleteUser(userCredential.user);
        throw new Error("You do not have a pending invite.");
      }

      // Update local state
      setUser({
        id: userCredential.user.uid,
        uid: userCredential.user.uid,
        email: normalizedEmail,
        name: name.trim(),
        role: existingRole,
        status: 'active'
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (name: string, email: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      const updatedData = {
        name: name.trim(),
        email: normalizedEmail,
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'users', user.id), updatedData, { merge: true });
      setUser({ ...user, ...updatedData });
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      signup,
      updateProfile,
      resetPassword,
      logout,
      isAuthenticated: user !== null
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};