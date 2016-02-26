/*
 var express = require('express');
 var path = require('path');
 var favicon = require('static-favicon');
 var logger = require('morgan');
 var cookieParser = require('cookie-parser');
 var bodyParser = require('body-parser');

 var sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);

 var routes = require('./routes/index');
 var users = require('./routes/api');

 var app = express();

 // view engine setup
 app.set('views', path.join(__dirname, 'views'));
 app.set('view engine', 'ejs');

 app.use(favicon());
 app.use(logger('dev'));
 app.use(bodyParser.json());
 app.use(bodyParser.urlencoded());
 app.use(cookieParser());
 app.use(express.static(path.join(__dirname, 'public')));

 app.use('/', routes);
 app.use('/api', users);

 /// catch 404 and forwarding to error handler
 app.use(function(req, res, next) {
 var err = new Error('Not Found');
 err.status = 404;
 next(err);
 });

 /// error handlers

 // development error handler
 // will print stacktrace
 if (app.get('env') === 'development') {
 app.use(function(err, req, res, next) {
 res.status(err.status || 500);
 res.render('error', {
 message: err.message,
 error: err
 });
 });
 }

 // production error handler
 // no stacktraces leaked to user
 app.use(function(err, req, res, next) {
 res.status(err.status || 500);
 res.render('error', {
 message: err.message,
 error: {}
 });
 });


 module.exports = app;
 */

var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
//var bodyParser = require('body-parser');
var routes = require('./routes/index');
var api = require('./routes/api');
var sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);
var app = express();
var auth = require("basic-auth");

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.use(favicon());
app.use(logger('dev'));
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', api);

app.use(function (req, res, next) {
    var user = auth(req);
    if (user === undefined || user['name'] !== process.env.BASIC_USERNAME || user['pass'] !== process.env.BASIC_PASSWORD) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="MyRealmName"');
        res.end('Unauthorized');

    } else {
        next();
    }
});

app.use('/', routes);

app.use(function (req, res, next) {
    console.log("Wrong URL Error: " + req.originalUrl);
    res.status(404);
    res.render('error', {
        message: 'Page Not Found!!!'
    });
});

app.use(function (err, req, res, next) {
    console.log("Program Error: " + req.originalUrl);
    console.log(err);
    var email = new sendgrid.Email({
            to: process.env.SENDGRID_TO,
            from: process.env.SENDGRID_FROM,
            subject: 'Error at IoTGateway',
            text: err.toString()
        }
    );

    sendgrid.send(email, function (err, json) {
        if (err) {
            return console.error(err);
        }
    })

    res.status(err.status || 500);
    res.render('error', {
        message: 'Please ask your Administrator',
        error: err
    });
});

module.exports = app;


