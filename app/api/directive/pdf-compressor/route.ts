import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

async function compressPdfWithGs(
  inputPath: string,
  outputPath: string,
  resolution: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pdfSetting = '/ebook';

    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${pdfSetting}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-dDownsampleColorImages=true`,
      `-dColorImageResolution=${resolution}`,
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    execFile('gs', args, (error, stdout, stderr) => {
      if (error) {
        console.error('Ghostscript Error:', stderr);
        return reject(error);
      }
      resolve();
    });
  });
}

export async function POST(request: NextRequest) {
  const tempDir = tmpdir();
  const uniqueId = uuidv4();
  const inputPath = join(tempDir, `${uniqueId}_input.pdf`);
  const outputPath = join(tempDir, `${uniqueId}_output.pdf`);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const resolutionStr = formData.get('resolution') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    if (!resolutionStr) {
      return NextResponse.json(
        { error: 'Image resolution not specified.' },
        { status: 400 }
      );
    }

    const resolution = parseInt(resolutionStr, 10);
    if (isNaN(resolution) || resolution < 72 || resolution > 600) {
      return NextResponse.json(
        { error: 'Invalid resolution value. Must be between 72 and 600.' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, fileBuffer);

    await compressPdfWithGs(inputPath, outputPath, resolution);

    const compressedPdfBuffer = await readFile(outputPath);

    return new NextResponse(compressedPdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
      },
    });
  } catch (error) {
    console.error('Error in PDF compression worker:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown server error.';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    try {
      await unlink(inputPath);
      await unlink(outputPath);
    } catch (cleanupError) {
      console.error('Error during temp file cleanup:', cleanupError);
    }
  }
}
