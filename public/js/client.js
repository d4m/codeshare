$(function () {

    var isChange = false;
    var isModeChange = false;
    var isStarted = false;

    var ViewModel = function() {
        var self = this;

        self.createDate = ko.observable(null);
        self.modifyDate = ko.observable(null);

        self.modeOptions = ko.observableArray([
            {value: 'javascript', name: 'JavaScript'},
            {value: 'sql', name:  'SQL'},
            {value: 'clike', name:  'C, C++, C#'},
            {value: 'php', name:  'PHP'},
            {value: 'python', name:  'Python'},
            {value: 'xml', name:  'XML'},
            {value: 'htmlmixed', name:  'HTML'}
        ]);

        self.selectedMode = ko.observable();

        self.createCode = createCode;
        self.modeChanged = function() {
            setMode(self.selectedMode());

            if(isStarted)
                isModeChange = true;
        }
    };
    
    var viewModel = new ViewModel();
    ko.applyBindings(viewModel);

    var codeId = _codeId;
    var socket = io();

    socket.on('createCode', function(result) {

        if(result.codeId)
        {
            codeId = result.codeId;

            history.pushState(null, null, '/'+codeId);
            startEditing();
        }
    });

    var editor = CodeMirror($('#Editor')[0], {
        lineNumbers: true,
        styleActiveLine: true,
        matchBrackets: true,
        theme: 'base16-dark',
        mode:  'javascript'
    });

    editor.setSize("100%", "100%");

    startEditing();

    function setCode(code)
    {
        editor.setValue(code.value);

        if(code.mode)
            setMode(code.mode);

        if(code.createDate)
            viewModel.createDate(code.createDate);

        viewModel.modifyDate(code.modifyDate);

        isChange = false;
    }

    function setMode(mode)
    {
        editor.setOption('mode', mode);
        viewModel.selectedMode(mode);
    }

    function createCode()
    {
        socket.emit('createCode', {value: editor.getValue(), mode: editor.getMode().name});
    }

    function startEditing()
    {
        if(!codeId || isStarted)
            return;

        socket.emit('room', codeId);

        editor.on('change', function(_editor, _changes) {

            if(isChange = true)
                return;
    
            isChange = true;
        });

        socket.on('setMode', function(mode) {
            setMode(mode);
        });

        socket.on('setCode', function(code) {
            setCode(code);
        });
    
        setInterval(function() {

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
    
        }, 500);

        isStarted = true;
    }

});
