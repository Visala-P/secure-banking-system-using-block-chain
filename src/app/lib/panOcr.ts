const OCR_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

declare global {
  interface Window {
    Tesseract?: {
      createWorker: (lang?: string) => Promise<{
        recognize: (file: File) => Promise<{ data: { text: string } }>;
        terminate: () => Promise<void>;
      }>;
    };
  }
}

let ocrScriptPromise: Promise<void> | null = null;

const scorePanOcrText = (text: string): number => {
  const normalized = text.toUpperCase();
  let score = 0;

  if (/[A-Z]{5}\d{4}[A-Z]/.test(normalized)) {
    score += 40;
  }

  if (/\b\d{2}[\/.-]\d{2}[\/.-]\d{4}\b/.test(normalized)) {
    score += 25;
  }

  if (/\bNAME\b/.test(normalized)) {
    score += 15;
  }

  if (/\bFATHER\b/.test(normalized)) {
    score += 15;
  }

  if (/\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/.test(normalized)) {
    score += 40;
  }

  if (/\bAADHAAR\b|\bUIDAI\b|\bUNIQUE IDENTIFICATION\b|\bGOVERNMENT OF INDIA\b/.test(normalized)) {
    score += 20;
  }

  const alphaCount = (normalized.match(/[A-Z]/g) ?? []).length;
  score += Math.min(alphaCount, 30);

  return score;
};

const preprocessImage = async (file: File): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');

  // Upscale before OCR to recover text from compressed WhatsApp images.
  const scale = 2;
  canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
  canvas.height = Math.max(1, Math.floor(bitmap.height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize image processing canvas');
  }

  ctx.filter = 'grayscale(100%) contrast(190%) brightness(110%)';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Apply a simple threshold for sharper OCR-friendly glyph edges.
  for (let index = 0; index < data.length; index += 4) {
    const luminance = data[index];
    const value = luminance > 145 ? 255 : 0;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => {
      if (!result) {
        reject(new Error('Failed to create processed OCR image'));
        return;
      }
      resolve(result);
    }, 'image/png');
  });

  bitmap.close();
  return blob;
};

const loadOcrScript = async (): Promise<void> => {
  if (window.Tesseract) {
    return;
  }

  if (!ocrScriptPromise) {
    ocrScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = OCR_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load OCR engine'));
      document.head.appendChild(script);
    });
  }

  await ocrScriptPromise;
};

export const extractPanOcrText = async (file: File): Promise<string> => {
  await loadOcrScript();

  if (!window.Tesseract) {
    throw new Error('OCR engine is unavailable');
  }

  const worker = await window.Tesseract.createWorker('eng');
  try {
    const processedBlob = await preprocessImage(file);

    const [originalResult, processedResult] = await Promise.all([
      worker.recognize(file),
      worker.recognize(processedBlob)
    ]);

    const candidates = [originalResult.data.text ?? '', processedResult.data.text ?? ''];
    const bestText = candidates.sort((left, right) => scorePanOcrText(right) - scorePanOcrText(left))[0] ?? '';

    return bestText;
  } finally {
    await worker.terminate();
  }
};
