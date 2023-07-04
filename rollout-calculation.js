import { readFileSync, writeFileSync } from 'node:fs';
import axios from 'axios';
import wait from "delay";
import { randomNumber } from '@tolga1452/toolbox.js';
import { customize } from '@tolga1452/logchu';

(async () => {
    let randomColor = [randomNumber(0, 255), randomNumber(0, 255), randomNumber(0, 255)];

    const numRequests = 10000;
    const apiUrl = 'https://canary.discord.com/api/v10/experiments';
    const experiments = [];

    async function getRanges() {
        let ranges = {};

        for (let i = 1; i < numRequests + 1; i++) {
            const allExperimentsResponse = await axios.get(apiUrl).then(res => res.data).catch(error => process.send(customize(`Errored: ${error}`)));

            if (!allExperimentsResponse) continue;

            const allExperiments = allExperimentsResponse.assignments;

            process.send(customize(`Started`, randomColor));

            for (let assignment of allExperiments) {
                let experiment = {
                    hash: assignment[0],
                    revision: assignment[1],
                    bucket: assignment[2],
                    override: assignment[3],
                    population: assignment[4],
                    hash_result: assignment[5]
                };

                if (ranges[experiment.hash.toString()]) {
                    if (!ranges[experiment.hash.toString()]?.[experiment.bucket]) ranges[experiment.hash.toString()][experiment.bucket] = [];
                } else {
                    ranges[experiment.hash.toString()] = {
                        [experiment.bucket]: []
                    };
                    experiments.push(experiment);
                };

                ranges[experiment.hash.toString()][experiment.bucket].push(experiment.hash_result);
            };

            if (!(i / 1000).toString().includes('.')) process.send(customize(`Collected ${i} of ${numRequests} data`, randomColor));

            await wait(600);
        };

        console.log('Calculating ranges...');

        const experimentRanges = {};

        for (let experimentId in ranges) {
            for (let bucket in ranges[experimentId]) {
                const max = Math.max(...ranges[experimentId][bucket]);
                const min = Math.min(...ranges[experimentId][bucket]);

                if (!experimentRanges[experimentId]) experimentRanges[experimentId] = {};
                if (!experimentRanges[experimentId][bucket]) experimentRanges[experimentId][bucket] = [];

                experimentRanges[experimentId][bucket] = {
                    start: Math.round(min / 500) * 500,
                    end: Math.round(max / 500) * 500
                };
            };
        };

        return experimentRanges;
    };

    const experimentRanges = await getRanges();

    process.send(customize(`Writing to file...`, randomColor));

    await wait(randomNumber(1000, 5000));

    const existing = JSON.parse(readFileSync('./user-experiments.json', 'utf-8'));

    writeFileSync('./user-experiments.json', JSON.stringify(existing.concat(experimentRanges), null, 2));

    console.log('Done!');

    process.exit(0);
})();
