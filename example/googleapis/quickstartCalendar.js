const { google } = require('googleapis');
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// const key = require('../../key/googleCalender.json');
const key = JSON.parse(process.env.GOOGLE_CALENDAR_AUTH_KEY);

const jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    SCOPES, // an array of auth scopes
    null
);

jwtClient.authorize((err, tokens) => {
    if (err) {
        console.error(err);
        throw err;
    }

    // list events
    listEvents(jwtClient);
});

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
    const calendar = google.calendar({ version: 'v3', auth });

    calendar.calendarList.list({
        maxResults: 250,
        minAccessRole: 'writer'
    }, (err, { data }) => {
        if (err) return console.log('The API returned an error: ' + err);

        console.log(data);
        let calendars = data.items;
        console.log(calendars.map(cal => `${cal.id} ${cal.summary}`));
    });

    calendar.events.list({
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    }, (err, { data }) => {
        if (err) return console.log('The API returned an error: ' + err);
        const events = data.items;
        if (events.length) {
            console.log('Upcoming 10 events:');
            events.map((event, i) => {
                const start = event.start.dateTime || event.start.date;
                console.log(`${event.id} - ${start} - ${event.summary}`);
            });
        } else {
            console.log('No upcoming events found.');
        }
    });
}
