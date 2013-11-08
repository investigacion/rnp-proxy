/*jshint node:true*/

'use strict';

var async = require('async');
var request = require('request');
var assert = require('assert');

var queue = async.queue(function(task, cb) {
	login(function(err, requestor) {
		task(err, requestor, cb);
	});
}, 1);

var timeout = 2 * 60 * 1000; // 2 minute timeout.

exports.credentials = {};
exports.logger = null;

exports.scrape = function(cb) {
	queue.push(cb);
};

function login(cb) {
	var credentials = exports.credentials, logger = exports.logger;

	async.waterfall([
		function(cb) {
			request({
				url: 'https://www.rnpdigital.com/shopping/login.jspx',
				timeout: timeout,
				followRedirect: false
			}, function(err, res) {
				var sessionId;

				assert.equal(res.statusCode, 200);
				if (err) {
					return cb(err);
				}

				sessionId = res.headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/)[1];

				logger.info('[Queue] [' + sessionId + '] Got session ID.');
				logger.info('[Queue] [' + sessionId + '] Submitting login data.');

				cb(null, sessionId);
			});
		},

		function(sessionId, cb) {
			request({
				url: 'https://www.rnpdigital.com/shopping/login.jspx',
				method: 'POST',
				timeout: timeout,
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
					logger.error('[Queue] [' + sessionId + '] Login failed: invalid credentials.');
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
			options.followRedirect = false;

			return request(options, cb);
		});
	});
}
