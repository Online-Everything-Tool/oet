// FILE: app/context/ImageLibraryContext.tsx
'use client';

import React, { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import { db, type LibraryImage } from '@/app/lib/db'; // Import db instance and type

// --- Define the shape of the context value ---
interface ImageLibraryContextValue {
    addImage: (blob: Blob, name: string, type: string) => Promise<number | undefined>; // Returns new ID
    getImage: (id: number) => Promise<LibraryImage | undefined>;
    deleteImage: (id: number) => Promise<void>;
    listImages: (limit?: number, sortBy?: keyof LibraryImage, reverse?: boolean) => Promise<LibraryImage[]>;
    clearAllImages: () => Promise<void>;
}

// --- Create the Context ---
const ImageLibraryContext = createContext<ImageLibraryContextValue | undefined>(undefined);

// --- Custom Hook for easy consumption ---
export const useImageLibrary = () => {
    const context = useContext(ImageLibraryContext);
    if (!context) {
        throw new Error('useImageLibrary must be used within an ImageLibraryProvider');
    }
    return context;
};

// --- Provider Component ---
interface ImageLibraryProviderProps {
    children: ReactNode;
}

export const ImageLibraryProvider = ({ children }: ImageLibraryProviderProps) => {

    // --- API Function Implementations ---

    const addImage = useCallback(async (blob: Blob, name: string, type: string): Promise<number | undefined> => {
        try {
            const newImage: LibraryImage = {
                name,
                type,
                blob,
                lastUpdated: Date.now(),
            };
            // Dexie's add() returns the ID of the added item
            const id = await db.images.add(newImage);
            console.log(`[ImageLibraryCtx] Image added with ID: ${id}`);
            return id;
        } catch (error) {
            console.error("[ImageLibraryCtx] Error adding image:", error);
            // Re-throw or handle as needed, maybe return undefined on failure
            throw error; // Re-throwing for now, component can catch
        }
    }, []);

    const getImage = useCallback(async (id: number): Promise<LibraryImage | undefined> => {
        try {
            const image = await db.images.get(id);
            // console.log(`[ImageLibraryCtx] Fetched image ID ${id}:`, image ? 'Found' : 'Not Found');
            return image;
        } catch (error) {
            console.error(`[ImageLibraryCtx] Error getting image ID ${id}:`, error);
            throw error;
        }
    }, []);

    const deleteImage = useCallback(async (id: number): Promise<void> => {
        try {
            await db.images.delete(id);
            console.log(`[ImageLibraryCtx] Deleted image ID ${id}`);
        } catch (error) {
            console.error(`[ImageLibraryCtx] Error deleting image ID ${id}:`, error);
            throw error;
        }
    }, []);

    const listImages = useCallback(async (limit?: number, sortBy: keyof LibraryImage = 'lastUpdated', reverse: boolean = true): Promise<LibraryImage[]> => {
        try {
            let query = db.images.orderBy(sortBy);
            if (reverse) {
                query = query.reverse();
            }
            if (limit && limit > 0) {
                query = query.limit(limit);
            }
            const images = await query.toArray();
            // console.log(`[ImageLibraryCtx] Listed ${images.length} images (limit: ${limit}, sortBy: ${sortBy}, reverse: ${reverse})`);
            return images;
        } catch (error) {
            console.error("[ImageLibraryCtx] Error listing images:", error);
            throw error;
        }
    }, []);

    const clearAllImages = useCallback(async (): Promise<void> => {
        try {
            await db.images.clear();
            console.log("[ImageLibraryCtx] Cleared all images.");
        } catch (error) {
            console.error("[ImageLibraryCtx] Error clearing all images:", error);
            throw error;
        }
    }, []);


    // --- Memoize the context value ---
    const value = useMemo(() => ({
        addImage,
        getImage,
        deleteImage,
        listImages,
        clearAllImages,
    }), [addImage, getImage, deleteImage, listImages, clearAllImages]);

    // --- Render the provider ---
    return (
        <ImageLibraryContext.Provider value={value}>
            {children}
        </ImageLibraryContext.Provider>
    );
};