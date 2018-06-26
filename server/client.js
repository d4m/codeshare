const randomstring = require('randomstring');
const randomcolor = require('randomcolor');
const utils = require('./utils.js');

class Client {
    constructor(io, socket, db) {
        this.io = io;
        this.socket = socket;
        this.db = db;

        this.codeId = null;
        this.userName = 'Anonim';
        this.userColor = randomcolor({
            luminosity: 'bright',
            format: 'hex'
        });

        this.userIP = this.getClientIP()
    }

    getClientIP() {
        return this.socket.client.request.headers['x-forwarded-for'] ||
            this.socket.client.conn.remoteAddress ||
            this.socket.conn.remoteAddress ||
            this.socket.request.connection.remoteAddress;
    }

    emitOthers(name, data) {
        this.socket.to(this.codeId).emit(name, data);
    }

    emitMe(name, data) {
        this.socket.emit(name, data);
    }

    joinEdit(data) {
        this.codeId = data.codeId;

        if(data.userName)
            this.userName = data.userName;

        this.socket.join(this.codeId);

        this.emitOthers('userJoin', {
            me: false,
            clientId: this.socket.id,
            userName: this.userName,
            connectedClients: this.getUsersCount()
        });

        this.emitMe('userJoin', {
            me: true,
            connectedClients: this.getUsersCount()
        });

        this.getCode();

        utils.printLog(this.userName+' join to editing '+this.codeId+' from '+this.userIP);
    }

    leaveEdit() {
        if(this.codeId)
        {
            this.emitOthers('userLeave', {
                clientId: this.socket.id,
                userName: this.userName,
                connectedClients: (this.getUsersCount()-1)
            });
                
            utils.printLog(this.userName+' leave editing '+this.codeId+' from '+this.userIP);
        }
    }

    getUsersCount() {
        var room = this.io.sockets.adapter.rooms[this.codeId];
        return room.length;
    }

    getCode() {
        var self = this;

        this.db.get('SELECT * FROM code WHERE id = ?', [this.codeId], function(err, code) {

            if(!code)
                return;

            self.emitMe('setCode', {
                value: code.value,
                createDate: code.create_date,
                modifyDate: code.modify_date,
                mode: code.mode,
                init: true
            });
    
        });
    }

    updateMode(mode)
    {
        this.emitOthers('setMode', mode);

        this.db.run('UPDATE code SET mode = ?, modify_date = ?, modify_ip = ? WHERE id = ?', [
            mode,
            utils.getDate(),
            this.userIP,
            this.codeId
        ]);
    }
    
    updateCode(code)
    {
        this.emitOthers('setCode', {
            value: code,
            modifyDate: utils.getDate(),
        });

        this.db.run('UPDATE code SET value = ?, modify_date = ?, modify_ip = ? WHERE id = ?', [
            code,
            utils.getDate(),
            this.userIP,
            this.codeId
        ]);
    }
    
    updateSelection(selection)
    {
        this.emitOthers('setSelection', {
            clientId: this.socket.id,
            userName: this.userName,
            userColor: this.userColor,
            from: selection.from,
            to: selection.to
        });
    }

    createCode(code)
    {
        var self = this;
        var codeId = null;
        var i = 0;
    
        create();
    
        function create()
        {
            codeId = randomstring.generate({
                length: 6,
                charset: 'alphabetic'
            });
    
            self.db.run('INSERT INTO code (id, value, mode, create_date, create_ip) VALUES(?, ?, ?, ?, ?)', [
                codeId,
                code.value,
                code.mode,
                utils.getDate(),
                self.userIP
            ], function(err, row) {
    
                if(i >= 10)
                    return;
    
                if(err)
                {
                    i++;
                    create();
                }
                else
                {
                    self.emitMe('createCode', {
                        codeId: codeId
                    });
    
                    utils.printLog(self.userName+' created code '+codeId+' from '+self.userIP);
                }
            });
        }
    }
}

module.exports = Client;
