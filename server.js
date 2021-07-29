const { io, app, sql } = require("./connects");
const tools = require("./utiles");
const handlers = require("./handler");
const jwt = require("jsonwebtoken");
const { jwt_secret } = require("./handler");

//Handle REST api request
app.get("/test", (req, res) => {
    res.send("hello");
});
app.get("/user/:id", handlers.getUser);
app.get("/contact-and-group/:id", handlers.getContactAndGroup);
app.get("/group/:id", handlers.getGroup);
app.get("/prev-msg", authenticate, handlers.getPrevMsg);
app.get("/all-group", handlers.allGroup);
app.get("/search-user/:keyword", handlers.searchUsers);

app.post("/users", handlers.getUsers);
app.post("/login", handlers.login);
app.post("/register", handlers.register);
app.post("/login-token", handlers.loginWithToken);
app.post("/join-group/:id", authenticate, handlers.joinGroup);
app.post("/add-to-contact/:id", authenticate, handlers.addToContact);
app.post("/remove-from-contact/:id", authenticate, handlers.removeFromContact);
app.post("/upload-profile", authenticate, handlers.uploadProfile);

app.delete("/leave-group/:id", authenticate, handlers.leaveGroup);

function authenticate(req, res, next) {
    jwt.verify(req.headers.authorization, jwt_secret, (err, user) => {
        if (err) {
            console.log("unauthorized");
            res.sendStatus(401);
        } else {
            req.user = user;
            next();
        }
    });
}

//Handle websocket
class UserSessionMap {
    constructor() {
        this.map = new Map();
    }
    bind(user_id, session_id) {
        this.map.set(user_id, session_id);
    }
    getSocket(user_id) {
        const session_id = this.map.get(user_id);
        return io.of("/").sockets.get(session_id);
    }
}

const userSession = new UserSessionMap();

io.on("connection", (socket) => {
    attachUser(socket);
    sendOfflineMessage(socket);

    socket.on("msg", async (msg, callback) => {
        console.log(msg);
        const insert_res = await tools.query(
            "INSERT INTO msg (content, type, sender, receiver, `group`) VALUES(?, ?, ?, ?, ?)",
            false,
            [msg.content, msg.type, msg.sender, msg.receiver, msg.group]
        );
        msg.id = insert_res.insertId;
        let receivers;
        if (msg.receiver) {
            receivers = [{ user_id: msg.receiver }]; //one to one msg
        } else {
            receivers = await tools.getGroupUsers(msg.group, msg.sender); //group msg
            console.log("receivers:", receivers);
        }
        for (let i = 0; i < receivers.length; i++) {
            const re_id = receivers[i].user_id;
            if (re_id === msg.sender) continue;
            const re_socket = userSession.getSocket(re_id);
            if (re_socket && re_socket.connected) {
                re_socket.emit("msg", msg);
                callback({ success: true, id: msg.id, delivered: true });
            } else {
                sql.query("insert into undelivered values(? ,?)", [msg.id, re_id]);
                callback({ success: true, id: msg.id, delivered: false });
            }
        }
    });

    socket.on("create-group", () => {
        console.log("group? ok");
    });

    socket.on("display", () => {
        const id = socket.user.id;
        console.log(id);
        const s = userSession.getSocket(id);
        console.log(s.user);
    });

    socket.on("connect", () => {
        console.log(`${socket.handshake.address}: ${socket.id} reconnected`);
        socket.sendBuffer = [];
    });

    socket.on("disconnect", () => {
        console.log(`${socket.handshake.address}: ${socket.id} disconnected`);
    });
});

function attachUser(socket) {
    const token = socket.handshake.auth.token.trim();
    if (token != "" && token != "undefined") {
        jwt.verify(socket.handshake.auth.token, jwt_secret, (err, user) => {
            if (err) {
                console.log("unauthorized user", err);
                console.log("token:", token);
                socket.disconnect();
                return;
            }
            socket.user = user;
            userSession.bind(user.id, socket.id);
            console.log(`${socket.handshake.address}: ${socket.id} ${user.username} connected`);
        });
    } else {
        console.log(`${socket.handshake.address}: ${socket.id} unloged user connected`);
    }
}

async function sendOfflineMessage(socket) {
    if (socket.user) {
        const msgs = await tools.query(
            "SELECT id, content, sender, msg.receiver, `group`, type, deleted, send_at FROM undelivered LEFT JOIN msg ON msg_id = msg.id WHERE undelivered.receiver = ?",
            false,
            [socket.user.id]
        );
        msgs.forEach((msg) => {
            socket.emit("msg", msg);
            console.log("undelivered msg:", msg);
        });
        sql.query("delete from undelivered where receiver=?", [socket.user.id]);
    }
}
