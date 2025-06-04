import React from 'react';
import type { ParsedGzipHeader } from '../_hooks/useGzipDecompressor';

interface GzipHeaderDisplayProps {
  header: ParsedGzipHeader | null;
}

const osMap: Record<number, string> = {
  0: 'FAT filesystem (MS-DOS, OS/2, NT/Win32)',
  1: 'Amiga',
  2: 'VMS (or OpenVMS)',
  3: 'Unix',
  4: 'VM/CMS',
  5: 'Atari TOS',
  6: 'HPFS filesystem (OS/2, NT)',
  7: 'Macintosh',
  8: 'Z-System',
  9: 'CP/M',
  10: 'TOPS-20',
  11: 'NTFS filesystem (NT)',
  12: 'QDOS',
  13: 'Acorn RISCOS',
  255: 'Unknown',
};

const GzipHeaderDisplay: React.FC<GzipHeaderDisplayProps> = ({ header }) => {
  if (!header) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))]">No Gzip header information available.</p>;
  }

  const renderFlag = (label: string, value?: boolean) => (
    value !== undefined && (
      <li>
        <span className="font-semibold">{label}:</span> {value ? 'Yes' : 'No'}
      </li>
    )
  );

  return (
    <div className="text-sm space-y-2 p-3 border border-[rgb(var(--color-border-base))] rounded-md bg-[rgb(var(--color-bg-subtle))]">
      <h3 className="text-md font-semibold text-[rgb(var(--color-text-base))] mb-1">Gzip Header Information:</h3>
      <ul className="list-disc list-inside space-y-1 text-[rgb(var(--color-text-muted))]">
        {header.name && <li><span className="font-semibold">Original Filename:</span> {header.name}</li>}
        {header.time && <li><span className="font-semibold">Modification Time:</span> {new Date(header.time * 1000).toLocaleString()}</li>}
        {header.os !== undefined && <li><span className="font-semibold">Operating System:</span> {osMap[header.os] || `Unknown (${header.os})`}</li>}
        {header.comment && <li><span className="font-semibold">Comment:</span> {header.comment}</li>}
        {renderFlag('Is Text File (FTEXT)', header.text)}
        {renderFlag('Has Header CRC (FHCRC)', header.hcrc)}
        {header.extra && <li><span className="font-semibold">Extra Data:</span> {header.extra.length} bytes</li>}
      </ul>
    </div>
  );
};

export default GzipHeaderDisplay;