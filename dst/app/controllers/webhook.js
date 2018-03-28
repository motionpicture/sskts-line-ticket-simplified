"use strict";
/**
 * LINE webhookコントローラー
 * @namespace app.controllers.webhook
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
const querystring = require("querystring");
const LINE = require("../../line");
const MessageController = require("./webhook/message");
const ImageMessageController = require("./webhook/message/image");
const PostbackController = require("./webhook/postback");
const debug = createDebug('sskts-line-ticket-simplified:controller:webhook');
/**
 * メッセージが送信されたことを示すEvent Objectです。
 */
function message(event, user) {
    return __awaiter(this, void 0, void 0, function* () {
        const userId = event.source.userId;
        try {
            if (event.message === undefined) {
                throw new Error('event.message not found.');
            }
            switch (event.message.type) {
                case LINE.MessageType.text:
                    const messageText = event.message.text;
                    switch (true) {
                        // [購入番号]で検索
                        case /^\d{6}$/.test(messageText):
                            yield MessageController.askReservationEventDate(userId, messageText);
                            break;
                        // ログアウト
                        case /^logout$/.test(messageText):
                            yield MessageController.logout(user);
                            break;
                        case /^座席予約$/.test(messageText):
                            yield MessageController.showSeatReservationMenu(user);
                            break;
                        case /^座席予約追加$/.test(messageText):
                            yield MessageController.askEventStartDate(userId);
                            break;
                        case /^セミナー予約$/.test(messageText):
                            yield MessageController.showSeminarMenu(user);
                            break;
                        case /^チケット$/.test(messageText):
                            yield MessageController.searchTickets(user);
                            break;
                        // 顔写真登録
                        case /^顔写真登録$/.test(messageText):
                            yield MessageController.startIndexingFace(userId);
                            break;
                        // 友達決済承認ワンタイムメッセージ
                        case /^FriendPayToken/.test(messageText):
                            const token = messageText.replace('FriendPayToken.', '');
                            yield MessageController.askConfirmationOfFriendPay(user, token);
                            break;
                        default:
                            // 予約照会方法をアドバイス
                            yield MessageController.pushHowToUse(userId);
                    }
                    break;
                case LINE.MessageType.image:
                    yield ImageMessageController.indexFace(user, event.message.id);
                    break;
                default:
                    throw new Error(`Unknown message type ${event.message.type}`);
            }
        }
        catch (error) {
            // エラーメッセージ表示
            yield LINE.pushMessage(userId, error.toString());
        }
    });
}
exports.message = message;
/**
 * イベントの送信元が、template messageに付加されたポストバックアクションを実行したことを示すevent objectです。
 */
function postback(event, user) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = querystring.parse(event.postback.data);
        debug('data:', data);
        const userId = event.source.userId;
        try {
            switch (data.action) {
                case 'searchTransactionByPaymentNo':
                    // 購入番号と開演日で取引検索
                    yield PostbackController.searchTransactionByPaymentNo(userId, data.paymentNo, event.postback.params.date);
                    break;
                case 'searchTransactionsByDate':
                    yield PostbackController.searchTransactionsByDate(userId, event.postback.params.date);
                    break;
                // イベント検索
                case 'searchEventsByDate':
                    yield PostbackController.searchEventsByDate(user, event.postback.params.date);
                    break;
                // 座席仮予約
                case 'createTmpReservation':
                    yield PostbackController.createTmpReservation(user, data.eventIdentifier);
                    break;
                // セミナー仮予約
                case 'createTmpSeminarReservation':
                    yield PostbackController.createTmpSeminarReservation(user, data.eventId);
                    break;
                // 決済方法選択
                case 'choosePaymentMethod':
                    yield PostbackController.choosePaymentMethod({
                        user: user,
                        paymentMethod: data.paymentMethod,
                        transactionId: data.transactionId,
                        friendPayPrice: 0
                    });
                    break;
                // 注文確定
                case 'confirmOrder':
                    yield PostbackController.confirmOrder(user, data.transactionId, (data.isStub === '1'));
                    break;
                // 友達決済承認確定
                case 'continueTransactionAfterFriendPayConfirmation':
                    yield PostbackController.choosePaymentMethod({
                        user: user,
                        paymentMethod: 'FriendPay',
                        transactionId: data.transactionId,
                        friendPayPrice: parseInt(data.price, 10)
                    });
                    break;
                // チケット認証リクエストを受信
                case 'requestTicketAuthentication':
                    yield PostbackController.requestTicketAuthentication(user, data.ticketToken);
                    break;
                case 'startSeminarReservation':
                    yield PostbackController.startSeminarReservation(user);
                    break;
                // case 'showSeminarTickets':
                //     await PostbackController.showSeminarTickets(user);
                //     break;
                default:
            }
        }
        catch (error) {
            console.error(error);
            // エラーメッセージ表示
            yield LINE.pushMessage(userId, error.toString());
        }
    });
}
exports.postback = postback;
/**
 * イベント送信元に友だち追加（またはブロック解除）されたことを示すEvent Objectです。
 */
function follow(event) {
    return __awaiter(this, void 0, void 0, function* () {
        debug('event is', event);
    });
}
exports.follow = follow;
/**
 * イベント送信元にブロックされたことを示すevent objectです。
 */
function unfollow(event) {
    return __awaiter(this, void 0, void 0, function* () {
        debug('event is', event);
    });
}
exports.unfollow = unfollow;
/**
 * イベントの送信元グループまたはトークルームに参加したことを示すevent objectです。
 */
function join(event) {
    return __awaiter(this, void 0, void 0, function* () {
        debug('event is', event);
    });
}
exports.join = join;
/**
 * イベントの送信元グループから退出させられたことを示すevent objectです。
 */
function leave(event) {
    return __awaiter(this, void 0, void 0, function* () {
        debug('event is', event);
    });
}
exports.leave = leave;
/**
 * イベント送信元のユーザがLINE Beaconデバイスの受信圏内に出入りしたことなどを表すイベントです。
 */
function beacon(event) {
    return __awaiter(this, void 0, void 0, function* () {
        debug('event is', event);
    });
}
exports.beacon = beacon;
