// FILE: app/tool/_components/ImageSelectionModal.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image'; // Use Next Image for potential optimization if needed later
import { useImageLibrary } from '@/app/context/ImageLibraryContext';
import { LibraryImage } from '@/app/lib/db';

interface ImageSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImageSelect: (image: LibraryImage) => void;
    className?: string;
}

const ImageSelectionModal: React.FC<ImageSelectionModalProps> = ({ isOpen, onClose, onImageSelect, className }) => {
    const { listImages, loading: libraryLoading, error: libraryError } = useImageLibrary();
    const [images, setImages] = useState<LibraryImage[]>([]);
    const [modalLoading, setModalLoading] = useState<boolean>(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [imageObjectUrls, setImageObjectUrls] = useState<Map<string, string>>(new Map());
    const managedUrlsRef = useRef<Map<string, string>>(new Map());

    // Function to revoke managed URLs
    const revokeManagedUrls = useCallback(() => {
        managedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        managedUrlsRef.current.clear();
    }, []);

    // Function to update object URLs
    const updateObjectUrls = useCallback((imgs: LibraryImage[]) => {
        revokeManagedUrls(); // Clear previous URLs first
        const newUrlMap = new Map<string, string>();
        imgs.forEach(img => {
            if (img.id && typeof img.id === 'string') {
                // Prefer thumbnail, fallback to full blob
                const blobToUse = img.thumbnailBlob || img.blob;
                if (blobToUse) {
                    try {
                        const url = URL.createObjectURL(blobToUse);
                        newUrlMap.set(img.id, url);
                        managedUrlsRef.current.set(img.id, url); // Track for cleanup
                    } catch (e) {
                        console.error(`[ImageSelectionModal] Error creating Object URL for ID ${img.id}:`, e);
                    }
                }
            }
        });
        setImageObjectUrls(newUrlMap);
    }, [revokeManagedUrls]);


    // Load images when the modal opens
    const loadAndDisplayImages = useCallback(async (limit = 50) => { // Increased limit
        setModalError(null);
        setModalLoading(true);
        try {
            const loadedImages = await listImages(limit);
            const validImages = loadedImages.filter(img => typeof img.id === 'string');
             if (validImages.length !== loadedImages.length) {
                 console.warn("[ImageSelectionModal] Some images returned from listImages had invalid/missing IDs.");
             }
            setImages(validImages);
            updateObjectUrls(validImages); // Update URLs after setting images
        } catch (err: unknown) {
            console.error('[ImageSelectionModal] Error loading images:', err);
            setModalError(`Failed to load stored images: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setImages([]);
            revokeManagedUrls(); // Ensure cleanup on error
            setImageObjectUrls(new Map());
        } finally {
            setModalLoading(false);
        }
    }, [listImages, updateObjectUrls, revokeManagedUrls]); // updateObjectUrls is now stable

    useEffect(() => {
        if (isOpen) {
            loadAndDisplayImages();
        } else {
            // Clear state and revoke URLs when modal closes
            setImages([]);
            revokeManagedUrls();
            setImageObjectUrls(new Map());
            setModalError(null);
            setModalLoading(false);
        }
        // Cleanup function to revoke URLs on unmount or when isOpen changes to false
        return () => {
            revokeManagedUrls();
        };
    }, [isOpen, loadAndDisplayImages, revokeManagedUrls]);


    if (!isOpen) return null;

    const handleImageClick = (image: LibraryImage) => {
        onImageSelect(image); // Pass the full LibraryImage object
        // Optionally close modal immediately after selection
        // onClose();
    };


    return (
        // Modal container
        <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-select-modal-title"
        >
            {/* Modal content area */}
            <div
                className={`bg-[rgb(var(--color-bg-component))] rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] ${className || ''}`}
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
            >
                {/* Modal Header */}
                <div className="p-4 border-b border-[rgb(var(--color-border-base))] flex justify-between items-center flex-shrink-0">
                    <h2 id="image-select-modal-title" className="text-lg font-semibold text-[rgb(var(--color-text-base))]">
                        Select Image from Library
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                        aria-label="Close image selection modal"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="p-4 overflow-y-auto flex-grow">
                    {/* Loading State */}
                    {(modalLoading || libraryLoading) && (
                        <p className="text-center text-[rgb(var(--color-text-muted))] italic animate-pulse">Loading images...</p>
                    )}
                    {/* Error State */}
                    {(modalError || libraryError) && (
                         <p className="text-center text-red-600">Error: {modalError || libraryError}</p>
                     )}

                    {/* Image Grid */}
                    {!modalLoading && !libraryLoading && images.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {images.map(image => {
                                const objectUrl = imageObjectUrls.get(image.id);
                                return (
                                    <button
                                        key={image.id}
                                        className="aspect-square w-full border border-gray-200 p-1 rounded-md hover:border-blue-500 hover:ring-1 hover:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 flex flex-col items-center justify-center text-center overflow-hidden bg-gray-50"
                                        onClick={() => handleImageClick(image)}
                                        aria-label={`Select image: ${image.name || 'Untitled'}`}
                                    >
                                        {objectUrl ? (
                                            <Image
                                                src={objectUrl}
                                                alt={image.name || 'Stored image'}
                                                width={150} // Set appropriate size for grid items
                                                height={150}
                                                className="object-contain max-h-full max-w-full pointer-events-none"
                                                unoptimized={true} // Use unoptimized for blob URLs
                                            />
                                        ) : (
                                            <span className="text-xs text-gray-400 italic p-1">Loading...</span>
                                        )}
                                        <span className="text-xs text-gray-500 mt-1 truncate w-full px-1" title={image.name || 'Untitled'}>
                                             {image.name || 'Untitled'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Empty State */}
                    {!modalLoading && !libraryLoading && images.length === 0 && !modalError && !libraryError && (
                        <p className="text-center text-gray-500 italic">Your image library is empty. Use the Image Storage tool to add images.</p>
                    )}
                </div>

                 {/* Modal Footer (Optional) */}
                 <div className="p-3 border-t border-[rgb(var(--color-border-base))] bg-[rgb(var(--color-bg-subtle))] flex justify-end flex-shrink-0">
                     <button
                         onClick={onClose}
                         className="px-4 py-2 rounded-md text-sm font-medium bg-[rgb(var(--color-button-neutral-bg))] text-[rgb(var(--color-button-neutral-text))] hover:bg-[rgb(var(--color-button-neutral-hover-bg))] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
                     >
                         Cancel
                     </button>
                 </div>
            </div>
        </div>
    );
};

export default ImageSelectionModal;