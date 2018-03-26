"use strict";
/**
 * defaultルーター
 * @ignore
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const transactions_1 = require("./transactions");
const router = express.Router();
// middleware that is specific to this router
// router.use((req, res, next) => {
//   debug('Time: ', Date.now())
//   next()
// })
router.use(transactions_1.default);
exports.default = router;
