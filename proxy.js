/*jshint node:true*/

'use strict';

var http = require('http');
var express = require('express');
var winston = require('winston');

var argv = require('optimist')
	.usage('\nUsage: $0')
	.demand('username')
	.describe('username', 'Username for logging in to rnpdigital.com')
	.demand('password')
	.describe('password', 'Password for logging in to rnpdigital.com')
	.demand('port')
	.describe('port', 'Port to run proxy on')
	.argv;

var logger = new winston.Logger({
	exitOnError: true,
	transports: [
		new (winston.transports.Console)({
			level: 'info',
			colorize: true,
			timeStamp: true,
			handleExceptions: false
		})
	]
});

var queue = require('./controllers/shared/queue');
var routes = require('./routes');

var app = express();
var server = http.createServer();

queue.credentials.password = argv.password;
queue.credentials.username = argv.username;
queue.logger = logger;

app.set('env', 'development');
app.enable('case sensitive routing');
app.enable('strict routing');
app.enable('trust proxy');
app.disable('json spaces');
app.disable('x-powered-by');

app.set('logger', logger);

// Compression comes first in the chain.
app.use(express.compress());

server.on('request', app);
server.listen(argv.port, function() {
	logger.info('Listening on port ' + argv.port + ' with environment ' + app.get('env') + '.');

	routes(app, require('./routes.json'));
});
