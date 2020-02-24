const uniqid = require("uniqid");
const webSocketsServerPort = 4000;
const webSocketServer = require("websocket").server;
const http = require("https");
// Spinning the http server and the websocket server.
const server = http.createServer();
server.listen(webSocketsServerPort);
const wsServer = new webSocketServer({
  httpServer: server,
  autoAcceptConnections: false
});

// Generates unique ID for every new connection
const getUniqueID = () => {
  return uniqid();
};
const originIsAllowed = req => {
  return req.origin === req.httpRequest.headers.origin ? "true" : "false";
};

// Maintaining all active connections in this object
const clients = {};
// Maintaining all active users in this object
const users = {};
// The current editor content is maintained here.
let editorContent = null;
// User activity history.
let userActivity = [];

const sendMessage = json => {
  // We are sending the current data to all connected clients
  Object.keys(clients).map(client => {
    clients[client].sendUTF(json);
  });
};

const typesDef = {
  USER_EVENT: "userevent",
  CONTENT_CHANGE: "contentchange"
};

wsServer.on("request", function(request) {
  var userID = getUniqueID();
  console.log(
    new Date() +
      " Received a new connection from origin " +
      request.origin +
      "."
  );
  
  if (!originIsAllowed(request)) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    console.log(
      new Date() + " Connection from origin " + request.origin + " rejected."
    );
    return;
  }

  const connection = request.accept(null, request.origin);

  clients[userID] = connection;
  console.log(
    "connected: " + userID + " in " + Object.getOwnPropertyNames(clients)
  );
  connection.on("message", function(message) {
    if (message.type === "utf8") {
      const dataFromClient = JSON.parse(message.utf8Data);
      const json = { type: dataFromClient.type };
      if (dataFromClient.type === typesDef.USER_EVENT) {
        users[userID] = dataFromClient;
        userActivity.push(
          `${dataFromClient.username} joined to edit the document`
        );
        if (editorContent !== null) {
          json.data = { users, userActivity, editorContent };
        } else {
          json.data = { users, userActivity };
        }
      } else if (dataFromClient.type === typesDef.CONTENT_CHANGE) {
        editorContent = dataFromClient.content;
        json.data = { editorContent, userActivity }; //users
      }
      sendMessage(JSON.stringify(json));
    }
  });

  
  // user disconnected
  connection.on("close", function(connection) {
    console.log(new Date() + " Peer " + userID + " disconnected.");
    const json = { type: typesDef.USER_EVENT };

    if (users[userID]) {
      userActivity.push(`${users[userID].username} left the document`);
    }
    json.data = { users, userActivity };

    delete clients[userID];
    delete users[userID];
    if (!Object.keys(users).length) {
      userActivity = [];
      editorContent = null;
      json.data = { users, userActivity, editorContent };
      return sendMessage(JSON.stringify(json));
    }
    sendMessage(JSON.stringify(json));
  });
});

