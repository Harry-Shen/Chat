async function test() {
    for (let i = 0; i < 100; i++) {
        await wait(100);
        console.log(i);
    }
}

async function wait(t) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, t, true);
    });
}

test();
