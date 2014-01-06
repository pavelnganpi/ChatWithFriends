
/**
 * Module dependencies.
 */

var express = require('express'),
	routes = require('./routes'),
	app = express(),
	server = require('http').createServer(app),
	mongoose= require ('mongoose'),
	users={};
	io = require('socket.io').listen(server);
	server.listen(3000);
	mongoose.connect('mongodb://chat:microsoft@ds061258.mongolab.com:61258/chat',
			function (err){
				if (err){
					console.log(err);
				}
				else {
					console.log("connected to mongodb");
				}
			});
var chatSchema= mongoose.Schema({nick: String,
							   msg: String,
							   created: {type: Date, default: Date.now }});

var chat= mongoose.model('message', chatSchema);
var newMsg= new chat({});


// all environments
app.set('port', process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);


// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

io.sockets.on('connection', function(socket){

	//finds all the saved data(msgs) in the users object and sends
	//it to the client 
	chat.find({}, function (err,docs){
		if (err) throw err;
		socket.emit("load all msgs", docs);
	});

	//receives event for user form submition
	//checks of username is valid
	//and sends back a callback
	socket.on('new user', function (data, callback){
		if (data in users){
			callback(false);
		}
		else {
			callback(true);
			socket.nickname= data;
			users[socket.nickname]=socket;
			updateNickNames();
		}
	});

	// function to update the nicknames,
	//when ever a user disconnects
	//or connects
	function updateNickNames (){
		io.sockets.emit('usernames', Object.keys(users));
	}

	//receives the event from client
	//and sends back a message to all users
	socket.on('send message', function (data, callback){
		var msg= data.trim();
		if(msg.substr(0,3) === '/g '){
			msg= msg.substr(3);
			var ind = msg.indexOf(' ');

			//checks if message has white space
			//if it does msg gets the message parsed by user
			//else throws an error 
			if(ind !==-1){
				var name= msg.substring(0, ind);
				var msg=msg.substring(ind + 1);

				//checks for valid username and 
				//sends the whispered message or 
				// sends an error if invalid
				if(name in users){
					users[name].emit('whisper', {msg: msg,
									    nick: socket.nickname});

			 		console.log("whisper");

				}
				else {
				callback('Error! enter a valid user');
				}

			}
			else{
				callback('Error! please enter a message for your whisper');
			}
		}
		else{

			//creates a new instance of the chat model
			//parsing in the nickname and msg
			newMsg= new chat({msg: msg,
									    nick: socket.nickname});

			//saves the schema in the chat model
			newMsg.save(function (err){
				if(err) throw err;
				io.sockets.emit('new message', {msg: msg,
									    nick: socket.nickname});

			});
		}

	});
	//disconnects user
	socket.on('disconnect', function (data){
		if(!socket.nickname) return;
		io.sockets.emit('exit', {msg: "a chatter has disconnected",
									    nick: socket.nickname});
		delete users[socket.nickname];
		updateNickNames();
	});
});

