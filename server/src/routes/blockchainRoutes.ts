import { Router } from 'express';

import { getBlock, getChain, validateChain } from '../controllers/blockchainController';

const router = Router();

router.get('/chain', getChain);
router.get('/validate', validateChain);
router.get('/:blockNumber', getBlock);

export default router;
