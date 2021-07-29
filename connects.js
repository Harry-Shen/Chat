//Mysql connnection
const mysql = require("mysql");

let connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "chat",
});

connection.connect((err) => {
    if (err) {
        console.error("database connect failed", err);
    } else {
        console.log("database connect succeed");
    }
});

exports.sql = connection;

//Express connection
const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
let app = express();
app.use(cors());
app.use(fileUpload());
app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
exports.app = app;

//Socket io connection
const http = require("http");
const server = http.createServer(app);
server.listen(5000, () => {
    console.log("listening on 5000");
});
const { Server } = require("socket.io");
exports.io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
