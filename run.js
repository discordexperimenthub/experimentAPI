import { fork } from 'child_process';

for (let i = 0; i < 10; i++) {
    const child = fork('rollout-calculation.js');

    child.on('message', (message) => {
        console.log(`[${i + 1}]: ${message}`);
    });

    child.on('error', (error) => {
        console.error(`[${i + 1}]: ${error}`);
    });

    child.on('exit', (code, signal) => {
        console.log(`[${i + 1}]: Child process exited with code ${code} and signal ${signal}`);
    });

    console.log(`Forked child process ${i + 1}`);
};