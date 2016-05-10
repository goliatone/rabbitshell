'use strict';

var Adapter = require('./adapter-amqp');
var Terminal = {};

Terminal.fork =
Terminal.spawn =
Terminal.createTerminal = function(id, file, args, opt) {
    var emitter = Adapter.create(id, {
        file: file,
        args: args,
        options: opt
    });
    return emitter;
};

module.exports = Terminal;
