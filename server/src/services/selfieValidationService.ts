import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface SelfieAnalysisResult {
  success?: boolean;
  faceCount?: number;
  estimatedAge?: number | null;
  engine?: string;
  error?: string;
}

export interface SelfieValidationResult {
  isValid: boolean;
  message?: string;
  faceCount: number;
  estimatedAge: number | null;
  engine: string;
}

const SELFIE_SCRIPT_CANDIDATES = [
  path.resolve(process.cwd(), 'ml', 'selfie_face_analyze.py'),
  path.resolve(process.cwd(), 'server', 'ml', 'selfie_face_analyze.py')
];

const PYTHON_CANDIDATES = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

const getExistingSelfieScriptPath = async (): Promise<string | null> => {
  for (const candidate of SELFIE_SCRIPT_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

const runSelfieAnalysis = async (filePath: string): Promise<SelfieAnalysisResult> => {
  const scriptPath = await getExistingSelfieScriptPath();
  if (!scriptPath) {
    return {
      success: false,
      faceCount: 0,
      estimatedAge: null,
      engine: 'none',
      error: 'Selfie analysis script not found'
    };
  }

  for (const pythonCommand of PYTHON_CANDIDATES) {
    try {
      const { stdout } = await execFileAsync(pythonCommand, [scriptPath, '--image', filePath, '--json'], {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024
      });

      return JSON.parse(stdout.trim()) as SelfieAnalysisResult;
    } catch {
      continue;
    }
  }

  return {
    success: false,
    faceCount: 0,
    estimatedAge: null,
    engine: 'none',
    error: 'Selfie analysis failed'
  };
};

export const validateSelfieImage = async (filePath: string): Promise<SelfieValidationResult> => {
  const analysis = await runSelfieAnalysis(filePath);
  const faceCount = Number.isFinite(analysis.faceCount) ? Number(analysis.faceCount) : 0;
  const estimatedAge =
    typeof analysis.estimatedAge === 'number' && Number.isFinite(analysis.estimatedAge)
      ? Number(analysis.estimatedAge)
      : null;
  const engine = analysis.engine ?? 'unknown';

  if (!analysis.success) {
    return {
      isValid: false,
      message: analysis.error || 'Selfie validation failed',
      faceCount,
      estimatedAge,
      engine
    };
  }

  if (faceCount !== 1) {
    return {
      isValid: false,
      message: faceCount <= 0 ? 'No face detected in passport size photo' : 'Passport size photo must contain exactly one face',
      faceCount,
      estimatedAge,
      engine
    };
  }

  return {
    isValid: true,
    faceCount,
    estimatedAge,
    engine
  };
};
