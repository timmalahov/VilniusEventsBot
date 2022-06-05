const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const { getConvertedItem, getFormattedTimeFromEventDate } = require('./utils');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN;

const bot = new TelegramApi(token, {polling: true});

const SHORT_MODIFIER = 'short';
const SHORT_POLL_MODIFIER = 'shortpoll';

const mediaModifiers = [SHORT_MODIFIER, SHORT_POLL_MODIFIER];

const handleNextEventsRequest = async (chatId, amount, modifier) => {
    bot.sendChatAction(chatId, 'typing');

    const finalAmount = amount > 10 ? 10 : amount;
    const eventsData = await axios
        .get('https://www.vilnius-events.lt/en/api/')
        .then(res => res.data)
        .catch(async error => {
            console.error(error);
            await bot.sendMessage(chatId, 'Something went wrong');
        })

    const currentTime = new Date().getTime();

    const nextEvents = eventsData
        .filter(item => {
            return getFormattedTimeFromEventDate(item.date) > currentTime;
        })
        .sort((prevItem, nextItem) => getFormattedTimeFromEventDate(prevItem.date) - getFormattedTimeFromEventDate(nextItem.date))
        .slice(0, finalAmount); // amount === undefined => slice all array

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

bot.onText(/\/next( +\d)?/, (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;
    handleNextWithOptions(chatId, text);
});

bot.onText(/\/short$/, (msg) => {
    const text = `/next 10 ${SHORT_MODIFIER}`;
    const chatId = msg.chat.id;
    handleNextWithOptions(chatId, text);
});

bot.onText(/\/shortpoll$/, (msg) => {
    const text = `/next 10 ${SHORT_POLL_MODIFIER}`;
    const chatId = msg.chat.id;
    handleNextWithOptions(chatId, text);
});

bot.onText(/^(?!\/next|\/short|\/shortpoll.*$)\/.+/, async (msg) => { // /\/(.+)/ => anything
    // console.log(msg);
    const text = msg.text;
    const chatId = msg.chat.id;
    switch (text) {
        case '/all':
            handleNextEventsRequest(chatId);
            break;
        case '/start':
        case '/?':
        case '/help':
            handleHelp(chatId);
            break;
        default:
            handleUnknownCommand(chatId);
            break;
    }
});

// const commands = [
//     { command: '/next', description: 'Show next upcoming event in Vilnius'},
//     { command: '/short', description: 'Show 10 closest events as an Album'},
//     { command: '/shortpoll', description: 'Show 10 closest events as an Album and a poll after it (democracy mode)'},
//     { command: '/all', description: 'Show all upcoming event in Vilnius. Use carefully, it may spam a lot.'},
//     { command: '/help', description: 'Help (also works as /?)'}
// ]
//
// bot.setMyCommands(commands);
