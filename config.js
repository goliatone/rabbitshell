'use strict';

var config ={};
config.session= {
    key: 'webconsole',
    secret: '2asd7f4d6s15s74d'
};

config.authFn = function(req, username, password, cb){
        if(username === 'foo' && password === 'bar'){
            var resource_id = req.body.resource_id || 'default';
            return cb(null, {id: username, resource_id: resource_id});
        }
        return cb(null, false, {message: 'Invalid credentials'});
};

config.shellEntrypoint = function(req){
    return {
        script: __dirname + '/bin/entrypoint',
        args: [req.user.resource_id]
    };
};

module.exports = config;
