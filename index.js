const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const { getConvertedItem, getFormattedTimeFromEventDate } = require('./utils');
require('dotenv').config();
const CronJob = require('cron').CronJob;
require('keep-alive-replit').listen(80);

const token = process.env.TELEGRAM_TOKEN;
const myChatId = process.env.MY_CHAT_ID;

const job = new CronJob(
    // '*/2 * * * *', // every two minues
    '0 * * * *', // every hour
    //'0 9,21 * * *', // twice a day at 9 and at 21
    () => {
        updateProcess();
        bot.sendMessage(myChatId, `chron ran at ${new Date().toLocaleString('ru', {timeZone: 'Europe/Vilnius', hour12: false})}`);
    },
    null,
    true, // job.start() not needed if true
    'Europe/Vilnius'
);

const bot = new TelegramApi(token, { polling: true });

const Client = require("@replit/database");
const client = new Client();

const SHORT_MODIFIER = 'short';
const SHORT_POLL_MODIFIER = 'shortpoll';

const mediaModifiers = [SHORT_MODIFIER, SHORT_POLL_MODIFIER];

const updateEventsAndCheck = async () => {
    const eventsData = await axios
        .get('https://www.vilnius-events.lt/en/api/')
        .then(res => res.data)
        .catch(async error => {
            console.error(error);
            await bot.sendMessage(chatId, 'Something went wrong');
        })

    const prevEventsData = await client.get('events') || {};

    const dbData = eventsData.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {});

    // bad expensive check
    let newEventsSummary = {
        count: 0,
        events: [],
    };

    for (key in dbData) {
        if (!prevEventsData[key]) {
            newEventsSummary.count++;
            newEventsSummary.events = [...newEventsSummary.events, dbData[key]]
        }
    }

    await client.set('events', dbData);

    return newEventsSummary;
};

const storeChatId = async (msg) => {
    const chatId = msg.chat.id;
    const chatInfo = msg.chat;
    const chatIdDictionary = await client.get('chatIdDictionary') || {};
    const newChatIdDictionary = { ...chatIdDictionary, [chatId]: chatInfo };
    // console.log('newChatIdDictionary', newChatIdDictionary);
    // console.log('dbDump', await client.getAll());
    await client.set('chatIdDictionary', newChatIdDictionary);
};

const updateProcess = async () => {
    const newEventsData = await updateEventsAndCheck();
    console.log(newEventsData);
    if (newEventsData.count > 0) {
        await handleNextEventsRequest(myChatId, newEventsData.count, SHORT_MODIFIER, newEventsData.events);
    }
}

// const startUpdates = async () => {
//   await updateProcess();
//   const intervalId = setInterval(async () => {
//     await ();
//   }, 10800000); // 10800000 = 3 hours
//   console.log('intervalId', intervalId);
// };

const handleNextEventsRequest = async (chatId, amount, modifier, events) => {
    bot.sendChatAction(chatId, 'typing');

    const finalAmount = amount > 10 ? 10 : amount;

    const fromDbData = events || await client.get('events') || {};
    const eventsData = Object.values(fromDbData);

    const currentTime = new Date().getTime();

    const nextEvents = eventsData
        .filter(item => {
            return getFormattedTimeFromEventDate(item.date) > currentTime;
        })
        .sort((prevItem, nextItem) => getFormattedTimeFromEventDate(prevItem.date) - getFormattedTimeFromEventDate(nextItem.date))
        .slice(0, finalAmount); // amount === undefined => slice all array

    if (events) {
        bot.sendMessage(myChatId, 'New events');
    }

    if (mediaModifiers.includes(modifier)) {
        const mediaPhotoArray = nextEvents.map((event, index) => ({
            type: 'photo',
            media: event.image_src,
            caption: getConvertedItem(event, index),
        }));
        await bot.sendMediaGroup(chatId, mediaPhotoArray);

        if (modifier === SHORT_POLL_MODIFIER) {
            const pollOptions = nextEvents.map((event, index) => `${index}. ${event.title}`);
            const form = {
                is_anonymous: true,
                allows_multiple_answers: true,
                disable_notification: true,
                protect_content: true,
            }
            bot.sendPoll(chatId, 'So which one will it be?', pollOptions, form);
        }
        return;
    }

    nextEvents.forEach(async (event, index) => {
        await bot.sendPhoto(chatId, event.image_src, {
            caption: getConvertedItem(event, index)
        })
    });
}

const handleUnknownCommand = async (chatId) => {
    bot.sendMessage(chatId, `I'm sorry, I don't understand you. Try use /help or /? to see what I can do`);
}

const handleHelp = async (chatId) => {
    bot.sendMessage(chatId,
        `Hello, this is a chat bot that might help you figure out what happens in Vilnius:` +
        '\n\n' + 'Available commands:' +
        '\n\n' + '/next - Show closest event in Vilnius' +
        '\n' + '/next [x] - Show maximum [x] closest events in Vilnius' +
        '\n' + '/short - Show 10 closest events as an Album' +
        '\n' + '/shortpoll - Show 10 closest events as an Album and a poll after it (democracy mode)' +
        '\n' + '/all - Show all upcoming events in Vilnius. Use carefully, it will spam a bunch of messages' +
        '\n' + '/help (/?) - This command will show this exact message. It might help you whenever you feel lost.' +
        '\n\n' + 'Plans for future:' +
        '\n' + '    ➡️ Add periodic updates with new events' +
        '\n' + '    ➡️ Add digest feature' +
        '\n\n' + 'Author: @oneplusuniverse' +
        '\n' + 'Version: 0.1.0' +
        '\n' + 'Created: 03.06.2022'
    );
}

const handleNextWithOptions = (chatId, text) => {
    const [command, amount = 1, modifier] = text.split(' ');
    handleNextEventsRequest(chatId, amount, modifier);
};

bot.onText(/\/subscribe?/, async (msg) => {
    logMsg(msg);
    const chatId = msg.chat.id;
    const text = msg.text;
    storeChatId(msg);
});

bot.onText(/\/tst( +\d)?/, async (msg) => {
    logMsg(msg);
    const chatId = msg.chat.id;
    const text = msg.text;
    if (chatId != myChatId) return;
    console.log(process.env.REPLIT_DB_URL);

    const chatIdDictionary = await client.get('chatIdDictionary');
    bot.sendMessage(chatId, JSON.stringify(chatIdDictionary, null, 2));
});

bot.onText(/\/next( +\d)?/, (msg) => {
    logMsg(msg);
    const text = msg.text;
    const chatId = msg.chat.id;
    handleNextWithOptions(chatId, text);
});

bot.onText(/\/short$/, (msg) => {
    logMsg(msg);
    const text = `/next 10 ${SHORT_MODIFIER}`;
    const chatId = msg.chat.id;
    handleNextWithOptions(chatId, text);
});

bot.onText(/\/shortpoll$/, (msg) => {
    logMsg(msg);
    const text = `/next 10 ${SHORT_POLL_MODIFIER}`;
    const chatId = msg.chat.id;
    handleNextWithOptions(chatId, text);
});

bot.onText(/\/update/, async (msg) => { // temp manual update
    logMsg(msg);
    const chatId = msg.chat.id;
    bot.sendChatAction(chatId, 'typing');
    const newEventsData = await updateEventsAndCheck();
    bot.sendMessage(chatId, `Db is updated
events added: ${newEventsData.count}
events: 
${newEventsData.events.map(event => event.link).join('\n')}`);
});

bot.onText(/\/cleardb/, async (msg) => { // temp manual update
    logMsg(msg);
    const chatId = msg.chat.id;
    console.log('chatId', chatId);
    bot.sendChatAction(chatId, 'typing');
    await client.delete('events');
    bot.sendMessage(chatId, `Db is cleared`);
});

bot.onText(/\/dropdb/, async (msg) => { // temp manual update
    logMsg(msg);
    const chatId = msg.chat.id;
    if (chatId === myChatId) {
        bot.sendChatAction(chatId, 'typing');
        await client.empty();
        bot.sendMessage(chatId, `Db is emptied`);
    } else {
        handleUnknownCommand(chatId);
    }
});

bot.onText(/\/runupd/, async (msg) => { // temp manual update
    const chatId = msg.chat.id;
    console.log('*** /runupd ***')
    if (chatId == myChatId) {
        await updateProcess();
    } else {
        handleUnknownCommand(chatId);
    }
});

bot.onText(/^(?!\/next|\/short|\/shortpoll|\/update|\/runupd|\/cleardb|\/dropdb|\/tst|\/subscribe.*$)\/.+/, async (msg) => { // /\/(.+)/ => anything
                                                                                                                             // console.log(msg);
    const text = msg.text;
    const chatId = msg.chat.id;
    switch (text) {
        case '/all':
            logMsg(msg);
            handleNextEventsRequest(chatId);
            break;
        case '/start':
            logMsg(msg);
            storeChatId(msg);
            handleHelp(chatId);
            break;
        case '/?':
        case '/help':
            logMsg(msg);
            handleHelp(chatId);
            break;
        default:
            logMsg(msg);
            handleUnknownCommand(chatId);
            break;
    }
});

const logMsg = (msg) => {
    const chatId = msg.chat.id;
    console.group(`┌──[ chat id: ${chatId} ]────────`);
    console.log(msg);
    console.log(`└──────────────────────────────`);
    console.groupEnd();
};

// const commands = [
//     { command: '/next', description: 'Show next upcoming event in Vilnius'},
//     { command: '/short', description: 'Show 10 closest events as an Album'},
//     { command: '/shortpoll', description: 'Show 10 closest events as an Album and a poll after it (democracy mode)'},
//     { command: '/all', description: 'Show all upcoming event in Vilnius. Use carefully, it may spam a lot.'},
//     { command: '/help', description: 'Help (also works as /?)'}
// ]
//
// bot.setMyCommands(commands);
