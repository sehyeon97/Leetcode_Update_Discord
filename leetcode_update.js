import dot from 'dotenv';
import fetch from 'node-fetch';
import {MessageEmbed, WebhookClient} from 'discord.js';
import express from 'express';
import schedule from 'node-schedule';
import fs from 'fs';

const process = dot.config().parsed;
var app = express();

// the discord server's channel's ID is the url
const webhook = 
    new WebhookClient({ url: process.WEBHOOK});
const embedColor = '#0099ff';

const usernames = [process.USER1, process.USER2, process.USER3, process.USER4];

// this is leetcode's api. we need a graphql request query to hit their data
// The only part about the query that changes is the username we want data of
const firstHalfOfURL = "https://leetcode.com/graphql?query={matchedUser(username:\"";
const secondHalfOfURL = "\"){username,submitStats:submitStatsGlobal{acSubmissionNum{difficulty,count}}}}";
const difficulty = ["Easy", "Medium", "Hard"];

// link to leetcode's public user profile. Add the username at the end of this string
const profileURL = 'https://leetcode.com/';

const monthNames = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const fileName = './User/user.json';

// prints today's date in full including everything
const date = new Date();
const month = date.getMonth();
const day = date.getDate();
const year = date.getFullYear();

// fetches user profile data from leetcode
// returns an array storing submission stats in this form:
// acSubmissionNum[username, easyCount, medCount, hardCount]
async function getUserData(username) {
    const response = await fetch(firstHalfOfURL + username + secondHalfOfURL);
    const data = await response.json();
    return data.data.matchedUser.submitStats.acSubmissionNum;
}

// Read from my own JSON file and return the entire line storing user profile data
function getStoredUserData(username) {
    let users = JSON.parse(fs.readFileSync(fileName).toString());
    for (const user of users) {
        if (user.name == username) {
            return user;
        }
    }
}

// Run this function when starting server. Then end the server and start again with this function commented
// This is because we want the most up to date problems solved of the users since the last execution of code.
async function setUserProfile() {
    fs.writeFileSync(fileName, '');
    let data = [];
    for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        const result = await getUserData(username);

        const user = {
            name: username,
            easy: result[1].count,
            medium: result[2].count,
            hard: result[3].count
        };
        data.push(user);
    }
    fs.appendFileSync(fileName, JSON.stringify(data, null, 2));
}
// Uncomment the next line to rewrite the "database"
// setUserProfile();

// Compare to see if there has been any changes to easy/med/hard problems solved
// Output any difference (zero included) to discord
async function getUserProfile() {
    let embeds = [];
    for (const username of usernames) {
        const newData = await getUserData(username);
        const oldData = getStoredUserData(username);
        let easy = 0;
        let medium = 0;
        let hard = 0;

        if (oldData == null) {
            console.log(`Unable to find ${username} in database`);
        } else {
            easy = newData[1].count - oldData.easy;
            medium = newData[2].count - oldData.medium;
            hard = newData[3].count - oldData.hard;
            if (easy != 0 || medium != 0 || hard != 0) {
                const entireData = JSON.parse(fs.readFileSync(fileName).toString());
                oldData.easy = newData[1].count;
                oldData.medium = newData[2].count;
                oldData.hard = newData[3].count;
                let index = 0;
                for (let user of entireData) {
                    if (user.name == username) {
                        entireData[index] = oldData;
                        break;
                    }
                    index++;
                }
                fs.writeFileSync(fileName, JSON.stringify(entireData, null, 2));
            }
        }

        const embed = new MessageEmbed();
        embed.setColor(embedColor);
        embed.setAuthor(username, null, profileURL + username);
        embed.addFields(
            {
                "name": difficulty[0],
                "value": easy.toString(),
                "inline": true
            },
            {
                "name": difficulty[1],
                "value": medium.toString(),
                "inline": true
            },
            {
                "name": difficulty[2],
                "value": hard.toString(),
                "inline": true
            }
        );
        embeds.push(embed);
    }
    sendData(embeds);
}

// output to the discord channel
function sendData(embed) {
    webhook.send({
        username: 'Leetcode',
        content: `Daily Leetcode Update for ${monthNames[month]} ${day}, ${year}`,
        embeds: [embed[0], embed[1], embed[2], embed[3]]
    });
};

// testing purposes
// getUserProfile();

// create a schedule and define the time of code execution
// switched to Windows Task Scheduler
const rule = new schedule.RecurrenceRule();
rule.tz = 'PST';
rule.hour = 0;
rule.minute = 0;

const job = schedule.scheduleJob(rule, function() {
    getUserProfile();
})

// prints the string on localhost webpage if successful connection
app.get('/', (req, res) => {
    res.send('port connection success');
});

app.listen(4000, (req, res) => {
    console.log('Running on localhost:4000');
});