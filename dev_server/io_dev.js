const fs = require('fs');

const options = {
    key: fs.readFileSync(process.env.SSLKEY),
    cert: fs.readFileSync(process.env.SSLCERT)
};

function handler(request, response) {
    response.writeHead(200, {'Content-Type': 'text/html'});
    response.write('hello world');
    response.end();
}


var app = require('https').createServer(options, handler).listen(process.env.PORT);
var io = require('socket.io').listen(app);




module.exports = {
    io
}