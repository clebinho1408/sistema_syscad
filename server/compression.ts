import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const TARGET_IMAGE_SIZE = 150 * 1024;
const TARGET_PDF_SIZE = 200 * 1024;

export interface CompressionResult {
  compressedData: string;
  newSize: number;
  newFileType: string;
  wasCompressed: boolean;
}

export async function compressImage(base64Data: string, fileType: string, targetSizeKB: number = 150): Promise<CompressionResult> {
  const targetSize = targetSizeKB * 1024;
  
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  
  if (buffer.length <= targetSize) {
    return {
      compressedData: base64Data,
      newSize: buffer.length,
      newFileType: fileType,
      wasCompressed: false,
    };
  }

  let quality = 80;
  let compressedBuffer = buffer;
  
  while (compressedBuffer.length > targetSize && quality > 10) {
    compressedBuffer = await sharp(buffer)
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    
    if (compressedBuffer.length > targetSize) {
      quality -= 10;
    }
  }
  
  if (compressedBuffer.length > targetSize && quality <= 10) {
    let scale = 0.8;
    while (compressedBuffer.length > targetSize && scale > 0.2) {
      const metadata = await sharp(buffer).metadata();
      const newWidth = Math.round((metadata.width || 1920) * scale);
      
      compressedBuffer = await sharp(buffer)
        .resize({ width: newWidth, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 20, mozjpeg: true })
        .toBuffer();
      
      scale -= 0.1;
    }
  }
  
  return {
    compressedData: `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`,
    newSize: compressedBuffer.length,
    newFileType: 'image/jpeg',
    wasCompressed: true,
  };
}

export async function compressPdf(base64Data: string, targetSizeKB: number = 200): Promise<CompressionResult> {
  const targetSize = targetSizeKB * 1024;
  
  const base64Content = base64Data.replace(/^data:application\/pdf;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  
  if (buffer.length <= targetSize) {
    return {
      compressedData: base64Data,
      newSize: buffer.length,
      newFileType: 'application/pdf',
      wasCompressed: false,
    };
  }

  try {
    const pdfDoc = await PDFDocument.load(buffer);
    
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });
    
    const compressedBuffer = Buffer.from(compressedBytes);
    
    if (compressedBuffer.length < buffer.length) {
      return {
        compressedData: `data:application/pdf;base64,${compressedBuffer.toString('base64')}`,
        newSize: compressedBuffer.length,
        newFileType: 'application/pdf',
        wasCompressed: true,
      };
    }
    
    return {
      compressedData: base64Data,
      newSize: buffer.length,
      newFileType: 'application/pdf',
      wasCompressed: false,
    };
  } catch (error) {
    console.error('Error compressing PDF:', error);
    return {
      compressedData: base64Data,
      newSize: buffer.length,
      newFileType: 'application/pdf',
      wasCompressed: false,
    };
  }
}

export async function compressDocument(
  fileData: string,
  fileType: string
): Promise<CompressionResult> {
  if (fileType.startsWith('image/')) {
    return compressImage(fileData, fileType, 150);
  } else if (fileType === 'application/pdf') {
    return compressPdf(fileData, 200);
  }
  
  const base64Content = fileData.replace(/^data:[^;]+;base64,/, '');
  const size = Buffer.from(base64Content, 'base64').length;
  
  return {
    compressedData: fileData,
    newSize: size,
    newFileType: fileType,
    wasCompressed: false,
  };
}
