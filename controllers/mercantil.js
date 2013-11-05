/*jshint node:true*/

'use strict';

var assert = require('assert');
var jsdom = require('jsdom');
var async = require('async');
var queue = require('./shared/queue');

exports.get = function(req, res) {
	var cedula, logger;

	logger = req.app.get('logger');
	cedula = req.params.cedula;
	scrape(logger, cedula, function(err, results) {
		if (err) {
			logger.error('Error while scraping: ' + err);
			res.json(502, err);
		} else {
			res.json(results);
		}
	});
};

function scrape(logger, cedula, cb) {
	logger.info('Scraping cedula ' + cedula + '.');

	queue.scrape(function(err, requestor, next) {
		if (err) {
			cb(err);
			return next();
		}

		async.waterfall([
			function(cb) {
				logger.info('Cedula ' + cedula + ': step 1');
				step1(requestor, cb);
			},

			function(cb) {
				logger.info('Cedula ' + cedula + ': step 2');
				step2(requestor, cb);
			},

			function(cb) {
				logger.info('Cedula ' + cedula + ': step 3');
				step3(requestor, cb);
			},

			function(cb) {
				logger.info('Cedula ' + cedula + ': step 4');
				step4(requestor, cedula, cb);
			},

			function(cb) {
				logger.info('Cedula ' + cedula + ': step 5');
				step5(requestor, cedula, cb);
			}
		], function(err, results) {
			cb(err, results);
			next();
		});
	});
}

function step1(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/inventario.jspx',
		method: 'POST'
	}, function(res) {
		assert.equal(res.statusCode, 302);

		res.on('readable', function() {
			res.read();
		});

		res.on('error', function(err) {
			cb(err);
		});

		res.on('end', function() {
			cb();
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.write('j_id53=j_id53&javax.faces.ViewState=j_id2&j_id53%3Aj_id98=j_id53%3Aj_id98');
	req.end();
}

function step2(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx'
	}, function(res) {
		assert.equal(res.statusCode, 200);

		res.on('readable', function() {
			res.read();
		});

		res.on('error', function(err) {
			cb(err);
		});

		res.on('end', function() {
			cb();
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.end();
}

function step3(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx',
		method: 'POST'
	}, function(res) {
		assert.equal(res.statusCode, 200);

		res.on('readable', function() {
			res.read();
		});

		res.on('error', function(err) {
			cb(err);
		});

		res.on('end', function() {
			cb();
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id260=&formBusqueda%3Aj_id262=&formBusqueda%3Aj_id264=&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&formBusqueda%3Aj_id167=formBusqueda%3Aj_id167&');
	req.end();
}

function step4(requestor, cedula, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx',
		method: 'POST'
	}, function(res) {
		assert.equal(res.statusCode, 200);

		res.on('readable', function() {
			res.read();
		});

		res.on('error', function(err) {
			cb(err);
		});

		res.on('end', function() {
			cb();
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id258=' + cedula + '&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&formBusqueda%3AbotonA=formBusqueda%3AbotonA&');
	req.end();
}

function step5(requestor, cedula, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx',
		method: 'POST'
	}, function(res) {
		var html = '';

		assert.equal(res.statusCode, 200);

		res.on('readable', function() {
			html += res.read();
		});

		res.on('error', function(err) {
			cb(err);
		});

		res.on('end', function() {
			jsdom.env(html, function(errs, window) {
				var t, document = window.document, results = [];

				t = function(node) {
					return node.textContent.trim();
				};

				Array.prototype.forEach.call(document.querySelectorAll('#formBusqueda\\:nombramientosList\\:tb tr'), function(row, i) {

					// The first row is a fake.
					if (0 === i) {
						return;
					}

					results.push({
						cedulaJurídica: t(row.children[0]),
						nombre: t(row.children[1]),
						citasInscripción: t(row.children[2]),
						nombradoComo: t(row.children[3])
					});
				});

				window.close();
				cb(null, results);
			});
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id258=' + cedula + '&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&cIdentificacion=1&formBusqueda%3AinventoryList%3A0%3AshowItem=formBusqueda%3AinventoryList%3A0%3AshowItem&numIdentificacion=' + cedula + '&nConsecIdentific=0&');
	req.end();
}