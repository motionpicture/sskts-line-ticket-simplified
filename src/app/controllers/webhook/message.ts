/**
 * LINE webhook messageコントローラー
 * @namespace app.controllers.webhook.message
 */

import * as sskts from '@motionpicture/sskts-domain';
import * as moment from 'moment';
import * as request from 'request-promise-native';
import * as util from 'util';

import * as LINE from '../../../line';
import User from '../../user';

/**
 * 使い方を送信する
 * @export
 */
export async function pushHowToUse(userId: string) {
    await request.post({
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
}

/**
 * 座席予約メニューを表示する
 */
export async function showSeatReservationMenu(user: User) {
    await request.post({
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
}

/**
 * 顔写真登録を開始する
 */
export async function startIndexingFace(userId: string) {
    const text = '顔写真を送信してください。';

    await LINE.pushMessage(userId, text);
}

/**
 * 友達決済承認確認
 */
export async function askConfirmationOfFriendPay(user: User, friendPayToken: string) {
    const gmoShopId = 'tshop00026096';
    const callback = `https://${user.host}/transactions/payment/friendPay/${friendPayToken}?userId=${user.userId}`;
    const creditCardUrl = `https://${user.host}/transactions/inputCreditCard?cb=${encodeURIComponent(callback)}&gmoShopId=${gmoShopId}`;

    await request.post({
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
}

/**
 * 予約のイベント日選択を求める
 * @export
 */
export async function askReservationEventDate(userId: string, paymentNo: string) {
    await request.post(
        'https://api.line.me/v2/bot/message/push',
        {
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: userId, // 送信相手のuserId
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
        }
    ).promise();
}

/**
 * ユーザーのチケット(座席予約)を検索する
 */
export async function searchTickets(user: User) {
    await LINE.pushMessage(user.userId, '座席予約を検索しています...');

    const orderRepo = new sskts.repository.Order(sskts.mongoose.connection);
    const orders = await orderRepo.orderModel.find({
        orderDate: { $gt: moment().add(-1, 'month').toDate() },
        'customer.memberOf.membershipNumber': {
            $exists: true,
            $eq: 'U28fba84b4008d60291fc861e2562b34f'
        },
        'customer.memberOf.programName': {
            $exists: true,
            $eq: 'LINE'
        }
    }).exec().then((docs) => docs.map((doc) => <sskts.factory.order.IOrder>doc.toObject()));

    await LINE.pushMessage(user.userId, `${orders.length}件の注文が見つかりました。`);

    if (orders.length > 0) {
        const itemsOffered: sskts.factory.order.IItemOffered[] = [];
        orders.forEach((order) => {
            itemsOffered.push(...order.acceptedOffers.map((o) => o.itemOffered));
        });

        await request.post({
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
                                const text = util.format(
                                    '%s-%s\n@%s\n%s',
                                    moment(itemOffered.reservationFor.startDate).format('YYYY-MM-DD HH:mm'),
                                    moment(itemOffered.reservationFor.endDate).format('HH:mm'),
                                    // tslint:disable-next-line:max-line-length
                                    `${itemOffered.reservationFor.superEvent.location.name.ja} ${itemOffered.reservationFor.location.name.ja}`,
                                    // tslint:disable-next-line:max-line-length
                                    `${itemOffered.reservedTicket.ticketedSeat.seatNumber} ${itemOffered.reservedTicket.coaTicketInfo.ticketName} ￥${itemOffered.reservedTicket.coaTicketInfo.salePrice}`
                                );

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
                                            data: `action=&ticketToken=${itemOffered.reservedTicket.ticketToken}`
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
}

/**
 * 日付選択を求める
 * @export
 */
export async function askEventStartDate(userId: string) {
    await request.post(
        'https://api.line.me/v2/bot/message/push',
        {
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: userId, // 送信相手のuserId
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
        }
    ).promise();
}

/**
 * 日付選択を求める
 * @export
 */
export async function askFromWhenAndToWhen(userId: string) {
    // await LINE.pushMessage(userId, '期間をYYYYMMDD-YYYYMMDD形式で教えてください。');
    await request.post(
        'https://api.line.me/v2/bot/message/push',
        {
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: userId, // 送信相手のuserId
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
        }
    ).promise();
}

/**
 * 取引CSVダウンロードURIを発行する
 * @export
 */
export async function publishURI4transactionsCSV(userId: string, dateFrom: string, dateThrough: string) {
    await LINE.pushMessage(userId, `${dateFrom} - ${dateThrough}の取引を検索しています...`);

    const startFrom = moment(`${dateFrom}T00: 00: 00 + 09: 00`, 'YYYYMMDDThh:mm:ssZ');
    const startThrough = moment(`${dateThrough}T00: 00: 00 + 09: 00`, 'YYYYMMDDThh:mm:ssZ').add(1, 'day');

    const csv = await sskts.service.transaction.placeOrder.download(
        {
            startFrom: startFrom.toDate(),
            startThrough: startThrough.toDate()
        },
        'csv'
    )({ transaction: new sskts.repository.Transaction(sskts.mongoose.connection) });

    await LINE.pushMessage(userId, 'csvを作成しています...');

    const sasUrl = await sskts.service.util.uploadFile({
        fileName: `sskts - line - ticket - transactions - ${moment().format('YYYYMMDDHHmmss')}.csv`,
        text: csv
    })();

    await LINE.pushMessage(userId, `download -> ${sasUrl} `);
}

export async function logout(user: User) {
    await request.post({
        simple: false,
        url: LINE.URL_PUSH_MESSAGE,
        auth: { bearer: <string>process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
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
}
