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
const MAX_FAVORITES = 50;

interface FavoritesContextValue {
  favorites: string[];
  isFavorite: (directive: string) => boolean;
  addFavorite: (directive: string) => void;
  removeFavorite: (directive: string) => void;
  toggleFavorite: (directive: string) => void;
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

  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem(FAVORITES_LOCAL_STORAGE_KEY);
      if (storedFavorites) {
        const parsedFavorites = JSON.parse(storedFavorites);
        if (
          Array.isArray(parsedFavorites) &&
          parsedFavorites.every((item) => typeof item === 'string')
        ) {
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
      setFavorites([]);
    } finally {
      setIsLoaded(true);
    }
  }, []);

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
        return prevFavorites;
      }

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
        return prevFavorites.filter((fav) => fav !== directive);
      } else {
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
