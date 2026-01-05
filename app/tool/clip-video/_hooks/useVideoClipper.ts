import { useState, useRef, useCallback, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useFileLibrary } from '@/app/context/FileLibraryContext';
import type { StoredFile } from '@/src/types/storage';

const FFMPEG_CORE_PATH = '/data/clip-video/ffmpeg/ffmpeg-core.js';

export function useVideoClipper() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [isFfmpegLoading, setIsFfmpegLoading] = useState(true);
  const [isClipping, setIsClipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { addFile } = useFileLibrary();

  const loadFfmpeg = useCallback(async () => {
    if (ffmpegRef.current) {
      setIsFfmpegLoading(false);
      return;
    }
    setError(null);
    setIsFfmpegLoading(true);
    try {
      const ffmpeg = new FFmpeg();
      ffmpeg.on('progress', ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });
      await ffmpeg.load({
        coreURL: await toBlobURL(FFMPEG_CORE_PATH, 'text/javascript'),
      });
      ffmpegRef.current = ffmpeg;
    } catch (err) {
      console.error('Failed to load FFmpeg:', err);
      setError(
        'Could not load video processing engine. Please try reloading the page.'
      );
    } finally {
      setIsFfmpegLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFfmpeg();
  }, [loadFfmpeg]);

  const clipVideo = useCallback(
    async (
      inputFile: StoredFile,
      startTime: string,
      endTime: string,
      outputFilename: string
    ): Promise<string | null> => {
      if (!ffmpegRef.current || !ffmpegRef.current.loaded) {
        setError('Video processing engine is not ready.');
        return null;
      }
      if (!inputFile.blob) {
        setError('Input file is missing data.');
        return null;
      }

      setIsClipping(true);
      setError(null);
      setProgress(0);

      try {
        const ffmpeg = ffmpegRef.current;
        const inputData = new Uint8Array(await inputFile.blob.arrayBuffer());
        await ffmpeg.writeFile(inputFile.filename, inputData);

        // FFmpeg command: -i [input] -ss [start] -to [end] -c copy [output]
        // '-c copy' is a stream copy, which is very fast and doesn't re-encode.
        await ffmpeg.exec([
          '-i',
          inputFile.filename,
          '-ss',
          startTime,
          '-to',
          endTime,
          '-c',
          'copy',
          outputFilename,
        ]);

        const data = await ffmpeg.readFile(outputFilename);
        const blob = new Blob([(data as Uint8Array).buffer], {
          type: inputFile.type,
        });

        const newFileId = await addFile(
          blob,
          outputFilename,
          inputFile.type,
          true
        );

        // Cleanup virtual files
        await ffmpeg.deleteFile(inputFile.filename);
        await ffmpeg.deleteFile(outputFilename);

        return newFileId;
      } catch (err) {
        console.error('Error during video clipping:', err);
        setError(
          err instanceof Error
            ? `Clipping failed: ${err.message}`
            : 'An unknown error occurred during clipping.'
        );
        return null;
      } finally {
        setIsClipping(false);
        setProgress(0);
      }
    },
    [addFile]
  );

  return { isFfmpegLoading, isClipping, progress, error, clipVideo };
}