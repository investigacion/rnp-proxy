/*jshint node:true*/

'use strict';

var assert = require('assert');
var jsdom = require('jsdom');
var async = require('async');
var queue = require('./shared/queue');
var cedulas = require('./shared/cedulas');

exports.get = function(req, res) {
	cedulas.scrape('Mercantil', req.params.cedula, scrape, res);
};

function normaliseCedula(cedula) {
	var parts, zerofill;

	zerofill = function(string, size) {
		while (string.length < size) {
			string = '0' + string;
		}

		return string;
	};

	// Cedulas are always of the format X-XXX-XXXXXX, but the RNP site converts each part to an integer so leading zeroes tend to be lost.
	parts = cedula.split('-');
	if (parts[1].length < 3) {
		parts[1] = zerofill(parts[1], 3);
	}

	if (parts[2].length < 6) {
		parts[2] = zerofill(parts[2], 6);
	}

	return parts.join('');
}

function scrape(app, cedula, cb) {
	var logger, cache;

	cache = app.get('cache');
	logger = app.get('logger');

	logger.info('[Mercantil] [' + cedula + '] Scraping.');

	queue.scrape(function(err, requestor, next) {
		if (err) {
			cb(err);
			return next();
		}

		async.waterfall([
			function(cb) {
				logger.info('[Mercantil] [' + cedula + '] Step 1');
				step1(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] [' + cedula + '] Step 2');
				step2(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] [' + cedula + '] Step 3');
				step3(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] [' + cedula + '] Step 4');
				step4(logger, requestor, cedula, cb);
			}
		], function(err, results) {
			if (!err) {
				logger.info('[Mercantil] [' + cedula + '] Scraped with ' + results.length + ' results.');
			}

			cb(err, results);
			next();
		});
	});
}

function step1(requestor, cb) {
	requestor({
		url: 'https://www.rnpdigital.com/shopping/inventario.jspx',
		method: 'POST',
		form: {
			j_id53: 'j_id53',
			'javax.faces.ViewState': 'j_id2',
			'j_id53:j_id98': 'j_id53:j_id98'
		}
	}, function(err, res) {
		if (err) {
			return cb(err);
		}

		assert.equal(res.statusCode, 302);
		cb();
	});
}

function step2(requestor, cb) {
	requestor({
		url: 'https://www.rnpdigital.com/shopping/padronFisico.jspx'
	}, function(err, res) {
		if (err) {
			return cb(err);
		}

		assert.equal(res.statusCode, 200);
		cb();
	});
}

function step3(requestor, cb) {
	requestor({
		url: 'https://www.rnpdigital.com/shopping/padronFisico.jspx',
		method: 'POST',
		form: {
			AJAXREQUEST: '_viewRoot',
			formBusqueda: 'formBusqueda',
			'formBusqueda:j_id161': '1',
			'formBusqueda:j_id165': '1',
			'formBusqueda:j_id260': '',
			'formBusqueda:j_id262': '',
			'formBusqueda:j_id264': '',
			'formBusqueda:modalBMOpenedState': '',
			'formBusqueda:modalFincasOpenedState': '',
			'formBusqueda:modalNombramientosOpenedState': '',
			'formBusqueda:modalAfectacionesOpenedState': '',
			'formBusqueda:modalPoderesOpenedState': '',
			'formBusqueda:modalAllOpenedState': '',
			'javax.faces.ViewState': 'j_id3',
			'formBusqueda:j_id167': 'formBusqueda:j_id167'
		}
	}, function(err, res) {
		if (err) {
			return cb(err);
		}

		assert.equal(res.statusCode, 200);
		cb();
	});
}

function step4(logger, requestor, cedula, cb) {
	requestor({
		url: 'https://www.rnpdigital.com/shopping/padronFisico.jspx',
		method: 'POST',
		form: {
			AJAXREQUEST: '_viewRoot',
			formBusqueda: 'formBusqueda',
			'formBusqueda:j_id161': '1',
			'formBusqueda:j_id165': '1',
			'formBusqueda:j_id258': cedula,
			'formBusqueda:modalBMOpenedState': '',
			'formBusqueda:modalFincasOpenedState': '',
			'formBusqueda:modalNombramientosOpenedState': '',
			'formBusqueda:modalAfectacionesOpenedState': '',
			'formBusqueda:modalPoderesOpenedState': '',
			'formBusqueda:modalAllOpenedState': '',
			'javax.faces.ViewState': 'j_id3',
			'formBusqueda:botonA': 'formBusqueda:botonA'
		}
	}, function(err, res, html) {
		if (err) {
			return cb(err);
		}

		assert.equal(res.statusCode, 200);

		// TODO: Move this logic into the requestor function.
		if (-1 !== html.indexOf('<meta name="Location" content="./login.jspx" />')) {
			return cb(new Error('Session terminated for unknown reason.'));
		}

		jsdom.env(html, function(errs, window) {
			var indexes;

			if (errs) {
				window.close();
				return cb(errs);
			}

			// Note that for some cedulas, for example 502950673, there are multiple sets of records for variant spellings of the person's name.
			indexes = window.document.querySelectorAll('#formBusqueda\\:inventoryList\\:tb > tr').length;

			logger.info('[Mercantil] [' + cedula + '] Got ' + indexes + ' name variant rows.');

			window.close();
			async.timesSeries(indexes, function(index, next) {
				logger.info('[Mercantil] [' + cedula + '] Extracting rows from name variant ' + index + '.');

				extractPerson(logger, requestor, cedula, index, next);
			}, function(err, results) {
				if (err) {
					return cb(err);
				}

				// Flatten the arrays of accumulated results.
				cb(null, results.reduce(function(results, set) {
					results.push.apply(results, set);

					return results;
				}, []));
			});
		});
	});
}

function extractPerson(logger, requestor, cedula, index, cb) {
	var extractRows, form;

	form = {
		AJAXREQUEST: '_viewRoot',
		formBusqueda: 'formBusqueda',
		'formBusqueda:j_id161': '1',
		'formBusqueda:j_id165': '1',
		'formBusqueda:j_id258': cedula,
		'formBusqueda:modalBMOpenedState': '',
		'formBusqueda:modalFincasOpenedState': '',
		'formBusqueda:modalNombramientosOpenedState': '',
		'formBusqueda:modalAfectacionesOpenedState': '',
		'formBusqueda:modalPoderesOpenedState': '',
		'formBusqueda:modalAllOpenedState': '',
		'javax.faces.ViewState': 'j_id3',
		cIdentificacion: '1',
		numIdentificacion: cedula,
		nConsecIdentific: index
	};

	form['formBusqueda:inventoryList:' + index + ':showItem'] = 'formBusqueda:inventoryList:' + index + ':showItem';

	requestor({
		url: 'https://www.rnpdigital.com/shopping/padronFisico.jspx',
		method: 'POST',
		form: form
	}, function(err, res, html) {
		if (err) {
			return cb(err);
		}

		assert.equal(res.statusCode, 200);

		extractRows(html, []);
	});

	extractRows = function(html, results) {
		jsdom.env(html, function(errs, window) {
			var t, button, document, count = 0;

			logger.info('[Mercantil] [' + cedula + '] Extracting rows.');

			if (errs) {
				return cb(errs);
			}

			document = window.document;

			t = function(node) {
				return node.textContent.trim();
			};

			Array.prototype.forEach.call(document.querySelectorAll('#formBusqueda\\:nombramientosList\\:tb tr'), function(row, i) {

				// The first row is a fake.
				if (0 === i) {
					return;
				}

				count++;
				results.push({
					cedulaJuridica: normaliseCedula(t(row.children[0])),
					nombre: t(row.children[1]),
					citasInscripcion: t(row.children[2]),
					nombradoComo: t(row.children[3])
				});
			});

			logger.info('[Mercantil] [' + cedula + '] Extracted ' + count + ' rows, total for person name variant at ' + results.length + '.');

			Array.prototype.slice.call(document.querySelectorAll('#formBusqueda\\:nombramientosList\\:footer .rich-datascr-button'), 0).some(function(b) {
				if (b.textContent.trim() === '»') {
					button = b;
					return true;
				}
			});

			window.close();

			if (button && -1 === button.className.indexOf('rich-datascr-button-dsbld')) {
				logger.info('[Mercantil] [' + cedula + '] Moving to next rows page.');

				requestor({
					url: 'https://www.rnpdigital.com/shopping/padronFisico.jspx',
					method: 'POST',
					form: {
						AJAXREQUEST: '_viewRoot',
						formBusqueda: 'formBusqueda',
						'formBusqueda:j_id161': '1',
						'formBusqueda:j_id165': '1',
						'formBusqueda:j_id258': cedula,
						'formBusqueda:modalBMOpenedState': '',
						'formBusqueda:modalFincasOpenedState': '',
						'formBusqueda:modalNombramientosOpenedState': '',
						'formBusqueda:modalAfectacionesOpenedState': '',
						'formBusqueda:modalPoderesOpenedState': '',
						'formBusqueda:modalAllOpenedState': '',
						'javax.faces.ViewState': 'j_id3',
						ajaxSingle: 'formBusqueda:nombramientosList:ds3',
						'formBusqueda:nombramientosList:ds3': 'fastforward',
						'AJAX:EVENTS_COUNT': '1'
					}
				}, function(err, res, html) {
					if (err) {
						return cb(err);
					}

					assert.equal(res.statusCode, 200);

					extractRows(html, results);
				});
			} else {
				logger.info('[Mercantil] [' + cedula + '] Extracted last row page.');

				cb(null, results);
			}
		});
	};
}
