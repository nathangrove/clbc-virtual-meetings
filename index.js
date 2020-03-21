var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var fs = require('fs');
const crypto = require('crypto')



var database;
var sockets = [];

function logIt(req,res){
  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log("[" + new Date().toISOString() + "] " + res.statusCode + ' ' + ip + " " + req.headers['user-agent'] + ' ' + req.url)
}

app.get('/', function(req, res){
  return res.sendFile(__dirname + '/index.html');
});
app.get('/admin', function(req, res){
  return res.sendFile(__dirname + '/admin.html');
});

app.use('*', (req,res,next) => {

  if (!req.headers['authorization']){
    res.sendStatus(401);
    return logIt(req,res);
  }

  let authorization = req.headers['authorization'].split(' ')[1];
  if (!authorization){
    res.sendStatus(401);
    return logIt(req,res);
  }

  let [username, password] = Buffer.from(authorization, 'base64').toString().split(':');

  let pwd = crypto.createHash('md5').update(password).digest("hex")

  let user = database.users.find( u => u.username == username );

  if ( user && user.password == pwd ){
    req.username = username;
    next();

  } else {
    res.sendStatus(401);
    return logIt(req,res);
  }
})

app.get('/api/sessions', (req,res,next) => {


  res.send({ result: database.sessions.filter( s => s.username && ( s.status == 'IN-MEETING' || s.status == 'CONNECTED' ) ) });

  next();
    
});

app.get('/api/sessions/:session/own/:id', (req,res,next) => {

  let session = database.sessions.find( s => s.id == req.params.session );
  if (!session){
    res.status(400);
    res.send({ error: "Invalid session ID" });

  } else if (session.status == 'DISCONNECTED'){
      res.status(400);
      res.send({ error: "Session already disconnected" });

  } else if (session.status == 'IN-MEETING'){
    res.status(400);
    res.send({ error: "Session is already in a meeting" });
  } else res.send({ success: true });

  session.owner = req.username;
  session.status = 'IN-MEETING';
  console.log(session);

  var socket = sockets.find( s => s.session.id == session.id );
  socket.sock.emit('join',req.params.id);

  next();

});


app.use('*', (req,res) => {
  logIt(req,res);
  res.end();
});


io.on('connection', function(socket){

  let session = {};

  var establishSession = function(){
    var id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    socket.emit('id', id);
    session.id = id;
    session.created = new Date().getTime();
    session.lastConnected = new Date().getTime();
    database.sessions.push(session);
  }
  
  socket.on('new', () => {
    establishSession();
  });
  
  socket.on('id', (id) => {
    
    if (!database.sessions[id]){
      establishSession();

    } else {
      session = database.sessions.find( s => s.id == id );
      session.lastConnected = new Date().getTime();

    }

    sockets.push({
      sock: socket,
      session: session
    });

    session.status = 'CONNECTED';
  })

  socket.on('username', username => {
    session.username = username;
  });
  
  socket.on('disconnect', function(){
    console.log('user disconnected');
    session.status = 'DISCONNECTED';
  });
  
  
});

var commitDatabase = function(){
  let tmp = {
    "users": database.users,
    "sessions": database.sessions
  }
  fs.writeFileSync('./database.json',JSON.stringify(tmp));
}

http.listen(3000, function(){

  try {
    database = JSON.parse(fs.readFileSync('./database.json'));
    database.sessions.forEach( s => s.status = 'DISCONNECTED' );

  } catch (e){
    database = {
      sessions: [],
      users: []
    };
  }

  console.log('listening on *:3000');

  setInterval(commitDatabase,1000);
});

