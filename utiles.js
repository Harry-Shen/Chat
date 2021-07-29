const { sql } = require("./connects");

module.exports = {
    getUser(id = null, username = "") {
        if (id) {
            sql.query(`select * from user where id=${id}`, (err, res) => {
                return res.length === 0 ? null : res[0];
            });
        } else {
            sql.query(`select * from user where "id=${username}"`, (err, res) => {
                return res.length === 0 ? null : res[0];
            });
        }
    },

    async getGroupUsers(group_id, except_id = 0) {
        return await this.query("select * from `group` where group_id = ? and user_id != ?", false, [
            group_id,
            except_id,
        ]);
    },

    async query(str, strip = false, args = []) {
        const p = new Promise((resolve, reject) => {
            sql.query(str, args, (err, res) => {
                if (err) {
                    console.log(err);
                    reject("sql query failed");
                }
                if (strip) {
                    resolve(res[0]);
                } else {
                    resolve(res);
                }
            });
        });
        return p;
    },

    async query_(str, args = []) {
        const p = new Promise((resolve, reject) => {
            sql.query(str, args, (err) => {
                if (err) {
                    console.log(err);
                    if (err.code == "ER_PARSE_ERROR") {
                        reject("fail");
                    }
                    resolve(false);
                }
                resolve(true);
            });
        });
        return p;
    },
};
