// Use the web-push library to hide the implementation details of the communication
// between the application server and the push service.
// For details, see https://tools.ietf.org/html/draft-ietf-webpush-protocol and
// https://tools.ietf.org/html/draft-ietf-webpush-encryption.
const parseBody = require('body-parser');
const express = require('express');
const webPushLib = require('web-push');
const webPush = require('./web-push-debug');

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.log("You must set the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY " +
                "environment variables. You can use the following ones:");
    console.log(webPushLib.generateVAPIDKeys());
    return;
}
if (!process.env.VAPID_SUBJECT) {
    console.log("You must set the VAPID_SUBJECT environment variable.");
}
// Set the keys used for encrypting the push messages.
webPush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const app = express();
const route = "/";

app.use(parseBody.json());

app.use(function (req, res, next) {
    // Adding this redirect to simplify caching a recipe page,
    // essentially so we don't have to cache "/" and "/index.html"
    // So: "recipe/index.html" -> "recipe/" , "index.html?123" -> "?123"
    if (/\/(.*)\/index\.html\??(.*)$/.test(req.url)) {
        return res.redirect(req.url.replace('index.html', ''));
    }
    return next();
});

app.use(function (req, res, next) {
    // Better for canonical URL, "index.html" is ugly
    if(req.url === '/index.html') {
        return res.redirect(301, '/');
    }
    return next();
});

app.use(function (req, res, next) {
    var host = req.get('Host');
    var localhost = 'localhost';

    if (host.substring(0, localhost.length) !== localhost) {
        // https://developer.mozilla.org/en-US/docs/Web/Security/HTTP_strict_transport_security
        res.header('Strict-Transport-Security', 'max-age=15768000');
        // https://github.com/rangle/force-ssl-heroku/blob/master/force-ssl-heroku.js
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect('https://' + host + req.url);
        }
    }
    return next();
});

app.use(function (req, res, next) {
    // http://enable-cors.org/server_expressjs.html
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
    next();
});

app.use(function (req, res, next) {
    // https://github.com/mozilla/serviceworker-cookbook/issues/201
    var file = req.url.split('/').pop();
    if (file === 'service-worker.js' || file === 'worker.js') {
        res.header('Cache-control', 'public, max-age=0');
    }
    next();
});

app.get(route + 'vapidPublicKey', function (req, res) {
    res.send(process.env.VAPID_PUBLIC_KEY);
});

app.post(route + 'register', function (req, res) {
    // A real world application would store the subscription info.
    res.sendStatus(201);
});

app.post(route + 'sendNotification', function (req, res) {
    const subscription = req.body.subscription;
    const payload = req.body.payload;
    const options = {
        TTL: req.body.ttl
    };

    console.log("Send data: ", subscription, payload, options);

    setTimeout(function () {
        webPush.sendNotification(subscription, payload, options)
               .then(function () {
                   res.sendStatus(201);
               })
               .catch(function (error) {
                   console.log(error);
                   res.sendStatus(500);
               });
    }, req.body.delay * 1000);
});

app.use(express.static('./'));

let port = process.env.PORT || 3003;
app.listen(port, function () {
    console.log('app.listen on http://localhost:%d', port);
});
