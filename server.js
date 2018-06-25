var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sqlite3 = require('sqlite3').verbose();
var moment = require('moment');
var randomstring = require("randomstring");
var randomcolor = require("randomcolor");

var db = new sqlite3.Database('./code.db');
db.run('CREATE TABLE IF NOT EXISTS code(id text, value text, mode text, create_date text, modify_date text, create_ip, modify_ip, UNIQUE ("id"))');

var httpPort = process.env.HTTP_PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/codemirror/lib', express.static('node_modules/codemirror/lib'));
app.use('/codemirror/theme', express.static('node_modules/codemirror/theme'));
app.use('/codemirror/mode', express.static('node_modules/codemirror/mode'));
app.use('/codemirror/addon', express.static('node_modules/codemirror/addon'));
app.use('/bootstrap', express.static('node_modules/bootstrap/dist'));
app.use('/knockout', express.static('node_modules/knockout/build/output'));
app.use('/moment', express.static('node_modules/moment/min'));
app.use('/jquery-toast-plugin', express.static('node_modules/jquery-toast-plugin/dist'));
app.use('/js/jquery', express.static('node_modules/jquery/dist'));

app.get('/:codeId?', function (req, res) {
    var codeId = 'null';

    if(req.params.codeId)
    {
        codeId = "'"+req.params.codeId+"'";
    }

    res.render("index", { codeId: codeId});
})

http.listen(httpPort, function(){
  console.log('http server listening on *:' + httpPort);
});

io.sockets.on('connection', function(socket) {

    var clientIP = socket.request.connection.remoteAddress;

    console.log('a client (id: '+socket.id+') connected from ' + clientIP);

    socket.on('createCode', function(code) {
        createCode(socket, code, clientIP);
    });

    var codeId = null;
    var userName = 'Anonim';
    var userColor = randomcolor({
        luminosity: 'bright',
        format: 'hex'
     });

    socket.on('userJoin', function(data) {
        codeId = data.codeId;

        if(data.userName)
            userName = data.userName

        socket.join(codeId);

        socket.to(codeId).emit('userJoin', {me: false, clientId: socket.id, userName: userName, connectedClients: getConnectedClients(codeId)});
        socket.emit('userJoin', {me: true, connectedClients: getConnectedClients(codeId)});

        console.log(userName+' join to editing '+codeId);

        getCode(socket, codeId);

        socket.on('updateCode', function(code){
            updateCode(socket, codeId, code, clientIP);
        });

        socket.on('updateMode', function(mode){
            updateMode(socket, codeId, mode, clientIP);
        });

        socket.on('updateSelection', function(selection){
            updateSelection(socket, codeId, selection, userName, userColor);
        });
    });

    socket.on('disconnecting', function () {
        console.log('a client (id: '+socket.id+') disconnected from ' + clientIP);

        if(codeId)
        {
            var room = io.sockets.adapter.rooms[codeId];
            var connectedClients = room.length;

            socket.to(codeId).emit('userLeave', {clientId: socket.id, userName: userName, connectedClients: (getConnectedClients(codeId)-1)});
            console.log(userName+' leave editing '+codeId);
        }
    });

});

function getConnectedClients(codeId)
{
    var room = io.sockets.adapter.rooms[codeId];
    
    return room.length;
}

function createCode(socket, code, createIP)
{
    var createDate = moment().format('YYYY-MM-DD HH:mm:ss');

    var codeId = null;
    var i = 0;

    create();

    function create()
    {
        codeId = randomstring.generate({
            length: 6,
            charset: 'alphabetic'
        });

        db.run('INSERT INTO code (id, value, mode, create_date, create_ip) VALUES(?, ?, ?, ?, ?)', [codeId, code.value, code.mode, createDate, createIP], function(err, row) {

            if(i >= 10)
                return;

            if(err)
            {
                i++;
                create();
            }
            else
            {
                socket.emit('createCode', {
                    codeId: codeId
                });
            }
        });
    }

}

function getCode(socket, codeId)
{
    db.get('SELECT * FROM code WHERE id = ?', [codeId], function(err, code) {

        if(!code)
            return;

        socket.emit('setCode', {
            value: code.value,
            createDate: code.create_date,
            modifyDate: code.modify_date,
            mode: code.mode,
            init: true
        });

    });
}

function updateMode(socket, codeId, mode, modifyIp)
{
    var modifyDate = moment().format('YYYY-MM-DD HH:mm:ss');

    socket.to(codeId).emit('setMode', mode);

    db.run('UPDATE code SET mode = ?, modify_date = ?, modify_ip = ? WHERE id = ?', [mode, modifyDate, modifyIp, codeId]);
}

function updateCode(socket, codeId, code, modifyIp)
{
    var modifyDate = moment().format('YYYY-MM-DD HH:mm:ss');

    socket.to(codeId).emit('setCode', {
        value: code,
        modifyDate: modifyDate,
    });

    db.run('UPDATE code SET value = ?, modify_date = ?, modify_ip = ? WHERE id = ?', [code, modifyDate, modifyIp, codeId]);
}

function updateSelection(socket, codeId, selection, userName, userColor)
{
    socket.to(codeId).emit('setSelection', {
        clientId: socket.id,
        userName: userName,
        userColor: userColor,
        from: selection.from,
        to: selection.to
    });
}