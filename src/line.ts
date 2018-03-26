/**
 * LINEモジュール
 * @namespace line
 */

export interface IProfile {
    userId: string;
    displayName: string;
    pictureUrl: string;
    statusMessage: string;
}

export interface IMessage {
    id: string;
    // tslint:disable-next-line:no-reserved-keywords
    type: MessageType;
    text?: string;
    fileName?: string;
    fileSize?: number;
    packageId?: string;
    stickerId?: string;
    title?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
}

export enum MessageType {
    text = 'text',
    image = 'image',
    video = 'video',
    audio = 'audio',
    file = 'file',
    location = 'location',
    sticker = 'sticker'
}

export type IEventType = 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | 'postback' | 'beacon';
export interface IWebhookEvent {
    // tslint:disable-next-line:no-reserved-keywords
    type: IEventType;
    timestamp: number;
    source: {
        // tslint:disable-next-line:no-reserved-keywords
        type: 'user' | 'group' | 'room';
        userId: string;
        groupId?: string;
        roomId?: string;
    };
    message?: IMessage;
    postback?: any;
    replyToken?: string;
}

import * as createDebug from 'debug';
import * as request from 'request-promise-native';

const debug = createDebug('sskts-line-ticket-simplified:controller:line');

export const URL_PUSH_MESSAGE = 'https://api.line.me/v2/bot/message/push';

/**
 * メッセージ送信
 * @export
 * @function
 * @memberof app.controllers.line
 * @param {string} userId LINEユーザーID
 * @param {string} text メッセージ
 */
export async function pushMessage(userId: string, text: string) {
    debug('pushing a message...', text);
    // push message
    await request.post({
        simple: false,
        url: URL_PUSH_MESSAGE,
        auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
        json: true,
        body: {
            to: userId,
            messages: [
                {
                    type: 'text',
                    text: text
                }
            ]
        }
    }).promise();
}

/**
 * メッセージIDからユーザーが送信した画像、動画、および音声のデータを取得する
 * @param messageId メッセージID
 */
export async function getContent(messageId: string) {
    return request.get({
        encoding: null,
        simple: false,
        url: `https://api.line.me/v2/bot/message/${messageId}/content`,
        auth: { bearer: <string>process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN }
    }).promise();
}

/**
 * LINEプロフィールを取得する
 */
export async function getProfile(userId: string): Promise<IProfile> {
    return request.get({
        simple: false,
        url: `https://api.line.me/v2/bot/profile/${userId}`,
        auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
        json: true
    });
}
