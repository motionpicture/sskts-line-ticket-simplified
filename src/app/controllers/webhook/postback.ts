/**
 * LINE webhook postbackコントローラー
 * @namespace app.controllers.webhook.postback
 */

import * as ssktsapi from '@motionpicture/sskts-api-nodejs-client';
import * as sskts from '@motionpicture/sskts-domain';
import * as createDebug from 'debug';
import { google } from 'googleapis';
import * as moment from 'moment';
import * as request from 'request-promise-native';
import * as util from 'util';

import * as LINE from '../../../line';
import User from '../../user';

const debug = createDebug('sskts-line-ticket-simplified:controller:webhook:postback');
// const MESSAGE_TRANSACTION_NOT_FOUND = '該当取引はありません';

const customsearch = google.customsearch('v1');

/**
 * 購入番号で取引を検索する
 * @export
 */
export async function searchTransactionByPaymentNo(userId: string, paymentNo: string, performanceDate: string) {
    await LINE.pushMessage(userId, `${performanceDate}-${paymentNo}の取引を検索しています...`);
    await LINE.pushMessage(userId, 'implementing...');
}

/**
 * 取引IDから取引情報詳細を送信する
 * @export
 * @param {string} userId LINEユーザーID
 * @param {string} transactionId 取引ID
 */
// tslint:disable-next-line:cyclomatic-complexity max-func-body-length
// async function pushTransactionDetails(userId: string, orderNumber: string) {
//     await LINE.pushMessage(userId, `${orderNumber}の取引詳細をまとめています...`);
//     await LINE.pushMessage(userId, 'implementing...');
// }

/**
 * 日付でイベント検索
 * @export
 * @param {string} userId
 * @param {string} date YYYY-MM-DD形式
 */
export async function searchEventsByDate(user: User, date: string) {
    await LINE.pushMessage(user.userId, `${date}のイベントを検索しています...`);

    const eventService = new ssktsapi.service.Event({
        endpoint: <string>process.env.API_ENDPOINT,
        auth: user.authClient
    });
    let events = await eventService.searchIndividualScreeningEvent({
        startFrom: moment(`${date}T00:00:00+09:00`).toDate(),
        startThrough: moment(`${date}T00:00:00+09:00`).add(1, 'day').toDate()
    });
    // tslint:disable-next-line:no-magic-numbers
    events = events.slice(0, 10);

    await LINE.pushMessage(user.userId, `${events.length}件のイベントがみつかりました。`);

    // googleで画像検索
    const CX = '006320166286449124373:nm_gjsvlgnm';
    const API_KEY = 'AIzaSyBP1n1HhsS4_KFADZMcBCFOqqSmIgOHAYI';
    const thumbnails: any[] = [];
    await Promise.all(events.map(async (event) => {
        return new Promise((resolve) => {
            customsearch.cse.list(
                {
                    cx: CX,
                    q: event.workPerformed.name,
                    auth: API_KEY,
                    num: 1,
                    rights: 'cc_publicdomain cc_sharealike',
                    // start: 0,
                    // imgSize: 'small',
                    searchType: 'image'
                },
                (err: any, res: any) => {
                    if (!(err instanceof Error)) {
                        if (Array.isArray(res.data.items) && res.data.items.length > 0) {
                            debug(res.data.items[0]);
                            thumbnails.push({
                                eventIdentifier: event.identifier,
                                link: res.data.items[0].link,
                                thumbnailLink: res.data.items[0].image.thumbnailLink
                            });
                        }
                    }

                    resolve();
                }
            );
        });
    }));
    debug(thumbnails);

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
                    altText: 'this is a carousel template',
                    template: {
                        type: 'carousel',
                        columns: events.map((event) => {
                            const thumbnail = thumbnails.find((t) => t.eventIdentifier === event.identifier);
                            const thumbnailImageUrl = (thumbnail !== undefined)
                                ? thumbnail.thumbnailLink
                                // tslint:disable-next-line:max-line-length
                                : 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRrhpsOJOcLBwc1SPD9sWlinildy4S05-I2Wf6z2wRXnSxbmtRz';

                            return {
                                // tslint:disable-next-line:max-line-length no-http-string
                                thumbnailImageUrl: thumbnailImageUrl,
                                imageBackgroundColor: '#000000',
                                title: event.workPerformed.name,
                                text: `${event.superEvent.location.name.ja} ${event.location.name.ja}`,
                                actions: [
                                    {
                                        type: 'postback',
                                        label: '座席確保',
                                        data: `action=createTmpReservation&eventIdentifier=${event.identifier}`
                                    }
                                ]
                            };
                        })
                        // imageAspectRatio: 'rectangle',
                        // imageSize: 'cover'
                    }
                }
            ]
        }
    }).promise();
}

/**
 * 座席仮予約
 * @export
 */
// tslint:disable-next-line:max-func-body-length
export async function createTmpReservation(user: User, eventIdentifier: string) {
    // イベント詳細取得
    const eventService = new ssktsapi.service.Event({
        endpoint: <string>process.env.API_ENDPOINT,
        auth: user.authClient
    });
    const event = await eventService.findIndividualScreeningEvent({ identifier: eventIdentifier });
    await LINE.pushMessage(user.userId, `${event.workPerformed.name}の座席を確保しています...`);

    // 販売者情報取得
    const organizationService = new ssktsapi.service.Organization({
        endpoint: <string>process.env.API_ENDPOINT,
        auth: user.authClient
    });
    const seller = await organizationService.findMovieTheaterByBranchCode({ branchCode: event.superEvent.location.branchCode });

    // 取引開始
    // 許可証トークンパラメーターがなければ、WAITERで許可証を取得
    const passportToken = await request.post(
        `${process.env.WAITER_ENDPOINT}/passports`,
        {
            body: {
                scope: `placeOrderTransaction.${seller.identifier}`
            },
            json: true
        }
    ).then((body) => body.token);
    debug('passportToken published.', passportToken);
    const placeOrderService = new ssktsapi.service.transaction.PlaceOrder({
        endpoint: <string>process.env.API_ENDPOINT,
        auth: user.authClient
    });
    const transaction = await placeOrderService.start({
        // tslint:disable-next-line:no-magic-numbers
        expires: moment().add(15, 'minutes').toDate(),
        sellerId: seller.id,
        passportToken: passportToken
    });
    debug('transaction started.', transaction.id);

    // 現時点でLINEユーザー情報を取引に連携する仕組みがapiにはないので、DBを直接編集する
    const programMembership: any = {
        membershipNumber: user.userId,
        programName: 'LINE'
    };
    const transactionRepo = new sskts.repository.Transaction(sskts.mongoose.connection);
    await transactionRepo.transactionModel.findByIdAndUpdate(transaction.id, {
        'agent.memberOf': programMembership
    }).exec();

    // 座席選択

    const salesTicketResult = await sskts.COA.services.reserve.salesTicket({
        theaterCode: event.coaInfo.theaterCode,
        dateJouei: event.coaInfo.dateJouei,
        titleCode: event.coaInfo.titleCode,
        titleBranchNum: event.coaInfo.titleBranchNum,
        timeBegin: event.coaInfo.timeBegin,
        flgMember: sskts.COA.services.reserve.FlgMember.NonMember
    }).then((results) => results.filter((result) => result.limitUnit === '001' && result.limitCount === 1));
    debug('salesTicketResult:', salesTicketResult);

    // search available seats from sskts.COA
    const getStateReserveSeatResult = await sskts.COA.services.reserve.stateReserveSeat({
        theaterCode: event.coaInfo.theaterCode,
        dateJouei: event.coaInfo.dateJouei,
        titleCode: event.coaInfo.titleCode,
        titleBranchNum: event.coaInfo.titleBranchNum,
        timeBegin: event.coaInfo.timeBegin,
        screenCode: event.coaInfo.screenCode
    });
    debug('getStateReserveSeatResult:', getStateReserveSeatResult);
    const sectionCode = getStateReserveSeatResult.listSeat[0].seatSection;
    const freeSeatCodes = getStateReserveSeatResult.listSeat[0].listFreeSeat.map((freeSeat) => {
        return freeSeat.seatNum;
    });
    debug('sectionCode:', sectionCode);
    debug('freeSeatCodes:', freeSeatCodes);
    if (getStateReserveSeatResult.cntReserveFree <= 0) {
        throw new Error('no available seats');
    }
    // select a seat randomly
    // tslint:disable-next-line:insecure-random
    const selectedSeatCode = freeSeatCodes[Math.floor(freeSeatCodes.length * Math.random())];
    // select a ticket randomly
    // tslint:disable-next-line:insecure-random
    const selectedSalesTicket = salesTicketResult[Math.floor(salesTicketResult.length * Math.random())];

    debug('creating a seat reservation authorization...');
    const seatReservationAuthorization = await placeOrderService.createSeatReservationAuthorization({
        transactionId: transaction.id,
        eventIdentifier: event.identifier,
        offers: [
            {
                seatSection: sectionCode,
                seatNumber: selectedSeatCode,
                ticketInfo: {
                    ticketCode: selectedSalesTicket.ticketCode,
                    mvtkAppPrice: 0,
                    ticketCount: 1,
                    addGlasses: selectedSalesTicket.addGlasses,
                    kbnEisyahousiki: '00',
                    mvtkNum: '',
                    mvtkKbnDenshiken: '00',
                    mvtkKbnMaeuriken: '00',
                    mvtkKbnKensyu: '00',
                    mvtkSalesPrice: 0
                }
            }
        ]
    });
    debug('seatReservationAuthorization:', seatReservationAuthorization);
    await LINE.pushMessage(user.userId, `座席 ${selectedSeatCode} を確保しました。`);

    const LINE_ID = process.env.LINE_ID;
    const token = await user.signFriendPayInfo({
        transactionId: transaction.id,
        userId: user.userId,
        price: (<sskts.factory.action.authorize.seatReservation.IResult>seatReservationAuthorization.result).price
    });
    const friendMessage = `FriendPayToken.${token}`;
    const message = encodeURIComponent(`僕の代わりに決済をお願いできますか？よければ、下のリンクを押してそのままメッセージを送信してください。
line://oaMessage/${LINE_ID}/?${friendMessage}`);
    const friendPayUrl = `line://msg/text/?${message}`;

    const gmoShopId = 'tshop00026096';
    const creditCardCallback = `https://${user.host}/transactions/${transaction.id}/inputCreditCard?userId=${user.userId}`;
    // tslint:disable-next-line:max-line-length
    const creditCardUrl = `https://${user.host}/transactions/inputCreditCard?cb=${encodeURIComponent(creditCardCallback)}&gmoShopId=${gmoShopId}`;

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
                        type: 'buttons',
                        title: '決済方法選択',
                        text: '決済方法を選択してください。Friend Payの場合、ボタンを押して友達を選択してください。',
                        actions: [
                            {
                                type: 'uri',
                                label: 'Credit Card',
                                uri: creditCardUrl
                            },
                            {
                                type: 'postback',
                                label: 'Pecorino',
                                data: `action=choosePaymentMethod&paymentMethod=Pecorino&transactionId=${transaction.id}`
                            },
                            {
                                type: 'uri',
                                label: 'Friend Pay',
                                uri: friendPayUrl
                            }
                        ]
                    }
                }
            ]
        }
    }).promise();
}

export type PaymentMethodType = 'CreditCard' | 'Pecorino' | 'FriendPay';

// tslint:disable-next-line:max-func-body-length
export async function choosePaymentMethod(params: {
    user: User;
    paymentMethod: PaymentMethodType;
    transactionId: string;
    friendPayPrice?: number;
    creditCardToken?: string;
}) {
    const placeOrderService = new ssktsapi.service.transaction.PlaceOrder({
        endpoint: <string>process.env.API_ENDPOINT,
        auth: params.user.authClient
    });

    let price: number;

    switch (params.paymentMethod) {
        case 'Pecorino':
            debug('checking balance...', params.paymentMethod, params.transactionId);
            throw new Error('Pecorino account not found.');

        case 'CreditCard':
            const token = params.creditCardToken;
            if (token === undefined) {
                throw new Error('Credit card token not found.');
            }

            await LINE.pushMessage(params.user.userId, 'クレジットカード情報を確認中です...');

            const actionRepo = new sskts.repository.Action(sskts.mongoose.connection);
            let seatReservations = await actionRepo.findAuthorizeByTransactionId(params.transactionId);
            seatReservations = seatReservations
                .filter((a) => a.actionStatus === ssktsapi.factory.actionStatusType.CompletedActionStatus)
                .filter((a) => a.object.typeOf === ssktsapi.factory.action.authorize.seatReservation.ObjectType.SeatReservation);
            price = seatReservations[0].result.price;

            const orderIdPrefix = util.format(
                '%s%s%s',
                moment().format('YYYYMMDD'),
                '999',
                // tslint:disable-next-line:no-magic-numbers
                `00000000${seatReservations[0].result.updTmpReserveSeatResult.tmpReserveNum}`.slice(-8)
            );

            const creditCardAuthorizeAction = await placeOrderService.createCreditCardAuthorization({
                transactionId: params.transactionId,
                orderId: `${orderIdPrefix}01`,
                amount: price,
                method: sskts.GMO.utils.util.Method.Lump,
                creditCard: { token }
            });
            debug('creditCardAuthorizeAction:', creditCardAuthorizeAction);
            await LINE.pushMessage(params.user.userId, 'クレジットカード情報を確認できました。');
            break;

        case 'FriendPay':
            if (params.friendPayPrice === undefined) {
                throw new Error('friendPayPrice undefined.');
            }

            // 友達によって決済が済んでいるので何もしない
            price = params.friendPayPrice;
            break;

        default:
            throw new Error(`Unknown payment method ${params.paymentMethod}`);
    }

    // LINEプロフィールを連絡先に部分的に使用
    const profile = await LINE.getProfile(params.user.userId);
    const contact = {
        givenName: profile.displayName,
        familyName: profile.userId,
        telephone: '+819012345678',
        email: 'hello@motionpicture.jp'
    };
    await placeOrderService.setCustomerContact({
        transactionId: params.transactionId,
        contact: contact
    });
    debug('customer contact set.');
    await LINE.pushMessage(params.user.userId, `以下の通り注文を受け付けようとしています...
------------
購入者情報
------------
${contact.givenName} ${contact.familyName}
${contact.email}
${contact.telephone}

------------
決済方法
------------
${params.paymentMethod}
${price} JPY
`);

    // 注文内容確認
    await request.post({
        simple: false,
        url: 'https://api.line.me/v2/bot/message/push',
        auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
        json: true,
        body: {
            to: params.user.userId,
            messages: [
                {
                    type: 'template',
                    altText: 'This is a buttons template',
                    template: {
                        type: 'confirm',
                        text: '注文を確定しますか？',
                        actions: [
                            {
                                type: 'postback',
                                label: 'Yes',
                                data: `action=confirmOrder&transactionId=${params.transactionId}`
                            },
                            {
                                type: 'postback',
                                label: 'No',
                                data: `action=cancelOrder&transactionId=${params.transactionId}`
                            }
                        ]
                    }
                }
            ]
        }
    }).promise();
}

export async function confirmOrder(user: User, transactionId: string) {
    await LINE.pushMessage(user.userId, '注文を確定しています...');

    const placeOrderService = new ssktsapi.service.transaction.PlaceOrder({
        endpoint: <string>process.env.API_ENDPOINT,
        auth: user.authClient
    });
    const order = await placeOrderService.confirm({
        transactionId: transactionId
    });
    const event = order.acceptedOffers[0].itemOffered.reservationFor;
    const reservedTickets = order.acceptedOffers.map(
        // tslint:disable-next-line:max-line-length
        (orderItem) => `${orderItem.itemOffered.reservedTicket.ticketedSeat.seatNumber} ${orderItem.itemOffered.reservedTicket.coaTicketInfo.ticketName} ￥${orderItem.itemOffered.reservedTicket.coaTicketInfo.salePrice}`
    ).join('\n');

    const orderDetails = `--------------------
注文内容
--------------------
予約番号: ${order.confirmationNumber}
--------------------
購入者情報
--------------------
${order.customer.name}
${order.customer.telephone}
${order.customer.email}
${(order.customer.memberOf !== undefined) ? `${order.customer.memberOf.programName}` : ''}
${(order.customer.memberOf !== undefined) ? `${order.customer.memberOf.membershipNumber}` : ''}
--------------------
座席予約
--------------------
${order.acceptedOffers[0].itemOffered.reservationFor.name.ja}
${moment(event.startDate).format('YYYY-MM-DD HH:mm')}-${moment(event.endDate).format('HH:mm')}
@${event.superEvent.location.name.ja} ${event.location.name.ja}
${reservedTickets}
--------------------
決済方法
--------------------
${order.paymentMethods.map((p) => p.paymentMethod).join(' ')}
${order.price}
--------------------
割引
--------------------
`;
    await LINE.pushMessage(user.userId, orderDetails);

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
                    altText: 'this is a carousel template',
                    template: {
                        type: 'carousel',
                        columns: order.acceptedOffers.map((offer) => {
                            const itemOffered = offer.itemOffered;
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
                        // imageSize: 'cover'
                    }
                }
            ]
        }
    }).promise();
}

/**
 * 友達決済を承認確定
 */
export async function confirmFriendPay(user: User, friendPayToken: string, creditCardToken: string) {
    const friendPayInfo = await user.verifyFriendPayToken(friendPayToken);

    await LINE.pushMessage(user.userId, `${friendPayInfo.price}円の友達決済を受け付けます。`);
    await LINE.pushMessage(user.userId, 'クレジットカード情報を確認中です...');

    const placeOrderService = new ssktsapi.service.transaction.PlaceOrder({
        endpoint: <string>process.env.API_ENDPOINT,
        auth: user.authClient
    });

    const actionRepo = new sskts.repository.Action(sskts.mongoose.connection);
    let seatReservations = await actionRepo.findAuthorizeByTransactionId(friendPayInfo.transactionId);
    seatReservations = seatReservations
        .filter((a) => a.actionStatus === ssktsapi.factory.actionStatusType.CompletedActionStatus)
        .filter((a) => a.object.typeOf === ssktsapi.factory.action.authorize.seatReservation.ObjectType.SeatReservation);

    const orderIdPrefix = util.format(
        '%s%s%s',
        moment().format('YYYYMMDD'),
        '999',
        // tslint:disable-next-line:no-magic-numbers
        `00000000${seatReservations[0].result.updTmpReserveSeatResult.tmpReserveNum}`.slice(-8)
    );

    const creditCardAuthorizeAction = await placeOrderService.createCreditCardAuthorization({
        transactionId: friendPayInfo.transactionId,
        orderId: `${orderIdPrefix}01`,
        amount: friendPayInfo.price,
        method: sskts.GMO.utils.util.Method.Lump,
        creditCard: { token: creditCardToken }
    });
    debug('creditCardAuthorizeAction:', creditCardAuthorizeAction);
    await LINE.pushMessage(user.userId, 'クレジットカード情報を確認できました。');
    await LINE.pushMessage(user.userId, '友達決済を承認しました。');

    await request.post({
        simple: false,
        url: 'https://api.line.me/v2/bot/message/push',
        auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
        json: true,
        body: {
            to: friendPayInfo.userId,
            messages: [
                {
                    type: 'template',
                    altText: 'This is a buttons template',
                    template: {
                        type: 'confirm',
                        text: '友達決済の承認が確認できました。取引を続行しますか?',
                        actions: [
                            {
                                type: 'postback',
                                label: 'Yes',
                                // tslint:disable-next-line:max-line-length
                                data: `action=continueTransactionAfterFriendPayConfirmation&transactionId=${friendPayInfo.transactionId}&price=${friendPayInfo.price}`
                            },
                            {
                                type: 'postback',
                                label: 'No',
                                // tslint:disable-next-line:max-line-length
                                data: `action=cancelTransactionAfterFriendPayConfirmation&transactionId=${friendPayInfo.transactionId}&price=${friendPayInfo.price}`
                            }
                        ]
                    }
                }
            ]
        }
    }).promise();
}

/**
 * 取引検索(csvダウンロード)
 * @export
 * @param {string} userId
 * @param {string} date YYYY-MM-DD形式
 */
export async function searchTransactionsByDate(userId: string, date: string) {
    await LINE.pushMessage(userId, `${date}の取引を検索しています...`);

    const startFrom = moment(`${date}T00:00:00+09:00`);
    const startThrough = moment(`${date}T00:00:00+09:00`).add(1, 'day');

    const csv = await sskts.service.transaction.placeOrder.download(
        {
            startFrom: startFrom.toDate(),
            startThrough: startThrough.toDate()
        },
        'csv'
    )({ transaction: new sskts.repository.Transaction(sskts.mongoose.connection) });

    await LINE.pushMessage(userId, 'csvを作成しています...');

    const sasUrl = await sskts.service.util.uploadFile({
        fileName: `sskts-line-ticket-simplified-transactions-${moment().format('YYYYMMDDHHmmss')}.csv`,
        text: csv
    })();

    await LINE.pushMessage(userId, `download -> ${sasUrl} `);
}
