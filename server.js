var express = require('express');
var http = require('http');
var path = require('path');
var server = require('socket.io');
var pty = require('pty.js');
var fs = require('fs');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var passportSocketIo = require('passport.socketio');


var configFile = '/etc/rabbitshell/config.js';
if(!fs.existsSync(configFile)){
    configFile = './config.js';
}

console.log('Loading configuration: ' + configFile);
var config = require(configFile);


var opts = require('optimist').options({
    port:{
        deman: true,
        alias: 'p',
        description: 'webshell listen port'
    }
}).boolean('allow_discovery').argv;

process.on('uncaughtException', function(e){
    console.error('Error:', e.message, e.stack);
});

passport.use(new LocalStrategy({
        passReqToCallback: true
    },
    config.authFn
));

passport.serializeUser(function(user, cb){
    cb(null, JSON.stringify(user));
});

passport.deserializeUser(function(str, cb){
    cb(null, JSON.parse(str));
});

var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

var session = require('express-session');
var FileStore = require('session-file-store')(session);
var sessionStore = new FileStore();

sessionConfig = {
    key: config.session.key,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: true,
    store: sessionStore
};
var sessionMiddleware = session(sessionConfig);

var cookieParser = require('cookie-parser');

var csrf = require('csurf');
var csrfProtection = csrf({cookie: true});

app.use(require('morgan')('combined'));
app.use(cookieParser());
app.use(require('body-parser').urlencoded({extended: true}));
app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

config.proxy_pass_prefix = config.proxy_pass_prefix || '';

app.use('/webshell', express.static(path.join(__dirname, 'public', 'webshell')));

app.get('/login', csrfProtection, function(req, res){
    resource_id = req.get('X-Webshell-ResourceId') || req.query.rid;
    res.render('login', {
        csrfToken: req.csrfToken(),
        proxy_pass_prefix: config.proxy_pass_prefix,
        resource_id: resource_id
    });
});

app.post('/login',
    csrfProtection,
    passport.authenticate('local', {
        failureRedirect: config.proxy_pass_prefix + '/login'
    }),
    function(req, res){
        res.redirect(config.proxy_pass_prefix + '/');
    });

app.get('/logout', function(req, res){
    req.logout();
    res.redirect(config.proxy_pass_prefix + '/login');
});

app.get('/',
    require('connect-ensure-login').ensureLoggedIn(config.proxy_pass_prefix + '/login'),
    function(req, res){
        res.render('index', {
            user: req.user,
            proxy_pass_prefix: config.proxy_pass_prefix
        });
    }
);

var httpserv = http.createServer(app).listen(opts.port, function(){
    console.log('http on port', opts.port);
});
//////////////////////////////

var io = server(httpserv, {path:'/webshell/socket.io'});
io.use(passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: sessionConfig.key,
    secret: sessionConfig.secret,
    store: sessionStore,
    fail: function(data, message, error, accept){
        if(error) accept( new Error(message));
    },
    success: function(data, accept){
        console.log('success socket.io auth');
        accept();
    }
}));

var Rpty = require('./lib/rpty');

io.on('connection', function(socket){
    var request = socket.request;
    console.log((new Date()) + ' Conneciton accepted.');

    var term;
    var opts = config.shellEntrypoint(request);

    /*
     * clientId: identifier for client topics. This is
     * the same parameter we used when we started a client
     * instance.
     */
    term = Rpty.spawn(opts.clientId, opts.script, opts.args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 30
    });

    term.on('data', function(data){
        console.log('on term.data', data);
        socket.emit('output', data);
    });

    term.on('exit', function(code){
        console.log('on ter.exit', (new Date()) + ' PID='+term.pi + ' ENDED');
        socket.emit('exit', config.proxy_pass_prefix + '/logout');
    });

    term.on('ready', function(){
        console.log('term.ready');
        socket.on('resize', function(data){
            console.log('socket.resize');
            term.resize(data.col, data.row);
        });
        socket.on('input', function(data){
            console.log('socket.input');
            term.write(data);
        });
        socket.on('disconnect', function(){
            console.log('socket.disconnect');
            term.end();
        });
    });
});
