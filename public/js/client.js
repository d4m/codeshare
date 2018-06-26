$(function () {
    var isChange = false;
    var isModeChange = false;
    var isSelectionChange = false;
    var isStarted = false;

    var codeId = _codeId;
    var socket = io();

    socket.on('connect', function() {
        startEditing();
    });

    var ViewModel = function() {
        var self = this;

        self.userName = ko.observable(localStorage.getItem('userName') || 'Anonim');
        self.connectedClients = ko.observable(0);
        self.isStarted = ko.observable(false);
        self.createDate = ko.observable(null);
        self.modifyDate = ko.observable(null);
        self.currentLine = ko.observable(0);
        self.currentCol = ko.observable(0);
        self.modeOptions = ko.observableArray(editorModes);
        self.selectedMode = ko.observable();
        self.createCode = createCode;

        self.modeChanged = function() {
            setMode(self.selectedMode());

            if(isStarted)
                isModeChange = true;
            else
                localStorage.setItem('mode', self.selectedMode());
        }

        self.userName.subscribe(function(value) {
            localStorage.setItem('userName', value);
        });

        self.modifyDate.subscribe(function(value) {
            document.title = self.modifyDate() + ' - Podziel się swoim kodem';
        });
    };
    
    var viewModel = new ViewModel();
    ko.applyBindings(viewModel);

    socket.on('createCode', function(result) {

        if(result.codeId)
        {
            codeId = result.codeId;

            history.pushState(null, null, '/'+codeId);
            startEditing();
        }
    });

    CodeMirror.modeURL = "/codemirror/mode/%N/%N.js";

    var editor = CodeMirror($('#Editor')[0], {
        lineNumbers: true,
        styleActiveLine: true,
        matchBrackets: true,
        theme: 'base16-dark',
        mode: null,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-users']
    });
  
    editor.setSize('100%', '100%');

    editor.on('change', function(_editor, _changes) {
        if(isStarted || codeId )
            return;

        localStorage.setItem('code', editor.getValue());
    });

    editor.on('cursorActivity', function(_editor, _change) {
        var cursorPos = editor.getCursor();

        viewModel.currentLine(cursorPos.line+1);
        viewModel.currentCol(cursorPos.ch);
    });

    if(!codeId)
    {
        editor.setValue(localStorage.getItem('code') || '');
        setMode(localStorage.getItem('mode'));
    }

    function setCode(code)
    {
        if(code.mode)
            setMode(code.mode);

        var cursorPos = editor.getCursor();

        editor.setValue(code.value);
        editor.setCursor(cursorPos);

        if(code.createDate)
            viewModel.createDate(code.createDate);

        viewModel.modifyDate(code.modifyDate);

        isChange = false;
    }

    function setMode(mode)
    {
        CodeMirror.autoLoadMode(editor, mode);
        editor.setOption('mode', mode);
        viewModel.selectedMode(mode);
    }

    function createCode()
    {
        socket.emit('createCode', {value: editor.getValue(), mode: editor.getMode().name});
    }

    var users = {}

    function clearUser(clientId)
    {
        if(!users[clientId])
            return;

        var user = users[clientId];

        if(user.selection)
        {
            user.selection.clear();
            user.selection = null;
        }

        if(user.marker)
        {
            $(user.marker).remove();
            user.marker = null;
        }

        if(user.cursor)
        {
            $(user.cursor).remove();
            user.cursor = null;
        }
    }

    function clearAllUsers()
    {
        $.each(Object.keys(users), function(i, clientId) {
            clearUser(clientId);
        });
    }

    function setSelection(selection)
    {
        clearUser(selection.clientId);

        if(!users[selection.clientId])
        {
            users[selection.clientId] = {
                marker: null,
                seletion: null,
                cursor: null
            };
        }

        if(selection.from != selection.to)
            users[selection.clientId].selection = editor.markText(selection.from, selection.to, {css: 'background-color: '+selection.userColor, title: 'Zaznaczone przez użytkownika '+selection.userName});

        var marker = makeUserMarker(selection.userName, selection.userColor);
        editor.addWidget({line: selection.from.line, ch: 0}, marker);
        users[selection.clientId].marker = marker;

        var cursor = makeUserCursor(selection.userName, selection.userColor);
        editor.addWidget({line: selection.from.line, ch: selection.from.ch}, cursor);
        users[selection.clientId].cursor = cursor;
    }

    function makeUserMarker(userName, userColor) {
        var wrapper = $('<div></div>');
        var marker = $('<div>●</div>').css({
            color: userColor,
        }).addClass('userMarker').attr('title', userName);

        wrapper.append(marker);

        return wrapper[0];
    }

    function makeUserCursor(userName, userColor) {
        var wrapper = $('<div></div>');
        var marker = $('<div>&nbsp;</div>').css({
            'border-color': userColor
        }).addClass('userCursor')[0];

        wrapper.append(marker);

        return wrapper[0];
    }

    function joinEditing()
    {
        clearAllUsers();
        socket.emit('userJoin', {codeId: codeId, 'userName': viewModel.userName()});
    }

    function startEditing()
    {
        if(!codeId)
            return;

        joinEditing();

        if(isStarted)
            return;

        editor.on('change', function(_editor, _changes) {

            if(isChange = true)
                return;
    
            isChange = true;
        });

        editor.on('cursorActivity', function(_editor, _change) {

            if(isSelectionChange)
                return;

            isSelectionChange = true;
        });

        socket.on('setMode', function(mode) {
            setMode(mode);
        });

        socket.on('setCode', function(code) {
            setCode(code);
        });

        socket.on('setSelection', function(selection) {
            setSelection(selection);
        });

        socket.on('userJoin', function(status) {
            if(!status.me)
                toastJoin(status.userName);

            viewModel.connectedClients(status.connectedClients);
        });

        socket.on('userLeave', function(status) {
            clearUser(status.clientId);
            toastLeave(status.userName);
            viewModel.connectedClients(status.connectedClients);
        });

        setInterval(function() {

            if(isModeChange || isChange)
                viewModel.modifyDate(moment().format('YYYY-MM-DD HH:mm:ss'));

            if(isModeChange)
            {
                socket.emit('updateMode', editor.getMode().name);
                isModeChange = false;
            }

            if(isChange)
            {
                socket.emit('updateCode', editor.getValue());
                isChange = false;
            }

            if(isSelectionChange)
            {
                var selection = {
                    from: editor.getCursor(true),
                    to: editor.getCursor(false)
                }

                socket.emit('updateSelection', selection);
                isSelectionChange = false;
            }

        }, 1000);

        isStarted = true;
        viewModel.isStarted(true);
    }

    function toastJoin(userName)
    {
        $.toast({ 
            text : userName+' dołączył do edytowania',
            showHideTransition : 'slide',
            loaderBg: '#9EC600',
            bgColor : 'green',
            textColor : '#eee',
            allowToastClose : true,
            hideAfter : 2000,
            stack : 5,
            textAlign : 'left',
            position : 'top-right'
        })
    }

    function toastLeave(userName)
    {
        $.toast({ 
            text : userName+' opuścił edytowanie',
            showHideTransition : 'slide',
            loaderBg: '#ff8484',
            bgColor : '#d60808',
            textColor : '#eee',
            allowToastClose : true,
            hideAfter : 2000,
            stack : 5,
            textAlign : 'left',
            position : 'top-right'
        })
    }
});
