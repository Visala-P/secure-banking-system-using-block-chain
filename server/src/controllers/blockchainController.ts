import { NextFunction, Response } from 'express';

import { AuthenticatedRequest } from '../types';
import { getBlockByNumber, getBlockchain, validateBlockchain } from '../services/blockchainService';

export const getChain = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const chain = await getBlockchain();
    res.json(chain);
  } catch (error) {
    next(error);
  }
};

export const getBlock = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const blockNumber = Number(req.params.blockNumber);
    const block = await getBlockByNumber(blockNumber);
    res.json(block);
  } catch (error) {
    next(error);
  }
};

export const validateChain = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await validateBlockchain();
    res.json(result);
  } catch (error) {
    next(error);
  }
};
