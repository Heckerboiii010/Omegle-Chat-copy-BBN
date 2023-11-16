const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { serveClient: false }); // Disable default server

// Store active rooms and their occupants
const activeRooms = {};

app.use(express.static(path.join(__dirname)));

io.on('connection', (socket) => {
  let currentRoom;
  let partnerSocket;

  // Receive the username from the client
  socket.on('setUserName', (data) => {
    socket.username = data.name;
  });

  // Check if there's an available room with one occupant
  const availableRoom = Object.keys(activeRooms).find((roomId) => activeRooms[roomId].length === 1);

  // If an available room exists, join the partner
  if (availableRoom) {
    currentRoom = availableRoom;
    partnerSocket = activeRooms[availableRoom][0];
    partnerSocket.emit('partnerConnected', { username: socket.username, id: socket.id });

    activeRooms[currentRoom].push(socket);
    socket.join(currentRoom);

    // Notify both users in the room that they are connected
    io.to(currentRoom).emit('connectionEstablished', { message: 'You are now connected with a partner.' });
  } else {
    // If no available rooms, create a new room and wait for a second user
    currentRoom = socket.id;
    activeRooms[currentRoom] = [socket];
    socket.join(currentRoom);

    // Notify the user they are waiting for a partner
    socket.emit('waitingForPartner');
  }

  // Handle message broadcasting
  socket.on('message', (message) => {
    if (currentRoom) {
      io.to(currentRoom).emit('message', { message, username: socket.username, id: socket.id });
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    if (currentRoom) {
      const remainingSocket = activeRooms[currentRoom][0];

      // Remove the disconnected user from the room
      activeRooms[currentRoom] = activeRooms[currentRoom].filter((roomSocket) => roomSocket.id !== socket.id);

      // If the room becomes empty, remove it from the list of active rooms
      if (activeRooms[currentRoom].length === 0) {
        delete activeRooms[currentRoom];
      } else {
        // If the room still has one occupant, notify the remaining user of the disconnection
        remainingSocket.emit('partnerDisconnected', { username: socket.username, id: socket.id });
      }
    }
  });
});

server.listen(5500, () => {
  console.log('Server listening on port 5500');
});
