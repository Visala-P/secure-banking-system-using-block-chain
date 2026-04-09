import fs from 'fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

interface PythonOcrResponse {
  text?: string;
  confidence?: number | null;
  engine?: string;
  error?: string;
  fields?: {
    panNumber?: string | null;
    name?: string | null;
    fatherName?: string | null;
    dob?: string | null;
  };
}

export interface PanModelOcrResult {
  text: string;
  source: 'model' | 'client' | 'none';
  confidence: number | null;
  engine: string;
  warning?: string;
}

const SCRIPT_CANDIDATES = [
  path.resolve(process.cwd(), 'ml', 'pan_detect_ocr.py'),
  path.resolve(process.cwd(), 'server', 'ml', 'pan_detect_ocr.py'),
  path.resolve(process.cwd(), 'ml', 'pan_ocr_infer.py'),
  path.resolve(process.cwd(), 'server', 'ml', 'pan_ocr_infer.py')
];

const PYTHON_CANDIDATES = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

const getExistingScriptPath = async (): Promise<string | null> => {
  for (const candidate of SCRIPT_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

const runInference = async (pythonCommand: string, scriptPath: string, imagePath: string): Promise<PythonOcrResponse> =>
  new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [scriptPath, '--image', imagePath, '--json'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('OCR model timed out'));
    }, 45000);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `OCR process exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout.trim()) as PythonOcrResponse);
      } catch {
        resolve({ text: stdout.trim(), confidence: null, engine: 'unknown' });
      }
    });
  });

export const extractPanOcrText = async (imagePath: string, fallbackText?: string): Promise<PanModelOcrResult> => {
  const scriptPath = await getExistingScriptPath();

  if (!scriptPath) {
    if (fallbackText?.trim()) {
      return {
        text: fallbackText.trim(),
        source: 'client',
        confidence: null,
        engine: 'browser-tesseract',
        warning: 'ML OCR script not found. Using client OCR text.'
      };
    }

    return {
      text: '',
      source: 'none',
      confidence: null,
      engine: 'none',
      warning: 'ML OCR script not found and no fallback OCR text provided.'
    };
  }

  for (const pythonCommand of PYTHON_CANDIDATES) {
    try {
      const result = await runInference(pythonCommand, scriptPath, imagePath);
      const text = result.text?.trim() ?? '';
      if (text) {
        return {
          text,
          source: 'model',
          confidence: result.confidence ?? null,
          engine: result.engine ?? 'ml-ocr'
        };
      }
    } catch {
      continue;
    }
  }

  if (fallbackText?.trim()) {
    return {
      text: fallbackText.trim(),
      source: 'client',
      confidence: null,
      engine: 'browser-tesseract',
      warning: 'ML OCR failed. Using client OCR text fallback.'
    };
  }

  return {
    text: '',
    source: 'none',
    confidence: null,
    engine: 'none',
    warning: 'Could not extract OCR text from model or fallback.'
  };
};
