"use strict";
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
const AWS = require("aws-sdk");
const createDebug = require("debug");
const redis = require("ioredis");
const jwt = require("jsonwebtoken");
const debug = createDebug('sskts-line-ticket-simplified:user');
// 以下環境変数をセットすること
// AWS_ACCESS_KEY_ID
// AWS_SECRET_ACCESS_KEY
const rekognition = new AWS.Rekognition({
    apiVersion: '2016-06-27',
    region: 'us-west-2'
});
const redisClient = new redis({
    host: process.env.REDIS_HOST,
    // tslint:disable-next-line:no-magic-numbers
    port: parseInt(process.env.REDIS_PORT, 10),
    password: process.env.REDIS_KEY,
    tls: { servername: process.env.REDIS_HOST }
});
const USER_EXPIRES_IN_SECONDS = process.env.USER_EXPIRES_IN_SECONDS;
if (USER_EXPIRES_IN_SECONDS === undefined) {
    throw new Error('Environment variable USER_EXPIRES_IN_SECONDS required.');
}
// tslint:disable-next-line:no-magic-numbers
const EXPIRES_IN_SECONDS = parseInt(USER_EXPIRES_IN_SECONDS, 10);
const REFRESH_TOKEN_EXPIRES_IN_SECONDS_ENV = process.env.REFRESH_TOKEN_EXPIRES_IN_SECONDS;
if (REFRESH_TOKEN_EXPIRES_IN_SECONDS_ENV === undefined) {
    throw new Error('Environment variable REFRESH_TOKEN_EXPIRES_IN_SECONDS required.');
}
/**
 * LINEユーザー
 * @class
 * @see https://aws.amazon.com/blogs/mobile/integrating-amazon-cognito-user-pools-with-api-gateway/
 */
class User {
    constructor(configurations) {
        this.host = configurations.host;
        this.userId = configurations.userId;
        this.state = configurations.state;
        this.rekognitionCollectionId = `sskts-line-ticket-simplified-${this.userId}`;
        this.authClient = new ssktsapi.auth.ClientCredentials({
            domain: process.env.API_AUTHORIZE_SERVER_DOMAIN,
            clientId: process.env.API_CLIENT_ID,
            clientSecret: process.env.API_CLIENT_SECRET,
            scopes: [],
            state: ''
        });
    }
    getRefreshToken() {
        return __awaiter(this, void 0, void 0, function* () {
            return redisClient.get(`line-ticket.refreshToken.${this.userId}`)
                .then((value) => (value === null) ? null : value);
        });
    }
    logout() {
        return __awaiter(this, void 0, void 0, function* () {
            yield redisClient.del(`line-ticket.credentials.${this.userId}`);
        });
    }
    findTransaction() {
        return __awaiter(this, void 0, void 0, function* () {
            return redisClient.get(`transaction.${this.userId}`).then((value) => {
                return (value !== null) ? JSON.parse(value) : null;
            });
        });
    }
    saveTransaction(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redisClient.multi()
                .set(`transaction.${this.userId}`, JSON.stringify(transaction))
                .expire(`transaction.${this.userId}`, EXPIRES_IN_SECONDS, debug)
                .exec();
        });
    }
    saveCallbackState(state) {
        return __awaiter(this, void 0, void 0, function* () {
            yield redisClient.multi()
                .set(`line-ticket.callbackState.${this.userId}`, state)
                .expire(`line-ticket.callbackState.${this.userId}`, EXPIRES_IN_SECONDS, debug)
                .exec();
        });
    }
    findCallbackState() {
        return __awaiter(this, void 0, void 0, function* () {
            return redisClient.get(`line-ticket.callbackState.${this.userId}`).then((value) => {
                return (value !== null) ? JSON.parse(value) : null;
            });
        });
    }
    deleteCallbackState() {
        return __awaiter(this, void 0, void 0, function* () {
            yield redisClient.del(`line-ticket.callbackState.${this.userId}`);
        });
    }
    /**
     * 友達決済トークンをトークン化する
     */
    // tslint:disable-next-line:prefer-function-over-method
    signFriendPayInfo(friendPayInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                jwt.sign(friendPayInfo, 'secret', (err, encoded) => {
                    if (err instanceof Error) {
                        reject(err);
                    }
                    else {
                        resolve(encoded);
                    }
                });
            });
        });
    }
    /**
     * 友達決済トークンを検証する
     */
    // tslint:disable-next-line:prefer-function-over-method
    verifyFriendPayToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                jwt.verify(token, 'secret', (err, decoded) => {
                    if (err instanceof Error) {
                        reject(err);
                    }
                    else {
                        resolve(decoded);
                    }
                });
            });
        });
    }
    /**
     * 友達決済トークンをトークン化する
     */
    // tslint:disable-next-line:prefer-function-over-method
    signTransferMoneyInfo(transferMoneyInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                jwt.sign(transferMoneyInfo, 'secret', (err, encoded) => {
                    if (err instanceof Error) {
                        reject(err);
                    }
                    else {
                        resolve(encoded);
                    }
                });
            });
        });
    }
    /**
     * 友達決済トークンを検証する
     */
    // tslint:disable-next-line:prefer-function-over-method
    verifyTransferMoneyToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                jwt.verify(token, 'secret', (err, decoded) => {
                    if (err instanceof Error) {
                        reject(err);
                    }
                    else {
                        resolve(decoded);
                    }
                });
            });
        });
    }
    /**
     * 顔画像を検証する
     * @param source 顔画像buffer
     */
    verifyFace(source) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                rekognition.searchFacesByImage({
                    CollectionId: this.rekognitionCollectionId,
                    FaceMatchThreshold: 0,
                    // FaceMatchThreshold: FACE_MATCH_THRESHOLD,
                    MaxFaces: 5,
                    Image: {
                        Bytes: source
                    }
                }, (err, data) => {
                    if (err instanceof Error) {
                        reject(err);
                    }
                    else {
                        resolve(data);
                    }
                });
            });
        });
    }
    /**
     * 顔画像を登録する
     * @param source 顔画像buffer
     */
    indexFace(source) {
        return __awaiter(this, void 0, void 0, function* () {
            yield new Promise((resolve, reject) => {
                rekognition.indexFaces({
                    CollectionId: this.rekognitionCollectionId,
                    Image: {
                        Bytes: source
                    },
                    DetectionAttributes: ['ALL']
                    // ExternalImageId: 'STRING_VALUE'
                }, (err, __) => {
                    if (err instanceof Error) {
                        reject(err);
                    }
                    else {
                        debug('face indexed.');
                        resolve();
                    }
                });
            });
        });
    }
    /**
     * 登録済顔画像を検索する
     */
    searchFaces() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                rekognition.listFaces({
                    CollectionId: this.rekognitionCollectionId
                }, (err, data) => {
                    if (err instanceof Error) {
                        // コレクション未作成であれば空配列を返す
                        if (err.code === 'ResourceNotFoundException') {
                            resolve([]);
                        }
                        else {
                            reject(err);
                        }
                    }
                    else {
                        const faces = (data.Faces !== undefined) ? data.Faces : [];
                        resolve(faces);
                    }
                });
            });
        });
    }
}
exports.default = User;
