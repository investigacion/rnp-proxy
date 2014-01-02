/*jshint node:true*/

'use strict';

var http = require('http');
var express = require('express');
var winston = require('winston');
var redis = require('redis');

var argv = require('optimist')
	.usage('\nUsage: $0')
	.demand('username')
	.describe('username', 'Username for logging in to rnpdigital.com')
	.demand('password')
	.describe('password', 'Password for logging in to rnpdigital.com')
	.describe('port', 'Port to run proxy on')
	.default('port', 3000)
	.boolean('cache')
	.describe('cache', 'Cache results using Redis')
	.default('cache', true)
	.describe('cache-ttl', 'Cache TTL in days')
	.default('cache-ttl', 30)
	.describe('redis-port', 'Connect to Redis on this port')
	.describe('redis-host', 'Host on which Redis is running')
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
var cache;

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

if (argv.cache) {
	logger.info('[Proxy] Initialising Redis cache.');

	cache = redis.createClient(argv['redis-port'], argv['redis-host']);

	app.set('cache', cache);
	app.set('cache ttl', argv['cache-ttl'] * 24 * 60 * 60);

	cache.on('error', function(err) {
		logger.error('[Proxy] Redis error: ' + err);
	});
}

// Compression comes first in the chain.
app.use(express.compress());
routes(app, require('./routes.json'));
app.use(function(err, req, res, next) {
	//jshint unused:false
	logger.error('[Proxy] Error while handling request: ' + err);

	res.json(500, err);
});

server.on('request', app);
server.on('connection', function(socket) {

	// Scraping takes long. So set a long timeout.
	socket.setTimeout(10 * 60 * 1000, function() {
		logger.error('[Proxy] Socket timeout.');
	});
});

server.listen(argv.port, function() {
	logger.info('[Proxy] Listening on port ' + argv.port + ' with ' + app.get('env') + ' environment.');
});
