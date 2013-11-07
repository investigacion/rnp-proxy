/*jshint node:true*/

'use strict';

var async = require('async');
var https = require('https');
var assert = require('assert');

var hostname = 'www.rnpdigital.com';

var queue = async.queue(function(task, cb) {
	login(function(err, requestor) {
		task(err, requestor, cb);
	});
}, 1);

exports.credentials = {};
exports.logger = null;

exports.scrape = function(cb) {
	queue.push(cb);
};

function login(cb) {
	var credentials = exports.credentials, logger = exports.logger;

	https.get('https://' + hostname + '/shopping/login.jspx', function(res) {
		var req, sessionId, requestor;

		sessionId = res.headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/)[1];

		logger.info('[Queue] [' + sessionId + '] Got session ID.');

		requestor = function(options, cb) {
			if (!options.headers) {
				options.headers = {};
			}

			options.headers.Cookie = 'JSESSIONID=' + sessionId + ';';
			options.hostname = hostname;

			if (options.method === 'POST') {
				options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
			}

			return https.request(options, cb);
		};

		res.resume();

		res.on('error', function(err) {
			cb(err);
		});

		res.on('end', function() {
			logger.info('[Queue] [' + sessionId + '] Submitting login data.');

			req = https.request({
				hostname: hostname,
				path: '/shopping/login.jspx',
				method: 'POST',
				headers: {
					'Cookie': 'JSESSIONID=' + sessionId + ';',
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			}, function(res) {
				var html;

				assert.equal(res.statusCode, 200);

				res.on('readable', function() {
					html += res.read();
				});

				res.on('error', function(err) {
					cb(err);
				});

				res.on('end', function() {
					if (-1 === html.indexOf('Datos incorrectos')) {
						cb(null, requestor);
					} else {

						// TODO: Use a username and password pool.
						logger.error('[Queue] [' + sessionId + '] Login failed: invalid credentials.');
						cb(new Error('Login failed: invalid credentials.'));
					}
				});
			});

			req.on('error', function(err) {
				cb(err);
			});

			req.setTimeout(120 * 1000);
			req.write('frm=frm&frm%3Aj_id24=' + encodeURIComponent(credentials.username) + '&frm%3Apass=' + encodeURIComponent(credentials.password) + '&frm%3Aj_id29=Ingresar&javax.faces.ViewState=j_id1');
			req.end();
		});
	});
}
