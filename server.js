const http = require('./server/http.js');
const io = require('socket.io')(http);
const db = require('./server/db.js');
const Client = require('./server/client.js');

io.sockets.on('connection', function(socket) {
    var client = new Client(io, socket, db);

    socket.on('createCode', function(code) {
        client.createCode(code);
    });

    socket.on('userJoin', function(data) {
        client.joinEdit(data);

        socket.on('updateCode', function(code){
            client.updateCode(code);
        });

        socket.on('updateMode', function(mode){
            client.updateMode(mode);
        });

        socket.on('updateSelection', function(selection){
            client.updateSelection(selection);
        });
    });

    socket.on('disconnecting', function () {
        client.leaveEdit();
    });
});
