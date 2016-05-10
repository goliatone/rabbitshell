var EventEmitter = require('events').EventEmitter;
var pty = require('pty.js');
var extend = require('gextend');

var DEFAULTS = {
    amqp: {
        type: 'amqp',
        json: true,
        amqp: require('amqp'),
        exchange: 'rtty.dev',
        client: {
            url: process.env.NODE_AMQP_ENDPOINT
        }
    },
    baseTopic: 'rtty',
    serviceId: 'service',
    instanceId: 'local' //this should be set per singular instance!
};

function Local(){}

var ascoltatori = require('ascoltatori');
Local.init = function(config){
    config = extend({}, DEFAULTS, config);

    ascoltatori.build(config.amqp, function (err, ascoltatore) {
        if(err){
            return console.error('AMQP Error: %s', err.message);
        }

        console.log('===> AMQP client CONNECTED');
        console.log('AMQP config', JSON.stringify(config.amqp, null, 4));

        var term;
        var createTopic = getTopic(config.instanceId, 'create');
        console.log('Client subscribe to:', createTopic);

        ascoltatore.subscribe(createTopic, function(t, options){

            console.log('on create handler', t, options);

            term = pty.spawn(options.file, [config.instanceId], options.options);

            term.on('data', function(data) {
                var topic = getTopic(config.serviceId, 'data');
                ascoltatore.publish(topic, data);
            });

            term.on('exit', function(data){
                var topic = getTopic(config.serviceId, 'exit');
                console.log('on term.exit:', topic);
                ascoltatore.publish(topic, data);
            });

            term.on('close', function(data){
                var topic = getTopic(config.serviceId, 'close');
                console.log('on term.close:', topic);
                ascoltatore.publish(topic, data);
            });

            term.on('error', function(err){
                console.log('Error', e.message, e.stack);
            });

            topic = getTopic(config.serviceId, 'connected');
            ascoltatore.publish(topic, {
                pi:term.pi
            });

            var topic = getTopic(config.instanceId, 'resize');
            console.log('client subscribe to:', topic);
            ascoltatore.subscribe(topic, function(t, data){
                console.log('we got message on:', t);
                term.resize(data.col, data.row);
            });

            topic = getTopic(config.instanceId, 'write');
            console.log('client subscribe to:', topic);
            ascoltatore.subscribe(topic, function(t, data){
                console.log('we got message on:', t);
                term.write(data.data);
            });

            topic = getTopic(config.instanceId, 'end');
            console.log('client subscribe to:', topic);
            ascoltatore.subscribe(topic, function(t, data){
                console.log('we got message on:', t);
                term.end();
            });

            process.on('exit', function(){
                var topic = getTopic(config.serviceId, 'exit');
                console.log('term.exit', topic);
                ascoltatore.publish(topic, data);
            });
       });

    //    topic = getTopic(Local.config.serviceId, 'connected');
    //    console.log('emit connected', topic);
    //    ascoltatore.publish(topic, {foo:'bar'});
   });

   function getTopic(id, type){
       return config.baseTopic + '/' + id + '/' + type;
   }
};

module.exports = Local;
