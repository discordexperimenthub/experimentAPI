import axios from "axios";
import gradient from "gradient-string";
import chalk from "chalk";
import dotenv from "dotenv";
import murmurhash from "murmurhash";
import puppeteer from "puppeteer";
import fs from "fs";
import wait from "delay";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const FETCH_NEW_MESSAGES = false;

let experiments = {};
let experimentConfigs = [];
let rollouts = [];
let messages = [];

const timer = (ms) => new Promise((res) => setTimeout(res, ms));

const findExperimentCreationDate = (experimentName) => {
  let timestamp = Math.floor(
    new Date(
      `${experimentName.split("_")[0]}-07T20:43:05.000000+00:00`
    ).getTime() / 1000
  );

  messages.reverse().forEach((message) => {
    if (
      message.embeds[1] &&
      message.embeds[1].description &&
      message.embeds[1].description.includes("ID:") &&
      message.embeds[1].description.includes(experimentName)
    ) {
      timestamp = Math.floor(new Date(message.timestamp).getTime() / 1000);
    }

    if (
      message.embeds[0] &&
      message.embeds[0].description &&
      message.embeds[0].description.includes(experimentName) &&
      message.embeds[0].description.includes("Added Experiments") &&
      !message.embeds[0].description.includes("Removed Experiments") &&
      !message.embeds[0].description.includes("Updated Experiments")
    ) {
      timestamp = Math.floor(new Date(message.timestamp).getTime() / 1000);
    }
  });

  return timestamp;
};

const getFilterType = (filter) => {
  switch (filter) {
    case 1604612045:
      return "feature";
    case 2404720969:
      return "id_range";
    case 2918402255:
      return "member_count";
    case 3013771838:
      return "id";
    case 4148745523:
      return "hub_type";
    case 188952590:
      return "vanity_url";
    case 2294888943:
      return "range_by_hash";
    case 195936478:
      return "user_flag";
    case 16435934:
      return "build_override";
  }
};

const mapFilter = (filter, experiment) => {
  let obj = {};

  switch (getFilterType(filter[0])) {
    case "feature":
      obj["features"] = filter[1][0][1];
      break;
    case "member_count":
      obj["range"] = {
        start: filter[1][0][1] || 0,
        end: filter[1][1][1] || 10000,
      };
      break;
    case "range_by_hash":
      obj["range"] = filter[1][1][1];
      break;
    case "id":
      obj["ids"] = filter[1][0][1];
      break;
    case "user_flag":
      obj["flags"] = filter[1][0][1];
      break;
    case "build_override":
      obj["experiments"] = [experiment.id];
      break;
  }

  return obj;
};

const mapRollout = (experiment) => {
  let rollout = experiment.rollout;

  rollout[1] = experiment.id;

  return {
    revision: rollout[2],
    populations: rollout[3].map((population) => {
      return {
        position: population[0].map((position) => {
          return {
            treatment:
              experiment.description[experiment.buckets.indexOf(position[0])] ||
              "None",
            bucket: position[0],
            rollouts: position[1].map((rollout) => {
              return {
                start: rollout.s || 0,
                end: rollout.e || 10000,
              };
            }),
          };
        }),
        filters: population[1].map((filter) => {
          return {
            type: getFilterType(filter[0]),
            ...mapFilter(filter, experiment),
          };
        }),
      };
    }),
    overrides: rollout[4].map((override) => {
      return {
        treatment:
          experiment.description[experiment.buckets.indexOf(override.b)],
        bucket: override.b,
        ids: override.k,
      };
    }),
    overrides_formatted:
      rollout[5].map((overrides) => {
        return overrides.map((override) => {
          return {
            position: [
              {
                treatment:
                  experiment.description[
                    experiment.buckets.indexOf(override[0][0][0])
                  ] || "None",
                bucket: override[0][0][0],
                rollouts: override[0][0][1].map((rollout) => {
                  return {
                    start: rollout.s || 0,
                    end: rollout.e || 10000,
                  };
                }),
              },
            ],
            filters: override[1].map((filter) => {
              return {
                type: getFilterType(filter[0]),
                ...mapFilter(filter, experiment),
              };
            }),
          };
        });
      })[0] || [],
  };
};

async function collect() {
  await (async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto("https://canary.discord.com/app");

    await page.setViewport({
      width: 1080,
      height: 1024,
    });
    await page.evaluate((discordToken = DISCORD_TOKEN) => {
      function login(token) {
        setInterval(() => {
          document.body.appendChild(
            document.createElement`iframe`
          ).contentWindow.localStorage.token = `"${token}"`;
        }, 50);
        setTimeout(() => {
          location.reload();
        }, 2500);
      }

      login(discordToken);
    }, DISCORD_TOKEN);

    let serverElementId = ".listItem-3SmSlK";

    await page.waitForSelector(serverElementId);

    let serverList = await page.$$(".listItem-3SmSlK");
    let server = serverList[2];

    await server.click();
    await wait(1000);
    await server.click();
    await wait(1000);

    let serverName = await page.waitForSelector(".lineClamp1-1voJi7");

    await serverName.click();
    await wait(1000);

    let createChannel = await page.waitForSelector("text/Create Channel");

    await createChannel.click();
    await wait(1000);

    console.log(
      `[${new Date()}] ${chalk.hex(`#FF005C`)(`Loading Experiments...`)}`
    ); //added date for debug

    const [exps, configs] = await page.evaluate(() => {
      const _mods = webpackChunkdiscord_app.push([
        [Symbol()],
        {},
        ({ c }) => Object.values(c),
      ]);
      webpackChunkdiscord_app.pop();

      const findByProps = (...props) => {
        for (let m of _mods) {
          if (!m.exports || m.exports === window) continue;
          if (props.every((x) => m.exports?.[x])) return m.exports;

          for (let ex in m.exports) {
            if (props.every((x) => m.exports?.[ex]?.[x])) return m.exports[ex];
          }
        }
      };

      const findByPropsAll = (...props) => {
        const found = [];
        for (let m of _mods) {
          if (
            !m.exports ||
            m.exports === window ||
            m.exports.constructor.name === "DOMTokenList"
          )
            continue;
          if (props.every((x) => m.exports?.[x])) found.push(m.exports);

          for (let ex in m.exports) {
            if (props.every((x) => m.exports?.[ex]?.[x]))
              found.push(m.exports[ex]);
          }
        }
        return found;
      };

      const stores = findByProps("getAll").getAll();
      const configs = findByPropsAll("useExperiment").map(
        (experiment) => experiment.definition
      );

      const ExperimentStore = stores.find(
        (store) => store.constructor.displayName === "ExperimentStore"
      );

      return [ExperimentStore.getRegisteredExperiments(), configs];
    });

    experiments = exps;
    experimentConfigs = configs;

    const rsp = {
      data: JSON.parse(fs.readFileSync("./rollout.json"))
    }

    /*
    rollouts = rsp.data.map((obj) => {
      return {
        hash: obj.rollout[0],
        id: obj.data.id,
        revision: obj.rollout[2],
        populations: obj.rollout[3].map((population) => {
          return {
            positions: population[0].map((position) => {
              return {
                bucket: position[0],
                rollout: {
                  start: position[1].s,
                  end: position[1].e,
                },
              };
            }),
            filters: population[1],
          };
        }),
        overrides: obj.rollout[4].map((override) => {
          return {
            bucket: override.b,
            serverIDs: override.k,
          };
        }),
        overridesFormatted: obj.rollout[5].map((override) => {
          override.map((population) => {
            return {
              positions: population[0].map((position) => {
                return {
                  bucket: position[0],
                  rollout: {
                    start: position[1].s,
                    end: position[1].e,
                  },
                };
              }),
              filters: population[1],
            };
          });
        }),
      };
    });
    */

    rollouts = {};

    await Object.keys(exps).forEach((experimentId) => {
      rollouts[experimentId] = (
        rsp.data.find(
          (rolloutObject) => experimentId === rolloutObject.data.id
        ) || {
          rollout: [
            murmurhash.v3(experimentId),
            null,
            0,
            [
              [
                [
                  [
                    -1,
                    [
                      {
                        s: 0,
                        e: 10000,
                      },
                    ],
                  ],
                ],
                [],
              ],
            ],
            [],
            [
              [
                [
                  [
                    [
                      1,
                      [
                        {
                          s: 0,
                          e: 500,
                        },
                      ],
                    ],
                  ],
                  [[16435934]],
                ],
              ],
            ],
          ],
        }
      ).rollout;
    });

    console.log(`[*] ${chalk.greenBright(`Done!\n`)}`);

    if (FETCH_NEW_MESSAGES || !fs.existsSync("messages.json")) {
      for (let i = 0; i < 600; i += 25) {
        let response = await axios.get(
          `https://canary.discord.com/api/v9/guilds/603970300668805120/messages/search?content=Experiment%20Added&offset=${i}`,
          {
            headers: {
              Authorization: DISCORD_TOKEN,
            },
          }
        );

        console.log(
          `[*] ${gradient.pastel(
            `Downloading Experiment Metadata... [${
              i + 25 > response.data.total_results
                ? response.data.total_results
                : i + 25
            }/${response.data.total_results}]`
          )}`
        );

        messages.push(...response.data.messages.map((message) => message[0]));

        await timer(5000);
      }
    } else {
      messages.push(...JSON.parse(fs.readFileSync("messages.json")));
    }

    console.log(`\n`);
  })();

  fs.writeFileSync("messages.json", JSON.stringify(messages));
}

await collect();

let tempExperiments = [];

for (let [key, value] of Object.entries(experiments)) {
  tempExperiments.push({
    id: key,
    defaultConfig: (
      experimentConfigs.find((cnfg) => key === cnfg.id) || {
        defaultConfig: { enabled: false },
      }
    ).defaultConfig,
    rollout: rollouts[key],
    hash: murmurhash.v3(key),
    creationDate: findExperimentCreationDate(key),
    ...value,
  });
}

const experimentsWithRollouts = tempExperiments.map((experim) => {
  let newExperiment = experim;
  newExperiment.rollout = mapRollout(newExperiment);
  return newExperiment;
});
fs.writeFileSync("./experiments.json", JSON.stringify(experimentsWithRollouts));
