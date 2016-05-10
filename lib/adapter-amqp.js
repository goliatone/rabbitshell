var extend = require('gextend');
var EventEmitter = require('events').EventEmitter;
///////////////////////
/// AMQP ADAPTER
//////////////////////
var Adapter = {
    config:{
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
        serviceId: 'service'
    }
};
var ascoltatori = require('ascoltatori');
Adapter.create = function(id, options){
    var emitter = new EventEmitter();
    var forward = ['data', 'exit', 'close'];

    ascoltatori.build(Adapter.config.amqp, function (_, ascoltatore) {
       console.log('===> AMQP client CONNECTED');
       console.log('AMQP config', JSON.stringify(Adapter.config.amqp, null, 4));

       forward.map(function(type){
           var topic = getTopic(Adapter.config.serviceId, type);
           console.log('Adapter, subscribe to', topic);
           ascoltatore.subscribe(topic, function(t, data){
               emitter.emit(type, data);
           });
       });

       var topic = getTopic(Adapter.config.serviceId, 'connected');
       console.log('Adapter, subscrit to', topic);
       ascoltatore.subscribe(topic, function $onConnected(data){
           console.log('Client %s connected %s', id, data);
           //TODO: filter out this data.
           extend(emitter, data);
           emitter.emit('created', data);
       });

       emitter.publish = function(type, payload){
           var topic = getTopic(id, type);
           ascoltatore.publish(topic, payload);
           console.log('Adapter emit to %s:', topic, payload);
       };

       emitter.resize = function(col, row){
           console.log('rpty: resize');
           emitter.publish('resize', {
               col: col,
               row: row
           });
       };

       emitter.write = function(data){
           console.log('rpty: write');
           emitter.publish('write', {
               data: data
           });
       };

       emitter.end = function(){
           console.log('rpty: end');
           emitter.publish('end');
       };

       emitter.emit('ready');

       emitter.publish('create', options);
   });

   function getTopic(instanceId, type){
       return Adapter.config.baseTopic + '/' + instanceId + '/' + type;
   }

   return emitter;
};
module.exports = Adapter;
