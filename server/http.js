const express = require('express');
const app = express();
const http = require('http').Server(app);
const utils = require('./utils.js');

const httpPort = process.env.HTTP_PORT || 3000;
const httpIP = process.env.HTTP_IP || '0.0.0.0';

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

http.listen(httpPort, httpIP, function(){
    utils.printLog('HTTP server listening on '+httpIP+':' + httpPort);
});

module.exports = http;
