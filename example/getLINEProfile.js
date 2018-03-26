const request = require('request-promise-native');

request.get({
    simple: false,
    url: `https://api.line.me/v2/bot/profile/U28fba84b4008d60291fc861e2562b34f`,
    auth: { bearer: process.env.LINE_BOT_CHANNEL_ACCESS_TOKEN },
    json: true
}).then(console.log);
