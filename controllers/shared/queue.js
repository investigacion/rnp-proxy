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

		logger.info('Got session ID: ' + sessionId + '.');

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

		res.on('error', function(err) {
			cb(err);
		});

		res.on('readable', function() {
			res.read();
		});

		res.on('end', function() {
			req = https.request({
				hostname: hostname,
				path: '/shopping/login.jspx',
				method: 'POST',
				headers: {
					'Cookie': 'JSESSIONID=' + sessionId + ';',
					'Content-Type': 'application/x-www-form-urlencoded'
				}
			}, function(res) {
				assert.equal(res.statusCode, 200);

				res.on('error', function(err) {
					cb(err);
				});

				res.on('readable', function() {
					res.read();
				});

				res.on('end', function() {
					cb(null, requestor);
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
