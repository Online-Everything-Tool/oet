// --- FILE: app/context/FavoritesContext.tsx ---
'use client';

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';

const FAVORITES_LOCAL_STORAGE_KEY = 'oetFavorites_v1';
const MAX_FAVORITES = 50; // Optional limit

interface FavoritesContextValue {
  favorites: string[]; // Array of tool directives (e.g., 'base64-encode-decode')
  isFavorite: (directive: string) => boolean;
  addFavorite: (directive: string) => void;
  removeFavorite: (directive: string) => void;
  toggleFavorite: (directive: string) => void; // Convenience toggle
  isLoaded: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites: [],
  isFavorite: () => false,
  addFavorite: () => {
    console.warn('addFavorite called outside of FavoritesProvider');
  },
  removeFavorite: () => {
    console.warn('removeFavorite called outside of FavoritesProvider');
  },
  toggleFavorite: () => {
    console.warn('toggleFavorite called outside of FavoritesProvider');
  },
  isLoaded: false,
});

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider = ({ children }: FavoritesProviderProps) => {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem(FAVORITES_LOCAL_STORAGE_KEY);
      if (storedFavorites) {
        const parsedFavorites = JSON.parse(storedFavorites);
        if (
          Array.isArray(parsedFavorites) &&
          parsedFavorites.every((item) => typeof item === 'string')
        ) {
          // Ensure uniqueness and limit
          const uniqueFavorites = Array.from(new Set(parsedFavorites)).slice(
            0,
            MAX_FAVORITES
          );
          setFavorites(uniqueFavorites);
        } else {
          console.warn(
            '[FavoritesCtx] Invalid data found in localStorage, clearing.'
          );
          localStorage.removeItem(FAVORITES_LOCAL_STORAGE_KEY);
          setFavorites([]);
        }
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error(
        '[FavoritesCtx] Error loading favorites from localStorage:',
        error
      );
      setFavorites([]); // Reset on error
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        const favoritesString = JSON.stringify(favorites);
        localStorage.setItem(FAVORITES_LOCAL_STORAGE_KEY, favoritesString);
      } catch (error) {
        console.error(
          '[FavoritesCtx] Error saving favorites to localStorage:',
          error
        );
      }
    }
  }, [favorites, isLoaded]);

  const isFavorite = useCallback(
    (directive: string): boolean => {
      return favorites.includes(directive);
    },
    [favorites]
  );

  const addFavorite = useCallback((directive: string) => {
    if (!directive) return;
    setFavorites((prevFavorites) => {
      if (
        prevFavorites.includes(directive) ||
        prevFavorites.length >= MAX_FAVORITES
      ) {
        return prevFavorites; // Already exists or limit reached
      }
      // Add to the beginning for potential recency bias if needed, or end
      return [directive, ...prevFavorites].slice(0, MAX_FAVORITES);
    });
  }, []);

  const removeFavorite = useCallback((directive: string) => {
    if (!directive) return;
    setFavorites((prevFavorites) =>
      prevFavorites.filter((fav) => fav !== directive)
    );
  }, []);

  const toggleFavorite = useCallback((directive: string) => {
    if (!directive) return;
    setFavorites((prevFavorites) => {
      if (prevFavorites.includes(directive)) {
        // Remove
        return prevFavorites.filter((fav) => fav !== directive);
      } else {
        // Add (if limit not reached)
        if (prevFavorites.length >= MAX_FAVORITES) {
          console.warn(
            `[FavoritesCtx] Max favorites limit (${MAX_FAVORITES}) reached.`
          );
          return prevFavorites;
        }
        return [directive, ...prevFavorites].slice(0, MAX_FAVORITES);
      }
    });
  }, []);

  const value = useMemo(
    () => ({
      favorites,
      isFavorite,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      isLoaded,
    }),
    [
      favorites,
      isFavorite,
      addFavorite,
      removeFavorite,
      toggleFavorite,
      isLoaded,
    ]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};
// --- END FILE: app/context/FavoritesContext.tsx ---
