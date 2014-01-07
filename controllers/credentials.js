/*jshint node:true*/

'use strict';

var queue = require('./shared/queue');

exports.get = function(req, res) {
	// jshint unused:false

	res.json(queue.credentials());
};

exports.put = function(req, res) {
	if (req.body) {
		queue.credentials(req.body);
		res.send(200);
	} else if (req.is('application/json')) {
		res.send(422);
	} else {
		res.send(415);
	}
};
