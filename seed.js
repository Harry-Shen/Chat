const faker = require("faker");
const sql = require("./connects").sql;
const hash = require("object-hash");
const { query, query_ } = require("./utiles");

seed();
setTimeout(process.exit, 90000, 0);

async function clear() {
    await query_("DELETE FROM undelivered WHERE msg_id > 0");
    await query_("DELETE FROM msg WHERE id > 0");
    await query_("DELETE FROM `group` WHERE group_id > 0");
    await query_("DELETE FROM user WHERE id > 0");
}

async function seed() {
    await clear();

    //user
    await query_(
        `INSERT INTO user (id, username, password, nickname, profile, intro) VALUES (1, "申伟", "${hash(
            "showmethe"
        )}", "申伟", "1.jpg", "本程序开发者，电话:15368312701" )`
    );
    await query_("insert into `group` (group_id, user_id, group_name) values(1, 1, '公共群')");

    for (let i = 1; i < 10; i++) {
        const id = i + 1;
        const password = hash(id.toString());
        const first = faker.name.firstName();
        const full = faker.name.lastName() + first;
        const profile = id.toString() + ".jpg";
        await query_(
            `INSERT INTO user (id, username, password, nickname, profile, intro) VALUES (${id}, "${full}", "${password}", "${first}", "${profile}", "我是假人")`
        );
    }
    //contact
    for (let i = 1; i < 10; i++) {
        const n = Math.floor(Math.random() * 5);
        for (let j = 0; j < n; j++) {
            const user_a = i + 1;
            const user_b = randId(1, 20, user_a);
            await query_(`INSERT INTO contact VALUES (${user_a}, ${user_b})`);
            await query_(`INSERT INTO contact VALUES (${user_b}, ${user_a})`);
        }
    }

    //user id 1 have 9 friends
    for (let i = 1; i < 10; i++) {
        await query_(`INSERT INTO contact VALUES (${1}, ${i + 1})`);
        await query_(`INSERT INTO contact VALUES (${i + 1}, ${1})`);
    }

    //groups
    for (let i = 1; i < 6; i++) {
        const name = faker.lorem.word();
        for (let j = 0; j < Math.random() * 4 + 3; j++) {
            const id = randId();
            await query_("insert into `group` (group_id, user_id, group_name) values(?, ?, ?)", [i + 1, id, name]);
        }
    }

    //msgs
    await seedMsgs();

    for (let i = 0; i < 10; i++) {
        const id = randId(1, 200);
        const msg = await query(`select * from msg where id=${id}`, true);
        let receiver;
        if (msg.receiver) {
            receiver = msg.receiver;
        } else {
            receiver = randId(1, 20);
            while (receiver === id) {
                receiver = randId();
            }
        }
        await query_(`insert into undelivered values( ${msg.id}, ${receiver})`);
    }

    console.log("seed complete");
}

function randId(min = 1, max = 10, except = 0) {
    let id;
    do {
        id = Math.floor(Math.random() * (max - min)) + min;
    } while (id === except);
    return id;
}

async function seedMsgs() {
    for (let i = 0; i < 200; i++) {
        await wait(300);
        console.log(i);
        const id = i + 1;
        const sender = randId();
        const to_group = Math.random() > 0.5 ? true : false;
        const content = faker.lorem.sentence();

        let receiver, group;

        if (to_group) {
            group = randId(1, 5);
            receiver = null;
        } else {
            group = null;
            receiver = randId();
            while (receiver === sender) {
                receiver = randId();
            }
        }
        await query_(
            `INSERT INTO msg (id, content, sender, receiver, \`group\`) VALUES (${id}, "${content}", ${sender}, ${receiver}, ${group})`
        );
    }
}

async function wait(t) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, t, true);
    });
}
