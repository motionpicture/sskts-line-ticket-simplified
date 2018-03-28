/**
 * 取引ルーター
 * @ignore
 */

import * as createDebug from 'debug';
import * as express from 'express';

import * as PostbackController from '../controllers/webhook/postback';
import User from '../user';

const transactionsRouter = express.Router();
const debug = createDebug('sskts-line-ticket-simplified:router:transactions');

/**
 * クレジットカード情報入力フォーム
 */
transactionsRouter.get(
    '/transactions/inputCreditCard',
    async (req, res, next) => {
        try {
            // フォーム
            res.render('transactions/inputCreditCard', {
                gmoShopId: req.query.gmoShopId,
                cb: req.query.cb // フォームのPOST先
            });
        } catch (error) {
            console.error(error);
            next(error);
        }
    });

/**
 * 自分の取引のクレジットカード情報入力戻り先
 */
transactionsRouter.post(
    '/transactions/:transactionId/inputCreditCard',
    async (req, res, next) => {
        try {
            debug('credit card token created.', req.body.token);

            const user = new User({
                host: req.hostname,
                userId: req.query.userId,
                state: req.query.state
            });

            // オーソリ取得
            await PostbackController.choosePaymentMethod({
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
</html>`
            );
        } catch (error) {
            next(error);
        }
    });

transactionsRouter.post(
    '/transactions/:transactionId/inputCreditCard/stub',
    async (req, res, next) => {
        try {
            debug('credit card token created.', req.body.token);

            const user = new User({
                host: req.hostname,
                userId: req.query.userId,
                state: req.query.state
            });

            await PostbackController.askOrderConfirmation(user.userId, req.params.transactionId, true);

            const location = 'line://';

            res.send(`
<html>
<body onload="location.href='line://'">
<div style="text-align:center; font-size:400%">
<h1>クレジットカード情報入力完了</h1>
<a href="${location}">取引を続ける</a>
</div>
</body>
</html>`
            );
        } catch (error) {
            next(error);
        }
    });

/**
 * 友達によるクレジットカード情報入力からのコールバック
 */
transactionsRouter.post(
    '/transactions/payment/friendPay/:friendPayToken',
    async (req, res, next) => {
        try {
            debug('credit card token created.', req.body.token);

            const user = new User({
                host: req.hostname,
                userId: req.query.userId,
                state: req.query.state
            });

            // オーソリ取得
            await PostbackController.confirmFriendPay(user, req.params.friendPayToken, req.body.token);

            const location = 'line://';

            res.send(`
    <html>
    <body onload="location.href='line://'">
    <div style="text-align:center; font-size:400%">
    <h1>クレジットカード情報入力完了</h1>
    <a href="${location}">LINEに戻る</a>
    </div>
    </body>
    </html>`
            );
        } catch (error) {
            next(error);
        }
    });

export default transactionsRouter;
