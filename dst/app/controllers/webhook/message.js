"use strict";
/**
 * LINE webhook messageコントローラー
 * @namespace app.controllers.webhook.message
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
const sskts = require("@motionpicture/sskts-domain");
const moment = require("moment");
const request = require("request-promise-native");
const util = require("util");
const LINE = require("../../../line");
/**
 * 使い方を送信する
 * @export
 */
function pushHowToUse(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield request.post({
            simple: false,
            url: 'https://api.line.me/v2/bot/message/push',
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: userId,
                messages: [
                    {
                        type: 'template',
                        altText: 'How to use',
                        template: {
                            type: 'buttons',
                            title: '何をしますか？',
                            text: '画面下部メニューから操作することもできます。',
                            actions: [
                                {
                                    type: 'message',
                                    label: '座席予約メニューを見る',
                                    text: '座席予約'
                                },
                                {
                                    type: 'message',
                                    label: '顔を登録する',
                                    text: '顔写真登録'
                                }
                            ]
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.pushHowToUse = pushHowToUse;
/**
 * 座席予約メニューを表示する
 */
function showSeatReservationMenu(user) {
    return __awaiter(this, void 0, void 0, function* () {
        yield request.post({
            simple: false,
            url: 'https://api.line.me/v2/bot/message/push',
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: user.userId,
                messages: [
                    {
                        type: 'template',
                        altText: '座席予約メニュー',
                        template: {
                            type: 'buttons',
                            title: '座席予約',
                            text: 'ご用件はなんでしょう？',
                            actions: [
                                {
                                    type: 'message',
                                    label: '座席を予約する',
                                    text: '座席予約追加'
                                },
                                {
                                    type: 'message',
                                    label: '予約を確認する',
                                    text: 'チケット'
                                }
                            ]
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.showSeatReservationMenu = showSeatReservationMenu;
/**
 * セミナー予約メニューを表示する
 */
function showSeminarMenu(user) {
    return __awaiter(this, void 0, void 0, function* () {
        yield request.post({
            simple: false,
            url: 'https://api.line.me/v2/bot/message/push',
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: user.userId,
                messages: [
                    {
                        type: 'template',
                        altText: 'セミナー予約メニュー',
                        template: {
                            type: 'buttons',
                            title: 'セミナー予約',
                            text: 'ご用件はなんでしょう？',
                            actions: [
                                {
                                    type: 'postback',
                                    label: 'セミナーを予約する',
                                    data: 'action=startSeminarReservation'
                                },
                                {
                                    type: 'postback',
                                    label: 'セミナー予約を確認する',
                                    data: 'action=showSeminarTickets'
                                }
                            ]
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.showSeminarMenu = showSeminarMenu;
/**
 * 顔写真登録を開始する
 */
function startIndexingFace(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const text = '顔写真を送信してください。';
        yield LINE.pushMessage(userId, text);
    });
}
exports.startIndexingFace = startIndexingFace;
/**
 * 友達決済承認確認
 */
function askConfirmationOfFriendPay(user, friendPayToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const gmoShopId = 'tshop00026096';
        const callback = `https://${user.host}/transactions/payment/friendPay/${friendPayToken}?userId=${user.userId}`;
        const creditCardUrl = `https://${user.host}/transactions/inputCreditCard?cb=${encodeURIComponent(callback)}&gmoShopId=${gmoShopId}`;
        yield request.post({
            simple: false,
            url: 'https://api.line.me/v2/bot/message/push',
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: user.userId,
                messages: [
                    {
                        type: 'template',
                        altText: 'This is a buttons template',
                        template: {
                            type: 'confirm',
                            text: '本当に友達決済を承認しますか?',
                            actions: [
                                {
                                    type: 'uri',
                                    label: 'Yes',
                                    uri: creditCardUrl
                                },
                                {
                                    type: 'postback',
                                    label: 'No',
                                    data: `action=rejectFriendPay&token=${friendPayToken}`
                                }
                            ]
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.askConfirmationOfFriendPay = askConfirmationOfFriendPay;
/**
 * 予約のイベント日選択を求める
 * @export
 */
function askReservationEventDate(userId, paymentNo) {
    return __awaiter(this, void 0, void 0, function* () {
        yield request.post('https://api.line.me/v2/bot/message/push', {
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: userId,
                messages: [
                    {
                        type: 'template',
                        altText: '日付選択',
                        template: {
                            type: 'buttons',
                            text: 'ツアーの開演日を教えてください。',
                            actions: [
                                {
                                    type: 'datetimepicker',
                                    label: '日付選択',
                                    mode: 'date',
                                    data: `action=searchTransactionByPaymentNo&paymentNo=${paymentNo}`,
                                    initial: moment().format('YYYY-MM-DD')
                                }
                            ]
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.askReservationEventDate = askReservationEventDate;
/**
 * ユーザーのチケット(座席予約)を検索する
 */
function searchTickets(user) {
    return __awaiter(this, void 0, void 0, function* () {
        yield LINE.pushMessage(user.userId, '座席予約を検索しています...');
        const orderRepo = new sskts.repository.Order(sskts.mongoose.connection);
        const orders = yield orderRepo.orderModel.find({
            orderDate: { $gt: moment().add(-1, 'month').toDate() },
            'customer.memberOf.membershipNumber': {
                $exists: true,
                $eq: user.userId
            },
            'customer.memberOf.programName': {
                $exists: true,
                $eq: 'LINE'
            }
        }).exec().then((docs) => docs.map((doc) => doc.toObject()));
        yield LINE.pushMessage(user.userId, `${orders.length}件の注文が見つかりました。`);
        if (orders.length > 0) {
            const itemsOffered = [];
            orders.forEach((order) => {
                itemsOffered.push(...order.acceptedOffers.map((o) => o.itemOffered));
            });
            yield request.post({
                simple: false,
                url: 'https://api.line.me/v2/bot/message/push',
                auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
                json: true,
                body: {
                    to: user.userId,
                    messages: [
                        {
                            type: 'template',
                            altText: '座席予約チケット',
                            template: {
                                type: 'carousel',
                                columns: itemsOffered.map((itemOffered) => {
                                    // tslint:disable-next-line:max-line-length
                                    const qr = `https://chart.apis.google.com/chart?chs=300x300&cht=qr&chl=${itemOffered.reservedTicket.ticketToken}`;
                                    const text = util.format('%s-%s\n@%s\n%s', moment(itemOffered.reservationFor.startDate).format('YYYY-MM-DD HH:mm'), moment(itemOffered.reservationFor.endDate).format('HH:mm'), 
                                    // tslint:disable-next-line:max-line-length
                                    `${itemOffered.reservationFor.superEvent.location.name.ja} ${itemOffered.reservationFor.location.name.ja}`, 
                                    // tslint:disable-next-line:max-line-length
                                    `${itemOffered.reservedTicket.ticketedSeat.seatNumber} ${itemOffered.reservedTicket.coaTicketInfo.ticketName} ￥${itemOffered.reservedTicket.coaTicketInfo.salePrice}`);
                                    return {
                                        thumbnailImageUrl: qr,
                                        // imageBackgroundColor: '#000000',
                                        title: itemOffered.reservationFor.name.ja,
                                        // tslint:disable-next-line:max-line-length
                                        text: text,
                                        actions: [
                                            {
                                                type: 'postback',
                                                label: 'チケット認証リクエスト',
                                                data: `action=requestTicketAuthentication&ticketToken=${itemOffered.reservedTicket.ticketToken}`
                                            },
                                            {
                                                type: 'postback',
                                                label: '飲食を注文する',
                                                data: `action=orderMenuItems&ticketToken=${itemOffered.reservedTicket.ticketToken}`
                                            }
                                        ]
                                    };
                                }),
                                imageAspectRatio: 'square'
                                // imageAspectRatio: 'rectangle',
                                // imageSize: 'cover'
                            }
                        }
                    ]
                }
            }).promise();
        }
    });
}
exports.searchTickets = searchTickets;
/**
 * 日付選択を求める
 * @export
 */
function askEventStartDate(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield request.post('https://api.line.me/v2/bot/message/push', {
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: userId,
                messages: [
                    {
                        type: 'template',
                        altText: '日付選択',
                        template: {
                            type: 'buttons',
                            text: '上映日は？',
                            actions: [
                                {
                                    type: 'datetimepicker',
                                    label: '日付選択',
                                    mode: 'date',
                                    data: 'action=searchEventsByDate',
                                    initial: moment().add(1, 'days').format('YYYY-MM-DD'),
                                    // tslint:disable-next-line:no-magic-numbers
                                    max: moment().add(2, 'days').format('YYYY-MM-DD'),
                                    min: moment().add(1, 'days').format('YYYY-MM-DD')
                                }
                            ]
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.askEventStartDate = askEventStartDate;
/**
 * 日付選択を求める
 * @export
 */
function askFromWhenAndToWhen(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // await LINE.pushMessage(userId, '期間をYYYYMMDD-YYYYMMDD形式で教えてください。');
        yield request.post('https://api.line.me/v2/bot/message/push', {
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: userId,
                messages: [
                    {
                        type: 'template',
                        altText: '日付選択',
                        template: {
                            type: 'buttons',
                            text: '日付を選択するか、期間をYYYYMMDD-YYYYMMDD形式で教えてください。',
                            actions: [
                                {
                                    type: 'datetimepicker',
                                    label: '日付選択',
                                    mode: 'date',
                                    data: 'action=searchTransactionsByDate',
                                    initial: moment().format('YYYY-MM-DD')
                                }
                            ]
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.askFromWhenAndToWhen = askFromWhenAndToWhen;
/**
 * 取引CSVダウンロードURIを発行する
 * @export
 */
function publishURI4transactionsCSV(userId, dateFrom, dateThrough) {
    return __awaiter(this, void 0, void 0, function* () {
        yield LINE.pushMessage(userId, `${dateFrom} - ${dateThrough}の取引を検索しています...`);
        const startFrom = moment(`${dateFrom}T00: 00: 00 + 09: 00`, 'YYYYMMDDThh:mm:ssZ');
        const startThrough = moment(`${dateThrough}T00: 00: 00 + 09: 00`, 'YYYYMMDDThh:mm:ssZ').add(1, 'day');
        const csv = yield sskts.service.transaction.placeOrder.download({
            startFrom: startFrom.toDate(),
            startThrough: startThrough.toDate()
        }, 'csv')({ transaction: new sskts.repository.Transaction(sskts.mongoose.connection) });
        yield LINE.pushMessage(userId, 'csvを作成しています...');
        const sasUrl = yield sskts.service.util.uploadFile({
            fileName: `sskts - line - ticket - transactions - ${moment().format('YYYYMMDDHHmmss')}.csv`,
            text: csv
        })();
        yield LINE.pushMessage(userId, `download -> ${sasUrl} `);
    });
}
exports.publishURI4transactionsCSV = publishURI4transactionsCSV;
function logout(user) {
    return __awaiter(this, void 0, void 0, function* () {
        yield request.post({
            simple: false,
            url: LINE.URL_PUSH_MESSAGE,
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: user.userId,
                messages: [
                    {
                        type: 'template',
                        altText: 'ログアウトボタン',
                        template: {
                            type: 'buttons',
                            text: '本当にログアウトしますか？',
                            actions: [
                                {
                                    type: 'uri',
                                    label: 'Log out',
                                    uri: `https://${user.host}/logout?userId=${user.userId}`
                                }
                            ]
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.logout = logout;
