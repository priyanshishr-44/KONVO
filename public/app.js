// ======================================
// KONVO - Conversations Find Their Space
// Frontend Application Logic
// ======================================


// ======================================
// SOCKET CONNECTION
// ======================================

const socket = io({
    autoConnect: false
});

const connectionText = document.getElementById("connectionText");
const statusDot = document.querySelector(".status-dot");

socket.on("connect", () => {

    if (connectionText) {
        connectionText.textContent = "Connected";
    }

    if (statusDot) {
        statusDot.style.background = "#a5e6ca";
    }

});

socket.on("disconnect", () => {

    if (connectionText) {
        connectionText.textContent = "Disconnected";
    }

    if (statusDot) {
        statusDot.style.background = "#ff7777";
    }

});

socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
    showToast("Connection failed. Please try again.");
});


// ======================================
// USER DATA
// ======================================

let username = "";
let currentUser = null;
let currentRoom = null;


// ======================================
// ELEMENTS
// ======================================

const createRoomModal = document.getElementById("createRoomModal");

const roomNameInput = document.getElementById("roomNameInput");

const profileName = document.getElementById("profileName");
const profileAvatar = document.getElementById("profileAvatar");

const roomList = document.getElementById("roomList");
const chatArea = document.getElementById("chatArea");

const roomBadge = document.getElementById("roomBadge");

const toast = document.getElementById("toast");


// ======================================
// TOAST NOTIFICATION
// ======================================

function showToast(message) {

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);

}


// ======================================
// USER PROFILE
// ======================================

function updateProfile() {

    if (profileName) {
        profileName.textContent = username || "User";
    }

    if (profileAvatar) {
        profileAvatar.textContent = username
            ? username.charAt(0).toUpperCase()
            : "U";
    }

}


// ======================================
// LOGOUT
// ======================================

const logoutButton = document.getElementById("changeNameBtn");

if (logoutButton) {

    logoutButton.textContent = "Logout";

    logoutButton.addEventListener("click", async () => {

        try {

            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            const data = await response.json();

            if (response.ok && data.success) {

                socket.disconnect();

                window.location.href = "/";

            } else {

                showToast(data.message || "Unable to logout.");

            }

        } catch (error) {

            console.error("Logout error:", error);

            showToast("Something went wrong.");

        }

    });

}


// ======================================
// CREATE ROOM MODAL
// ======================================

const createRoomButton = document.getElementById("createRoomBtn");

if (createRoomButton) {

    createRoomButton.addEventListener("click", () => {

        if (!username) {
            showToast("Please login first.");
            return;
        }

        createRoomModal.classList.add("show");

    });

}


const addRoomButton = document.querySelector(".add-room");

if (addRoomButton) {

    addRoomButton.addEventListener("click", () => {

        if (!username) {
            showToast("Please login first.");
            return;
        }

        createRoomModal.classList.add("show");

    });

}


const closeCreateModal = document.getElementById("closeCreateModal");

if (closeCreateModal) {

    closeCreateModal.addEventListener("click", () => {

        createRoomModal.classList.remove("show");

    });

}


// ======================================
// CREATE ROOM
// ======================================

const confirmCreateRoom = document.getElementById("confirmCreateRoom");

if (confirmCreateRoom) {

    confirmCreateRoom.addEventListener("click", () => {

        const roomName = roomNameInput.value.trim();

        if (!username) {
            showToast("Please login first.");
            return;
        }

        if (!roomName) {
            showToast("Please enter a room name.");
            return;
        }

        socket.emit("create-room", {
            roomName
        }, (response) => {

            if (!response || !response.success) {

                showToast(response?.message || "Unable to create room.");

                return;

            }

            currentRoom = {
                code: response.roomCode,
                name: response.roomName
            };

            roomNameInput.value = "";

            createRoomModal.classList.remove("show");

            addRoomToSidebar(currentRoom);

            openChatWorkspace();

socket.emit("get-message-history");

showToast("Your room has been created!");


        });

    });

}


// ======================================
// JOIN ROOM
// ======================================

const joinRoomButton = document.getElementById("joinRoomBtn");

if (joinRoomButton) {
    joinRoomButton.addEventListener("click", joinRoom);
}


function joinRoom() {

    const roomCodeInput = document.getElementById("roomCodeInput");

    const roomCode = roomCodeInput.value.trim().toUpperCase();

    if (!username) {
        showToast("Please login first.");
        return;
    }

    if (!roomCode) {
        showToast("Enter a room invitation code.");
        return;
    }

    socket.emit("join-room", {
        roomCode
    }, (response) => {

        if (!response || !response.success) {

            showToast(response?.message || "Unable to join room.");

            return;

        }

        currentRoom = {
            code: response.roomCode,
            name: response.roomName
        };

        roomCodeInput.value = "";

        addRoomToSidebar(currentRoom);
openChatWorkspace();

socket.emit("get-message-history");

showToast("Welcome to " + response.roomName + "!");

    });

}


// ======================================
// SIDEBAR ROOM
// ======================================

function addRoomToSidebar(room) {

    const existing = document.getElementById("room-" + room.code);

    if (existing) return;

    const button = document.createElement("button");

    button.className = "nav-item";

    button.id = "room-" + room.code;

    button.textContent = "◈ " + room.name;

    button.addEventListener("click", () => {

        if (currentRoom?.code === room.code) return;

        socket.emit("join-room", {
            roomCode: room.code
        }, (response) => {

            if (response && response.success) {

                currentRoom = {
                    code: response.roomCode,
                    name: response.roomName
                };

                openChatWorkspace();

socket.emit("get-message-history");

            } else {

                showToast("This room is no longer available.");

            }

        });

    });

    const emptyMessage = roomList.querySelector(".empty-rooms");

    if (emptyMessage) {
        emptyMessage.remove();
    }

    roomList.appendChild(button);

}

// ======================================
// LOAD MY SAVED ROOMS
// ======================================

async function loadMyRooms() {

    try {

        const response = await fetch("/api/users/my-rooms", {
            credentials: "same-origin"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            showToast("Unable to load your rooms.");
            return;
        }

        if (data.rooms.length === 0) {
            roomList.innerHTML = `
                <p class="empty-rooms">Your rooms will appear here.</p>
            `;
            return;
        }

        roomList.innerHTML = "";

        data.rooms.forEach(room => {

            addRoomToSidebar({
                code: room.roomCode,
                name: room.name
            });

        });

    } catch (error) {

        console.error("Load My Rooms Error:", error);

        showToast("Unable to load saved rooms.");

    }

}

// ======================================
// CHAT WORKSPACE
// ======================================

function openChatWorkspace() {

    roomBadge.textContent = currentRoom.code;

    chatArea.innerHTML = "";

    const header = document.createElement("div");

    header.className = "chat-room-header";

    const roomTitle = document.createElement("h3");

    roomTitle.textContent = currentRoom.name;

    const roomCode = document.createElement("p");

    roomCode.textContent = "Invitation code: " + currentRoom.code;

    const copyButton = document.createElement("button");

    copyButton.textContent = "Copy code";

    copyButton.addEventListener("click", async () => {

        try {

            await navigator.clipboard.writeText(currentRoom.code);

            showToast("Room code copied!");

        } catch {

            showToast("Unable to copy room code.");

        }

    });

    header.append(roomTitle, roomCode, copyButton);


    // MEMBERS

    const members = document.createElement("div");

    members.className = "members-list";

    members.id = "membersList";

    members.textContent = "Members: waiting...";


    // MESSAGES

    const messages = document.createElement("div");

    messages.className = "messages-container";

    messages.id = "messagesContainer";


    // TYPING INDICATOR

    const typing = document.createElement("div");

    typing.className = "typing-indicator";

    typing.id = "typingIndicator";


    // MESSAGE FORM

    const composer = document.createElement("form");

    composer.className = "message-composer";

    const input = document.createElement("input");

    input.type = "text";

    input.placeholder = "Write something meaningful...";

    input.id = "messageInput";

    input.maxLength = 2000;

    const sendButton = document.createElement("button");

    sendButton.type = "submit";

    sendButton.textContent = "Send ↗";


    composer.append(input, sendButton);

    chatArea.append(
        header,
        members,
        messages,
        typing,
        composer
    );


    // SEND MESSAGE

    composer.addEventListener("submit", (event) => {

        event.preventDefault();

        const message = input.value.trim();

        if (!message) return;

        socket.emit("send-message", {
            message
        });

        input.value = "";

        socket.emit("stop-typing");

    });


    // TYPING

    input.addEventListener("input", () => {
        socket.emit("typing");
    });


    input.addEventListener("blur", () => {
        socket.emit("stop-typing");
    });

}

// ======================================
// RECEIVE MESSAGE HISTORY
// ======================================

socket.on("message-history", (messages) => {

    if (!currentRoom) return;

    const container = document.getElementById("messagesContainer");

    if (!container) return;

    container.replaceChildren();

    messages.forEach((data) => {

        const messageBox = document.createElement("div");

        messageBox.className = "message-item";

        if (data.username === username) {
            messageBox.classList.add("own-message");
        }

        const name = document.createElement("strong");
        name.textContent = data.username;

        const content = document.createElement("p");
        content.textContent = data.message;

        const time = document.createElement("small");
        time.textContent = data.time;

        messageBox.append(name, content, time);

        container.appendChild(messageBox);

    });

    container.scrollTop = container.scrollHeight;

});

// ======================================
// RECEIVE MESSAGES
// ======================================

socket.on("new-message", (data) => {

    if (!currentRoom) return;

    const container = document.getElementById("messagesContainer");

    if (!container) return;

    const messageBox = document.createElement("div");

    messageBox.className = "message-item";

    if (data.username === username) {
        messageBox.classList.add("own-message");
    }

    const name = document.createElement("strong");

    name.textContent = data.username;

    const content = document.createElement("p");

    content.textContent = data.message;

    const time = document.createElement("small");

    time.textContent = data.time;

    messageBox.append(name, content, time);

    container.appendChild(messageBox);

    container.scrollTop = container.scrollHeight;

});


// ======================================
// ROOM MEMBERS
// ======================================

socket.on("room-members", (members) => {

    const container = document.getElementById("membersList");

    if (!container || !currentRoom) return;

    container.replaceChildren();

    const heading = document.createElement("strong");

    heading.textContent = "Members (" + members.length + ")";

    container.appendChild(heading);

    members.forEach(member => {

        const item = document.createElement("span");

        item.textContent = "● " + member.username;

        container.appendChild(item);

    });

});


// ======================================
// TYPING INDICATOR
// ======================================

socket.on("user-typing", (data) => {

    const indicator = document.getElementById("typingIndicator");

    if (!indicator) return;

    indicator.textContent = data.username + " is typing...";

});


socket.on("user-stop-typing", () => {

    const indicator = document.getElementById("typingIndicator");

    if (indicator) {
        indicator.textContent = "";
    }

});


// ======================================
// MEMBER LEAVING
// ======================================

socket.on("user-left", (data) => {

    showToast(data.username + " left the room.");

});


// ======================================
// ORIGINAL BACKEND EVENTS
// ======================================

socket.on("click", (message) => {

    console.log("Server:", message);

});

socket.on("join", (message) => {

    console.log("User event:", message);

});

socket.on("announcement", (message) => {

    console.log("Announcement:", message);

});


// ======================================
// AUTHENTICATION
// ======================================

async function initializeAuthenticatedApp() {

    try {

        const response = await fetch("/api/users/me", {
            credentials: "same-origin"
        });

        const data = await response.json();

        if (!response.ok || !data.success) {

            showToast("Please login to continue.");

            return;

        }

        currentUser = data.user;

        username = currentUser.username;

        updateProfile();
await loadMyRooms();
        socket.connect();

    } catch (error) {

        console.error("Authentication error:", error);

        showToast("Unable to verify your login.");

    }

}


// ======================================
// START APPLICATION
// ======================================

initializeAuthenticatedApp();