import { readFileSync, writeFileSync } from 'fs';
import axios from 'axios';

(async () => {
    console.log('Loading data...');

    const experiments = JSON.parse(readFileSync('./experiments.json', 'utf8'));
    const ranges = JSON.parse(readFileSync('./user-experiments.json', 'utf8'));

    console.log('Calculating ranges...');

    const experimentRanges = {};

    for (let group of ranges) {
        for (let [hash, buckets] of Object.entries(group)) {
            let id = experiments.filter(experiment => experiment.hash === parseInt(hash))[0]?.id;

            if (!id) {
                console.log(`No experiment found for ${hash}`);

                continue;
            };

            if (!experimentRanges[id]) experimentRanges[id] = {};

            for (let [bucket, range] of Object.entries(buckets)) {
                if (!experimentRanges[id][bucket]) experimentRanges[id][bucket] = [];

                experimentRanges[id][bucket].push(range);
            };
        };
    };

    const averageRollouts = {};

    for (let [id, buckets] of Object.entries(experimentRanges)) {
        if (!averageRollouts[id]) averageRollouts[id] = {};

        for (let [bucket, ranges] of Object.entries(buckets)) {
            let start = Math.min(...ranges.map(range => range.start));
            let end = Math.max(...ranges.map(range => range.end));

            averageRollouts[id][bucket] = {
                start,
                end
            };
        };
    };

    console.log('Uploading data...');

    const before = await axios.get('https://raw.githubusercontent.com/discordexperimenthub/experimentAPI/master/experiments.json').then(res => res.data);

    for (let [id, buckets] of Object.entries(averageRollouts)) {
        const data = experiments.filter(experiment => experiment.id === id)[0];

        for (let [bucket, range] of Object.entries(buckets)) {
            data.rollout.populations[0].position = data.rollout.populations[0].position.filter(position => !position.position && position.bucket !== -1).concat(data.rollout.overrides_formatted[0]?.position.map(p => {
                p.rollouts[0] = {
                    start: null,
                    end: null
                };

                return p;
            }));

            try {
                data.rollout.populations[0].position.filter(position => position.bucket === parseInt(bucket))[0].rollouts[0] = range;
            } catch (error) {
                data.rollout.populations[0].position.push({
                    treatment: parseInt(bucket) === 0 ? 'Control' : '[No data found]',
                    bucket: parseInt(bucket),
                    rollouts: [range],
                    confirmed: false
                });
            };

            let confirmed = false;
            let oldRange = before.filter(experiment => experiment.id === id)[0]?.rollout?.populations?.[0]?.position?.filter(position => position.bucket === parseInt(bucket))?.[0]?.rollouts?.[0];

            if (oldRange.start === range.start && oldRange.end === range.end) confirmed = true;

            data.rollout.populations[0].position.filter(position => position.bucket === parseInt(bucket))[0].confirmed = confirmed;
        };

        writeFileSync('./experiments.json', JSON.stringify(experiments.filter(experiment => experiment.id !== id).concat([data]), null, 2));
    };

    writeFileSync('user-experiments.json', JSON.stringify([], null, 2));

    console.log('Done!');
})();