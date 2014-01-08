/*jshint node:true*/

'use strict';

var async = require('async');
var request = require('request');
var assert = require('assert');

var queue = async.queue(function(task, cb) {
	var credentials = pool.shift();

	login(credentials, function(err, requestor) {
		task(err, requestor, function() {
			pool.push(credentials);
			cb.apply(null, arguments);
		});
	});
}, 1);

var timeout = 2 * 60 * 1000; // 2 minute timeout.
var pool, logger, agent;

exports.credentials = function(credentials) {
	if (arguments.length < 1) {
		return pool;
	}

	if (!Array.isArray(credentials)) {
		credentials = [credentials];
	}

	pool = credentials.map(function(credentials) {
		if ('string' === typeof credentials) {
			credentials = credentials.trim().split(':');
			return {
				username: credentials[0],
				password: credentials[1]
			};
		}

		return credentials;
	});

	queue.concurrency = pool.length;

	if (logger) {
		logger.info('[Queue] Set credentials. Concurrency set to ' + pool.length + '.');
	}
};

exports.logger = function(value) {
	logger = value;
};

exports.scrape = function(cb) {
	queue.push(cb);
};

exports.agent = function(factory) {
	agent = factory;
};

function login(credentials, cb) {
	async.waterfall([
		function(cb) {
			request({
				url: 'https://www.rnpdigital.com/shopping/login.jspx',
				timeout: timeout,
				agent: agent(),
				followRedirect: false
			}, function(err, res) {
				var sessionId;

				if (err) {
					return cb(err);
				}

				assert.equal(res.statusCode, 200);

				sessionId = res.headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/)[1];

				logger.info('[Queue] [' + credentials.username + '] Got session ID ' + sessionId + '.');
				logger.info('[Queue] [' + credentials.username + '] Submitting login data.');

				cb(null, sessionId);
			});
		},

		function(sessionId, cb) {
			request({
				url: 'https://www.rnpdigital.com/shopping/login.jspx',
				method: 'POST',
				timeout: timeout,
				agent: agent(),
				followRedirect: false,
				headers: {
					'Cookie': 'JSESSIONID=' + sessionId + ';'
				},
				form: {
					frm: 'frm',
					'frm:j_id24': credentials.username,
					'frm:pass': credentials.password,
					'frm:j_id29': 'Ingresar',
					'javax.faces.ViewState': 'j_id1'
				}
			}, function(err, res, html) {
				if (err) {
					return cb(err);
				}

				assert.equal(res.statusCode, 200);

				if (-1 !== html.indexOf('Datos incorrectos')) {

					// TODO: Use a username and password pool.
					logger.error('[Queue] [' + credentials.username + '] Login failed: invalid credentials.');
					return cb(new Error('Login failed: invalid credentials.'));
				}

				cb(null, sessionId);
			});
		}
	], function(err, sessionId) {
		cb(err, function(options, cb) {
			if (!options.headers) {
				options.headers = {};
			}

			options.headers.Cookie = 'JSESSIONID=' + sessionId + ';';
			options.timeout = timeout;
			options.agent = agent();
			options.followRedirect = false;

			return request(options, cb);
		});
	});
}
