import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';

export interface ConversionResult {
  data: Blob | string; // Blob for XLSX, string for CSV
  filename: string;
  mimeType: string;
}

export interface UseXlsCsvConverterReturn {
  isConverting: boolean;
  conversionError: string | null;
  convert: (
    file: File, // Expect a File object (e.g., from StoredFile.blob)
    originalFilename: string,
    direction: 'xlsToCsv' | 'csvToXlsx'
  ) => Promise<ConversionResult | null>;
  resetConverter: () => void;
}

// Naive CSV to Array of Arrays parser. Does not handle complex cases like quoted commas.
const csvToAOA = (csvText: string): string[][] => {
  return csvText
    .trim()
    .split('\n')
    .map((row) => row.split(','));
};

export default function useXlsCsvConverter(): UseXlsCsvConverterReturn {
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const resetConverter = useCallback(() => {
    setIsConverting(false);
    setConversionError(null);
  }, []);

  const convert = useCallback(
    async (
      file: File,
      originalFilename: string,
      direction: 'xlsToCsv' | 'csvToXlsx'
    ): Promise<ConversionResult | null> => {
      setIsConverting(true);
      setConversionError(null);

      try {
        if (direction === 'xlsToCsv') {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            throw new Error('No sheets found in the workbook.');
          }
          const worksheet = workbook.Sheets[firstSheetName];
          const csvString = XLSX.utils.sheet_to_csv(worksheet);
          const newFilename = originalFilename.replace(/\.(xlsx?|xls)$/i, '.csv');
          return {
            data: csvString,
            filename: newFilename,
            mimeType: 'text/csv',
          };
        } else { // csvToXlsx
          const csvText = await file.text();
          const aoaData = csvToAOA(csvText);
          if (aoaData.length === 0 || (aoaData.length === 1 && aoaData[0].length === 1 && aoaData[0][0] === '')) {
            throw new Error('CSV data is empty or invalid.');
          }
          const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
          const newWorkbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(newWorkbook, worksheet, 'Sheet1');
          
          const xlsxBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const newFilename = originalFilename.replace(/\.csv$/i, '.xlsx');
          return {
            data: blob,
            filename: newFilename,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        }
      } catch (error) {
        console.error('Conversion error:', error);
        const message = error instanceof Error ? error.message : 'Unknown conversion error occurred.';
        setConversionError(message);
        return null;
      } finally {
        setIsConverting(false);
      }
    },
    []
  );

  return { isConverting, conversionError, convert, resetConverter };
}