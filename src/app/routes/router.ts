/**
 * defaultルーター
 * @ignore
 */

import * as express from 'express';

import transactionsRouter from './transactions';

const router = express.Router();

// middleware that is specific to this router
// router.use((req, res, next) => {
//   debug('Time: ', Date.now())
//   next()
// })

router.use(transactionsRouter);

export default router;
