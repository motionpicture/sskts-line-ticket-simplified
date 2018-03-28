/**
 * LINE webhookコントローラー
 * @namespace app.controllers.webhook
 */

import * as createDebug from 'debug';
import * as querystring from 'querystring';

import * as LINE from '../../line';
import User from '../user';
import * as MessageController from './webhook/message';
import * as ImageMessageController from './webhook/message/image';
import * as PostbackController from './webhook/postback';

const debug = createDebug('sskts-line-ticket-simplified:controller:webhook');

/**
 * メッセージが送信されたことを示すEvent Objectです。
 */
export async function message(event: LINE.IWebhookEvent, user: User) {
    const userId = event.source.userId;

    try {
        if (event.message === undefined) {
            throw new Error('event.message not found.');
        }

        switch (event.message.type) {
            case LINE.MessageType.text:
                const messageText = <string>event.message.text;

                switch (true) {
                    // [購入番号]で検索
                    case /^\d{6}$/.test(messageText):
                        await MessageController.askReservationEventDate(userId, messageText);
                        break;

                    // ログアウト
                    case /^logout$/.test(messageText):
                        await MessageController.logout(user);
                        break;

                    case /^座席予約$/.test(messageText):
                        await MessageController.showSeatReservationMenu(user);
                        break;

                    case /^座席予約追加$/.test(messageText):
                        await MessageController.askEventStartDate(userId);
                        break;

                    case /^セミナー予約$/.test(messageText):
                        await MessageController.showSeminarMenu(user);
                        break;

                    case /^チケット$/.test(messageText):
                        await MessageController.searchTickets(user);
                        break;

                    // 顔写真登録
                    case /^顔写真登録$/.test(messageText):
                        await MessageController.startIndexingFace(userId);
                        break;

                    // 友達決済承認ワンタイムメッセージ
                    case /^FriendPayToken/.test(messageText):
                        const token = messageText.replace('FriendPayToken.', '');
                        await MessageController.askConfirmationOfFriendPay(user, token);
                        break;

                    default:
                        // 予約照会方法をアドバイス
                        await MessageController.pushHowToUse(userId);
                }

                break;

            case LINE.MessageType.image:
                await ImageMessageController.indexFace(user, event.message.id);

                break;

            default:
                throw new Error(`Unknown message type ${event.message.type}`);
        }
    } catch (error) {
        // エラーメッセージ表示
        await LINE.pushMessage(userId, error.toString());
    }
}

/**
 * イベントの送信元が、template messageに付加されたポストバックアクションを実行したことを示すevent objectです。
 */
export async function postback(event: LINE.IWebhookEvent, user: User) {
    const data = querystring.parse(event.postback.data);
    debug('data:', data);
    const userId = event.source.userId;

    try {
        switch (data.action) {
            case 'searchTransactionByPaymentNo':
                // 購入番号と開演日で取引検索
                await PostbackController.searchTransactionByPaymentNo(userId, <string>data.paymentNo, <string>event.postback.params.date);
                break;

            case 'searchTransactionsByDate':
                await PostbackController.searchTransactionsByDate(userId, <string>event.postback.params.date);
                break;

            // イベント検索
            case 'searchEventsByDate':
                await PostbackController.searchEventsByDate(user, <string>event.postback.params.date);
                break;

            // 座席仮予約
            case 'createTmpReservation':
                await PostbackController.createTmpReservation(user, <string>data.eventIdentifier);
                break;

            // セミナー仮予約
            case 'createTmpSeminarReservation':
                await PostbackController.createTmpSeminarReservation(user, <string>data.eventId);
                break;

            // 決済方法選択
            case 'choosePaymentMethod':
                await PostbackController.choosePaymentMethod({
                    user: user,
                    paymentMethod: <PostbackController.PaymentMethodType>data.paymentMethod,
                    transactionId: <string>data.transactionId,
                    friendPayPrice: 0
                });
                break;

            // 注文確定
            case 'confirmOrder':
                await PostbackController.confirmOrder(
                    user, <string>data.transactionId, (<string>data.isStub === '1'));
                break;

            // 友達決済承認確定
            case 'continueTransactionAfterFriendPayConfirmation':
                await PostbackController.choosePaymentMethod({
                    user: user,
                    paymentMethod: 'FriendPay',
                    transactionId: <string>data.transactionId,
                    friendPayPrice: parseInt(<string>data.price, 10)
                });
                break;

            // チケット認証リクエストを受信
            case 'requestTicketAuthentication':
                await PostbackController.requestTicketAuthentication(user, <string>data.ticketToken);
                break;

            case 'startSeminarReservation':
                await PostbackController.startSeminarReservation(user);
                break;

            // case 'showSeminarTickets':
            //     await PostbackController.showSeminarTickets(user);
            //     break;

            default:
        }
    } catch (error) {
        console.error(error);
        // エラーメッセージ表示
        await LINE.pushMessage(userId, error.toString());
    }
}

/**
 * イベント送信元に友だち追加（またはブロック解除）されたことを示すEvent Objectです。
 */
export async function follow(event: LINE.IWebhookEvent) {
    debug('event is', event);
}

/**
 * イベント送信元にブロックされたことを示すevent objectです。
 */
export async function unfollow(event: LINE.IWebhookEvent) {
    debug('event is', event);
}

/**
 * イベントの送信元グループまたはトークルームに参加したことを示すevent objectです。
 */
export async function join(event: LINE.IWebhookEvent) {
    debug('event is', event);
}

/**
 * イベントの送信元グループから退出させられたことを示すevent objectです。
 */
export async function leave(event: LINE.IWebhookEvent) {
    debug('event is', event);
}

/**
 * イベント送信元のユーザがLINE Beaconデバイスの受信圏内に出入りしたことなどを表すイベントです。
 */
export async function beacon(event: LINE.IWebhookEvent) {
    debug('event is', event);
}
