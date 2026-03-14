import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { users as fallbackUsers } from '../data/mockData';
import { supabase } from '../db/supabase';

interface UserContextType {
  currentUser: User;
  setCurrentUser: (user: User) => void;
  switchUser: (userId: string) => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User>(fallbackUsers[0]); // Ana Kovac (planner) by default
  const [allUsers, setAllUsers] = useState<User[]>(fallbackUsers);

  // Load users from Supabase once available
  useEffect(() => {
    supabase.from('users').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        setAllUsers(data as User[]);
        const savedId = localStorage.getItem('ecoplanner_current_user');
        if (savedId) {
          const saved = (data as User[]).find(u => u.id === savedId);
          if (saved) setCurrentUser(saved);
        }
      }
    }).then(() => {}, () => {});
  }, []);

  const switchUser = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('ecoplanner_current_user', userId);
    }
  };

  const handleSetCurrentUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('ecoplanner_current_user', user.id);
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser: handleSetCurrentUser, switchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
