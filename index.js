var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require('fs');


var database = {
  "sessions": {},
  "users": {}
};

function logIt(req,res){
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log("[" + new Date().toISOString() + "] " + res.statusCode + ' ' + ip + " " + req.headers['user-agent'] + ' ' + req.url)
}

app.get('/', function(req, res){
  return res.sendFile(__dirname + '/index.html');
});

app.use('*', (req,res,next) => {
  let authorization = req.headers['authorization'];
  if (!authorization){
    res.sendStatus(401);
    return logIt(req,res);
  }
})

io.on('connection', function(socket){

  var establishSession = function(){
    var id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    socket.emit('id', id);
    database.sessions[id] = {};
    database.sessions[id].id = id;
    database.sessions[id].created = new Date().toISOString();
  }
  
  socket.on('new', () => {
    establishSession();
  });
  
  socket.on('id', (id) => {
    console.log('user reconnected with id', id);
    if (!sessions[id]){
      establishSession()
    } else {
      sessions[id].lastConnected = new Date().toISOString();
    }
  })
  
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });
  
  
});

var commitDatabase = function(){
  fs.writeFileSync('./database.json',JSON.stringify(database));
}

http.listen(3000, function(){
  sessions = JSON.parse(fs.readFileSync('./database.json'));
  console.log('listening on *:3000');

  setInterval(commitDatabase,1000);
});

