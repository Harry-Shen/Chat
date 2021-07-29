const { sql } = require("./connects");
const path = require("path");
const tools = require("./utiles");
const hash = require("object-hash");
const jwt = require("jsonwebtoken");
const faker = require("faker");

const jwt_secret =
    "6c4d1cb5fbb9e6fd1b648c0fc94e760a81ca0d59926a4565cb257f83c406b7dd6917cd87f66929895bd1cccac7a5b12767fe13ee6ed090286c3d70179be05b4e";

module.exports = {
    jwt_secret: jwt_secret,
    async login(req, res) {
        const person = await query("select * from user where username = ?", req.body.username);
        let response = {};
        if (!person) {
            response.success = false;
            response.reason = "User dose not exist.";
        } else if (person.password === hash(String(req.body.password))) {
            delete person.password;
            response.success = true;
            response.user = person;
            response.token = jwt.sign(person, jwt_secret);
        } else {
            response.success = false;
            response.reason = "Wrong password.";
        }
        res.json(response);
    },

    async uploadProfile(req, res) {
        const { file } = req.files;
        const filename = faker.datatype.uuid() + path.extname(file.name);
        file.mv(`${__dirname}/public/profile/${filename}`);
        console.log(filename);
        await query_("update user set profile=? where id = ? ", [filename, req.user.id]);
        res.json({ success: "true" });
    },

    async addToContact(req, res) {
        const contact_id = Number(req.params.id);
        await query_("insert into contact values(?,?)", [req.user.id, contact_id]);
        res.json({ success: true });
    },

    async removeFromContact(req, res) {
        const contact_id = Number(req.params.id);
        await query_("delete from contact where user_a=? and user_b=?", [req.user.id, contact_id]);
        res.json({ success: true });
    },

    async register(req, res) {
        let response = {};
        let username = sql.escape(req.body.username);
        username = username.substring(1, username.length - 1);
        if (username !== req.body.username) {
            response.success = false;
            response.reason = "Invalid character in username";
        } else {
            const person = await query("select id from user where username = ?", username);
            if (person) {
                response.success = false;
                response.reason = "User already exist. Choose another name";
            } else {
                const password = hash(String(req.body.password));
                const res = await query_(
                    `insert into user (username, password, nickname) values('${username}','${password}', '${username}')`
                );
                const user_id = res.insertId;
                const group_1 = await query("select group_name from `group` where group_id=1 limit 1");
                query_(`insert into \`group\` values(1, ${user_id}, '${group_1.group_name}', default, default)`);
                query_(`insert into contact values(${user_id}, 1)`);
                const user = await query(`select * from user where id=${user_id}`);
                delete user.password;
                response.token = jwt.sign(user, jwt_secret);
                response.user = user;
                response.success = true;
            }
        }
        res.json(response);
    },

    async getGroup(req, res) {
        const group_id = req.params.id;
        const mems = await query_("select user_id, group_name from `group` where group_id = ?", [group_id]);
        const member_ids = mems.map((m) => m.user_id);
        const group_name = mems[0].group_name;
        res.json({ success: true, group_id, group_name, member_ids });
    },

    async getUser(req, res) {
        const id = req.params.id;
        user = await query("select * from user where id=?", [id]);
        if (user) {
            delete user.password;
            res.json({ success: true, user });
        } else {
            res.json({ success: false });
        }
    },

    async getUsers(req, res) {
        let ids = sql.escape(req.body.ids.join(","));
        ids = ids.substring(1, ids.length - 1);
        users = await query_(
            `select id, username, nickname, email, register_at, profile, intro from user where id in ( ${ids} )`
        );
        if (users) {
            res.json({ success: true, users });
        } else {
            res.json({ success: false });
        }
    },

    async leaveGroup(req, res) {
        const group_id = Number(req.params.id);
        const user_id = req.user.id;
        await query_("delete from `group` where user_id=? and group_id=? ", [user_id, group_id]);
        res.json({ success: true });
    },

    async joinGroup(req, res) {
        const group_id = Number(req.params.id);
        const user_id = req.user.id;
        const group = await query("select * from `group` where group_id=? limit 1", [group_id]);
        const group_name = group.group_name;
        await query_("insert into `group` (group_id, user_id, group_name) values (?,?,?)", [
            group_id,
            user_id,
            group_name,
        ]);
        res.json({ success: true, group: { group_id, group_name } });
    },

    async getContactAndGroup(req, res) {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.json({ success: false, resaon: "invalid id" });
        } else {
            let contact = await query_("select user_b from contact where user_a = ?", [id]);
            let group = await query_("select group_id, group_name from `group` where user_id = ?", [id]);
            contact = contact.map((c) => {
                return c.user_b;
            });
            res.json({ success: true, contact, group });
        }
    },

    loginWithToken(req, res) {
        jwt.verify(req.headers.authorization, jwt_secret, (err, user) => {
            if (err) {
                console.log(err);
                res.json({ success: false, reason: "wrong or expired token" });
            } else {
                res.json({ success: true, user: user });
            }
        });
    },

    async getPrevMsg(req, res) {
        let { counterpart, user_id, is_group, latest } = req.query;
        console.log(req.query);
        counterpart = Number(counterpart);
        user_id = Number(user_id);
        latest = new Date(Number(latest));
        let msgs = [];
        if (is_group == "true") {
            msgs = await query_("select * from msg where send_at<? and `group`=? order by send_at desc limit 10", [
                latest,
                counterpart,
            ]);
        } else {
            msgs = await query_(
                "select * from msg where send_at<? and ((sender=? and receiver=?) or (receiver=? and sender=?)) order by send_at desc limit 10",
                [latest, user_id, counterpart, user_id, counterpart]
            );
        }

        msgs.reverse();
        res.json({ success: true, msgs });
    },

    async allGroup(req, res) {
        const groups = await query_("select group_id, group_name from `group` group by group_id");
        res.json({ success: true, groups });
    },

    async searchUsers(req, res) {
        let keyword = sql.escape(req.params.keyword);
        keyword = keyword.substring(1, keyword.length - 1);
        const users = await query_(`SELECT * FROM user WHERE username LIKE '%${keyword}%'`);
        res.json({ success: true, users });
    },
};

async function query_(sql, args) {
    let r = await tools.query(sql, false, args);
    return r;
}

async function query(sql, args) {
    let r = await tools.query(sql, true, args);
    if (!r) return null;
    r = { ...r };
    return r;
}
