import axios from "axios";
import gradient from "gradient-string";
import chalk from "chalk";
import express from "express";
import logger from "morgan";
import dotenv from "dotenv";
import murmurhash from "murmurhash";

import puppeteer from "puppeteer-core";
import chrome from "chrome-aws-lambda";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const PORT = process.env.PORT || 1337;

var app = express();

app.use(logger("dev"));
app.use(express.json());

let experiments = {};
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

await (async () => {
  const options = process.env.AWS_REGION
    ? {
        args: chrome.args,
        executablePath: await chrome.executablePath,
        headless: true,
      }
    : {
        args: [],
        executablePath:
          process.platform === "win32"
            ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
            : process.platform === "linux"
            ? "/usr/bin/google-chrome"
            : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headless: true,
      };

  const browser = await puppeteer.launch(options);
  const page = await browser.newPage();

  await page.goto("https://canary.discord.com/app");

  await page.setViewport({
    width: 1080,
    height: 1024,
  });

  console.log(`[*] ${chalk.hex(`#FF005C`)(`Loading Experiments...`)}`);

  experiments = await page.evaluate(() => {
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

    const stores = findByProps("getAll").getAll();

    const ExperimentStore = stores.find(
      (store) => store.constructor.displayName === "ExperimentStore"
    );

    return ExperimentStore.getRegisteredExperiments();
  });

  console.log(`[*] ${chalk.greenBright(`Done!\n`)}`);

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

  console.log(`\n`);
})();

app.get("/", (req, res) => {
  res.send(
    "Discord Experiment API - made by syndicated#6591. https://github.com/syndicated7/"
  );
});

app.get("/experiments", (req, res) => {
  let tempExperiments = [];

  for (let [key, value] of Object.entries(experiments)) {
    tempExperiments.push({
      id: key,
      hash: murmurhash.v3(key),
      creationDate: findExperimentCreationDate(key),
      ...value,
    });
  }

  res.json(tempExperiments);
});

app.get("/experiments/:id", (req, res) => {
  let tempExperiments = [];

  for (let [key, value] of Object.entries(experiments)) {
    tempExperiments.push({
      id: key,
      hash: murmurhash.v3(key),
      creationDate: findExperimentCreationDate(key),
      ...value,
    });
  }

  res.json(
    tempExperiments.find((experiment) => experiment.id === req.params.id)
  );
});

app.listen(PORT, () => {
  console.log(`[*] ${chalk.blueBright(`API listening on port ${PORT}.\n`)}`);
});
