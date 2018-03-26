"use strict";
/**
 * 取引ルーター
 * @ignore
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const createDebug = require("debug");
const express = require("express");
const PostbackController = require("../controllers/webhook/postback");
const user_1 = require("../user");
const transactionsRouter = express.Router();
const debug = createDebug('sskts-line-ticket-simplified:router:transactions');
transactionsRouter.get('/transactions/:transactionId/inputCreditCard', (__, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const gmoShopId = 'tshop00026096';
        // フォーム
        res.render('transactions/inputCreditCard', {
            gmoShopId: gmoShopId
        });
    }
    catch (error) {
        console.error(error);
        next(error);
    }
}));
transactionsRouter.post('/transactions/:transactionId/inputCreditCard', (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        debug('credit card token created.', req.body.token);
        const user = new user_1.default({
            host: req.hostname,
            userId: req.query.userId,
            state: req.query.state
        });
        // オーソリ取得
        yield PostbackController.choosePaymentMethod({
            user: user,
            paymentMethod: 'CreditCard',
            transactionId: req.params.transactionId,
            creditCardToken: req.body.token
        });
        const location = 'line://';
        res.send(`
<html>
<body onload="location.href='line://'">
<div style="text-align:center; font-size:400%">
<h1>クレジットカード情報入力完了</h1>
<a href="${location}">取引を続ける</a>
</div>
</body>
</html>`);
    }
    catch (error) {
        next(error);
    }
}));
exports.default = transactionsRouter;
