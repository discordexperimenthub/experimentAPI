import { readFileSync, writeFileSync } from 'node:fs';
import axios from 'axios';
import wait from "delay";

(async () => {
    const numRequests = 10;
    const apiUrl = 'https://canary.discord.com/api/v10/experiments';
    const experiments = [];

    async function getRanges() {
        let ranges = {};

        for (let i = 0; i < numRequests; i++) {
            const allExperimentsResponse = await axios.get(apiUrl).then(res => res.data);
            const allExperiments = allExperimentsResponse.assignments;

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

            console.log(`Collected ${i + 1} of ${numRequests} data`);

            await wait(700);
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
                    start: min,
                    end: max
                };
            };
        };

        return experimentRanges;
    };

    const experimentRanges = await getRanges();
    const existing = JSON.parse(readFileSync('./user-experiments.json', 'utf-8'));

    writeFileSync('./user-experiments.json', JSON.stringify(existing.concat(experimentRanges), null, 2));

    console.log('Done!');

    process.exit(0);
})();