"use strict";
/**
 * LINE webhook postbackコントローラー
 * @namespace app.controllers.webhook.postback
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
const ssktsapi = require("@motionpicture/sskts-api-nodejs-client");
const sskts = require("@motionpicture/sskts-domain");
const createDebug = require("debug");
const googleapis_1 = require("googleapis");
const moment = require("moment");
const request = require("request-promise-native");
const util = require("util");
const LINE = require("../../../line");
const debug = createDebug('sskts-line-ticket-simplified:controller:webhook:postback');
// const MESSAGE_TRANSACTION_NOT_FOUND = '該当取引はありません';
const customsearch = googleapis_1.google.customsearch('v1');
/**
 * 購入番号で取引を検索する
 * @export
 */
function searchTransactionByPaymentNo(userId, paymentNo, performanceDate) {
    return __awaiter(this, void 0, void 0, function* () {
        yield LINE.pushMessage(userId, `${performanceDate}-${paymentNo}の取引を検索しています...`);
        yield LINE.pushMessage(userId, 'implementing...');
    });
}
exports.searchTransactionByPaymentNo = searchTransactionByPaymentNo;
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
function searchEventsByDate(user, date) {
    return __awaiter(this, void 0, void 0, function* () {
        yield LINE.pushMessage(user.userId, `${date}のイベントを検索しています...`);
        const eventService = new ssktsapi.service.Event({
            endpoint: process.env.API_ENDPOINT,
            auth: user.authClient
        });
        let events = yield eventService.searchIndividualScreeningEvent({
            startFrom: moment(`${date}T00:00:00+09:00`).toDate(),
            startThrough: moment(`${date}T00:00:00+09:00`).add(1, 'day').toDate()
        });
        // tslint:disable-next-line:no-magic-numbers
        events = events.slice(0, 10);
        yield LINE.pushMessage(user.userId, `${events.length}件のイベントがみつかりました。`);
        // googleで画像検索
        const CX = '006320166286449124373:nm_gjsvlgnm';
        const API_KEY = 'AIzaSyBP1n1HhsS4_KFADZMcBCFOqqSmIgOHAYI';
        const thumbnails = [];
        yield Promise.all(events.map((event) => __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                customsearch.cse.list({
                    cx: CX,
                    q: event.workPerformed.name,
                    auth: API_KEY,
                    num: 1,
                    rights: 'cc_publicdomain cc_sharealike',
                    // start: 0,
                    // imgSize: 'small',
                    searchType: 'image'
                }, (err, res) => {
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
                });
            });
        })));
        debug(thumbnails);
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
    });
}
exports.searchEventsByDate = searchEventsByDate;
/**
 * 座席仮予約
 * @export
 */
// tslint:disable-next-line:max-func-body-length
function createTmpReservation(user, eventIdentifier) {
    return __awaiter(this, void 0, void 0, function* () {
        // イベント詳細取得
        const eventService = new ssktsapi.service.Event({
            endpoint: process.env.API_ENDPOINT,
            auth: user.authClient
        });
        const event = yield eventService.findIndividualScreeningEvent({ identifier: eventIdentifier });
        yield LINE.pushMessage(user.userId, `${event.workPerformed.name}の座席を確保しています...`);
        // 販売者情報取得
        const organizationService = new ssktsapi.service.Organization({
            endpoint: process.env.API_ENDPOINT,
            auth: user.authClient
        });
        const seller = yield organizationService.findMovieTheaterByBranchCode({ branchCode: event.superEvent.location.branchCode });
        // 取引開始
        // 許可証トークンパラメーターがなければ、WAITERで許可証を取得
        const passportToken = yield request.post(`${process.env.WAITER_ENDPOINT}/passports`, {
            body: {
                scope: `placeOrderTransaction.${seller.identifier}`
            },
            json: true
        }).then((body) => body.token);
        debug('passportToken published.', passportToken);
        const placeOrderService = new ssktsapi.service.transaction.PlaceOrder({
            endpoint: process.env.API_ENDPOINT,
            auth: user.authClient
        });
        const transaction = yield placeOrderService.start({
            // tslint:disable-next-line:no-magic-numbers
            expires: moment().add(15, 'minutes').toDate(),
            sellerId: seller.id,
            passportToken: passportToken
        });
        debug('transaction started.', transaction.id);
        // 現時点でLINEユーザー情報を取引に連携する仕組みがapiにはないので、DBを直接編集する
        const programMembership = {
            membershipNumber: user.userId,
            programName: 'LINE'
        };
        const transactionRepo = new sskts.repository.Transaction(sskts.mongoose.connection);
        yield transactionRepo.transactionModel.findByIdAndUpdate(transaction.id, {
            'agent.memberOf': programMembership
        }).exec();
        // 座席選択
        const salesTicketResult = yield sskts.COA.services.reserve.salesTicket({
            theaterCode: event.coaInfo.theaterCode,
            dateJouei: event.coaInfo.dateJouei,
            titleCode: event.coaInfo.titleCode,
            titleBranchNum: event.coaInfo.titleBranchNum,
            timeBegin: event.coaInfo.timeBegin,
            flgMember: sskts.COA.services.reserve.FlgMember.NonMember
        }).then((results) => results.filter((result) => result.limitUnit === '001' && result.limitCount === 1));
        debug('salesTicketResult:', salesTicketResult);
        // search available seats from sskts.COA
        const getStateReserveSeatResult = yield sskts.COA.services.reserve.stateReserveSeat({
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
        const seatReservationAuthorization = yield placeOrderService.createSeatReservationAuthorization({
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
        yield LINE.pushMessage(user.userId, `座席 ${selectedSeatCode} を確保しました。`);
        const LINE_ID = process.env.LINE_ID;
        const token = yield user.signFriendPayInfo({
            transactionId: transaction.id,
            userId: user.userId,
            price: seatReservationAuthorization.result.price
        });
        const friendMessage = `FriendPayToken.${token}`;
        const message = encodeURIComponent(`僕の代わりに決済をお願いできますか？よければ、下のリンクを押してそのままメッセージを送信してください。
line://oaMessage/${LINE_ID}/?${friendMessage}`);
        const friendPayUrl = `line://msg/text/?${message}`;
        const gmoShopId = 'tshop00026096';
        const creditCardCallback = `https://${user.host}/transactions/${transaction.id}/inputCreditCard?userId=${user.userId}`;
        // tslint:disable-next-line:max-line-length
        const creditCardUrl = `https://${user.host}/transactions/inputCreditCard?cb=${encodeURIComponent(creditCardCallback)}&gmoShopId=${gmoShopId}`;
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
    });
}
exports.createTmpReservation = createTmpReservation;
// tslint:disable-next-line:max-func-body-length
function choosePaymentMethod(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const placeOrderService = new ssktsapi.service.transaction.PlaceOrder({
            endpoint: process.env.API_ENDPOINT,
            auth: params.user.authClient
        });
        let price;
        switch (params.paymentMethod) {
            case 'Pecorino':
                debug('checking balance...', params.paymentMethod, params.transactionId);
                throw new Error('Pecorino account not found.');
            case 'CreditCard':
                const token = params.creditCardToken;
                if (token === undefined) {
                    throw new Error('Credit card token not found.');
                }
                yield LINE.pushMessage(params.user.userId, 'クレジットカード情報を確認中です...');
                const actionRepo = new sskts.repository.Action(sskts.mongoose.connection);
                let seatReservations = yield actionRepo.findAuthorizeByTransactionId(params.transactionId);
                seatReservations = seatReservations
                    .filter((a) => a.actionStatus === ssktsapi.factory.actionStatusType.CompletedActionStatus)
                    .filter((a) => a.object.typeOf === ssktsapi.factory.action.authorize.seatReservation.ObjectType.SeatReservation);
                price = seatReservations[0].result.price;
                const orderIdPrefix = util.format('%s%s%s', moment().format('YYYYMMDD'), '999', 
                // tslint:disable-next-line:no-magic-numbers
                `00000000${seatReservations[0].result.updTmpReserveSeatResult.tmpReserveNum}`.slice(-8));
                const creditCardAuthorizeAction = yield placeOrderService.createCreditCardAuthorization({
                    transactionId: params.transactionId,
                    orderId: `${orderIdPrefix}01`,
                    amount: price,
                    method: sskts.GMO.utils.util.Method.Lump,
                    creditCard: { token }
                });
                debug('creditCardAuthorizeAction:', creditCardAuthorizeAction);
                yield LINE.pushMessage(params.user.userId, 'クレジットカード情報を確認できました。');
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
        const profile = yield LINE.getProfile(params.user.userId);
        const contact = {
            givenName: profile.displayName,
            familyName: profile.userId,
            telephone: '+819012345678',
            email: 'hello@motionpicture.jp'
        };
        yield placeOrderService.setCustomerContact({
            transactionId: params.transactionId,
            contact: contact
        });
        debug('customer contact set.');
        yield LINE.pushMessage(params.user.userId, `以下の通り注文を受け付けようとしています...
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
        yield request.post({
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
    });
}
exports.choosePaymentMethod = choosePaymentMethod;
function confirmOrder(user, transactionId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield LINE.pushMessage(user.userId, '注文を確定しています...');
        const placeOrderService = new ssktsapi.service.transaction.PlaceOrder({
            endpoint: process.env.API_ENDPOINT,
            auth: user.authClient
        });
        const order = yield placeOrderService.confirm({
            transactionId: transactionId
        });
        const event = order.acceptedOffers[0].itemOffered.reservationFor;
        const reservedTickets = order.acceptedOffers.map(
        // tslint:disable-next-line:max-line-length
        (orderItem) => `${orderItem.itemOffered.reservedTicket.ticketedSeat.seatNumber} ${orderItem.itemOffered.reservedTicket.coaTicketInfo.ticketName} ￥${orderItem.itemOffered.reservedTicket.coaTicketInfo.salePrice}`).join('\n');
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
        yield LINE.pushMessage(user.userId, orderDetails);
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
                        altText: 'this is a carousel template',
                        template: {
                            type: 'carousel',
                            columns: order.acceptedOffers.map((offer) => {
                                const itemOffered = offer.itemOffered;
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
                            // imageSize: 'cover'
                        }
                    }
                ]
            }
        }).promise();
    });
}
exports.confirmOrder = confirmOrder;
function requestTicketAuthentication(user, ticketToken) {
    return __awaiter(this, void 0, void 0, function* () {
        yield LINE.pushMessage(user.userId, 'チケット認証をリクエスト中...');
        // 管理ユーザーに結果を送信
        const adminUserId = process.env.ADMIN_USER_ID;
        if (adminUserId === undefined) {
            throw new Error('管理ユーザーIDが設定されていません。');
        }
        yield LINE.pushMessage(adminUserId, 'チケット認証リクエストを受信しました。所有権を検索しています...');
        const ownershipInfoRepo = new sskts.repository.OwnershipInfo(sskts.mongoose.connection);
        const ownershipInfos = yield ownershipInfoRepo.ownershipInfoModel.find({
            'typeOfGood.reservedTicket.ticketToken': {
                $exists: true,
                $eq: ticketToken
            }
        }).exec().then((docs) => docs.map((doc) => doc.toObject()));
        yield request.post({
            simple: false,
            url: 'https://api.line.me/v2/bot/message/push',
            auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
            json: true,
            body: {
                to: adminUserId,
                messages: [
                    {
                        type: 'template',
                        altText: 'this is a carousel template',
                        template: {
                            type: 'carousel',
                            columns: ownershipInfos.map((ownershipInfo) => {
                                const itemOffered = ownershipInfo.typeOfGood;
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
                                            label: '認証確認リクエスト',
                                            data: `action=&ticketToken=${itemOffered.reservedTicket.ticketToken}`
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
        yield LINE.pushMessage(user.userId, 'チケット認証をリクエストしました。');
    });
}
exports.requestTicketAuthentication = requestTicketAuthentication;
/**
 * 友達決済を承認確定
 */
function confirmFriendPay(user, friendPayToken, creditCardToken) {
    return __awaiter(this, void 0, void 0, function* () {
        const friendPayInfo = yield user.verifyFriendPayToken(friendPayToken);
        yield LINE.pushMessage(user.userId, `${friendPayInfo.price}円の友達決済を受け付けます。`);
        yield LINE.pushMessage(user.userId, 'クレジットカード情報を確認中です...');
        const placeOrderService = new ssktsapi.service.transaction.PlaceOrder({
            endpoint: process.env.API_ENDPOINT,
            auth: user.authClient
        });
        const actionRepo = new sskts.repository.Action(sskts.mongoose.connection);
        let seatReservations = yield actionRepo.findAuthorizeByTransactionId(friendPayInfo.transactionId);
        seatReservations = seatReservations
            .filter((a) => a.actionStatus === ssktsapi.factory.actionStatusType.CompletedActionStatus)
            .filter((a) => a.object.typeOf === ssktsapi.factory.action.authorize.seatReservation.ObjectType.SeatReservation);
        const orderIdPrefix = util.format('%s%s%s', moment().format('YYYYMMDD'), '999', 
        // tslint:disable-next-line:no-magic-numbers
        `00000000${seatReservations[0].result.updTmpReserveSeatResult.tmpReserveNum}`.slice(-8));
        const creditCardAuthorizeAction = yield placeOrderService.createCreditCardAuthorization({
            transactionId: friendPayInfo.transactionId,
            orderId: `${orderIdPrefix}01`,
            amount: friendPayInfo.price,
            method: sskts.GMO.utils.util.Method.Lump,
            creditCard: { token: creditCardToken }
        });
        debug('creditCardAuthorizeAction:', creditCardAuthorizeAction);
        yield LINE.pushMessage(user.userId, 'クレジットカード情報を確認できました。');
        yield LINE.pushMessage(user.userId, '友達決済を承認しました。');
        yield request.post({
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
    });
}
exports.confirmFriendPay = confirmFriendPay;
/**
 * 取引検索(csvダウンロード)
 * @export
 * @param {string} userId
 * @param {string} date YYYY-MM-DD形式
 */
function searchTransactionsByDate(userId, date) {
    return __awaiter(this, void 0, void 0, function* () {
        yield LINE.pushMessage(userId, `${date}の取引を検索しています...`);
        const startFrom = moment(`${date}T00:00:00+09:00`);
        const startThrough = moment(`${date}T00:00:00+09:00`).add(1, 'day');
        const csv = yield sskts.service.transaction.placeOrder.download({
            startFrom: startFrom.toDate(),
            startThrough: startThrough.toDate()
        }, 'csv')({ transaction: new sskts.repository.Transaction(sskts.mongoose.connection) });
        yield LINE.pushMessage(userId, 'csvを作成しています...');
        const sasUrl = yield sskts.service.util.uploadFile({
            fileName: `sskts-line-ticket-simplified-transactions-${moment().format('YYYYMMDDHHmmss')}.csv`,
            text: csv
        })();
        yield LINE.pushMessage(userId, `download -> ${sasUrl} `);
    });
}
exports.searchTransactionsByDate = searchTransactionsByDate;
