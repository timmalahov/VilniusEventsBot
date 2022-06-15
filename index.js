const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const { getConvertedItem, getConvertedIVItem, getFormattedTimeFromEventDate, getHelpMessage, logMsg } = require('./utils');
require('dotenv').config();
const CronJob = require('cron').CronJob;
require('keep-alive-replit').listen(80);

const token = process.env.TELEGRAM_TOKEN;
const myChatId = process.env.MY_CHAT_ID;
const Client = require("@replit/database");
const dbClient = new Client();
const bot = new TelegramApi(token, { polling: true });

const animations = {
  thinking: 'CAACAgIAAxkBAAEUz_lioJWLrgR6QgMI4s-tj85fSsxeMwACXwAD29t-AAGEsFSbEa7K4yQE',
  happy: 'CAACAgIAAxkBAAEU0_9ioSotv_JRi0X6IN9zzyry2WuE7AACZgAD29t-AAGTzMPQDS2PbCQE'
};

new CronJob(
  // '*/2 * * * *', // every two minues
  // '0 */3 * * *', // every 3 hours
  // '0 9-20/3 * * *', // every 3 hours 9-21
  '0 9-20 * * *', // every hour from 9 to 20
  // '0 * * * *', // every hour
  //'0 9,21 * * *', // twice a day at 9 and at 21
  async () => {
    const newEvents = await updateProcess();

    if (newEvents.count) {
      await bot.sendPhoto(myChatId, 'https://i.picsum.photos/id/717/1000/1000.jpg?hmac=qm5FkuwjhKdgBdYuANb10aU9PivVojfQfmYsY41j6As', {
        caption: `
Chron at ${new Date().toLocaleString('ru', { timeZone: 'Europe/Vilnius', hour12: false })}

New events found: ${newEvents.count}
${newEvents.events.map(event => event.link).join('\n')}
Keep on waiting`,
      });

      // await bot.sendAnimation(myChatId, animations.happy);

      //       await bot.sendMessage(myChatId, `
      // Chron at ${new Date().toLocaleString('ru', { timeZone: 'Europe/Vilnius', hour12: false })}

      // New events found: ${newEvents.count}
      // ${newEvents.events.map(event => event.link).join('\n')}
      // Keep on waiting`);
      //       return;
    }

    await bot.sendAnimation(myChatId, animations.thinking);
  },
  null,
  true, // job.start() not needed if true
  'Europe/Vilnius'
);

const SHORT_MODIFIER = 'short';
const SHORT_POLL_MODIFIER = 'shortpoll';
const mediaModifiers = [SHORT_MODIFIER, SHORT_POLL_MODIFIER];
const CHAT_ID_DICTIONARY_KEY = 'chatIdDictionary';

/**
 * Checks for new events
 * @returns {Promise<{count: number, events: *[]}>} - object containing new events and cmount of those in count.
 */
const updateEvents = async () => {
  const eventsData = await axios
    .get('https://www.vilnius-events.lt/en/api/')
    .then(res => res.data)
    .catch(async error => {
      console.error(error);
      await bot.sendMessage(chatId, 'Something went wrong');
    })

  const prevEventsData = await dbClient.get('events') || {};

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
      newEventsSummary.events = newEventsSummary.events.concat(dbData[key]);
    }
  }

  await dbClient.set('events', dbData);

  return newEventsSummary;
};

const storeChatId = async (msg) => {
  const chatId = msg.chat.id;
  const chatInfo = msg.chat;
  const chatIdDictionary = await dbClient.get(CHAT_ID_DICTIONARY_KEY) || {};
  const newChatIdDictionary = { ...chatIdDictionary, [chatId]: chatInfo };
  await dbClient.set(CHAT_ID_DICTIONARY_KEY, newChatIdDictionary);
};

const updateProcess = async () => {
  const newEventsData = await updateEvents();
  if (newEventsData.count > 0) {
    const subscribersChatIdList = await dbClient.get(CHAT_ID_DICTIONARY_KEY);

    console.log('subscribersChatIdList', subscribersChatIdList);

    for (chatId in subscribersChatIdList) {
      try {
        await bot.sendMessage(chatId, 'New upcoming events:');
        await handleNextEventsRequest(chatId, newEventsData.count, SHORT_MODIFIER, newEventsData.events);
      } catch (e) {
        console.error('Mass ', e);
      }
    }
  }
  return newEventsData;
}

const handleNextEventsRequest = async (chatId, amount, modifier, events) => { // TODO жэстачайшэ зарефакторить!
  bot.sendChatAction(chatId, 'typing');

  const finalAmount = amount > 10 ? 10 : amount;

  const fromDbData = events || await dbClient.get('events') || {};
  const eventsData = Object.values(fromDbData);

  const currentTime = new Date().getTime();

  const nextEvents = eventsData
    .filter(item => {
      return getFormattedTimeFromEventDate(item.date) > currentTime && !item.image_src.includes('webp');
    })
    .sort((prevItem, nextItem) => getFormattedTimeFromEventDate(prevItem.date) - getFormattedTimeFromEventDate(nextItem.date))
    .slice(0, finalAmount); // amount === undefined => slice all array

  if (mediaModifiers.includes(modifier)) {
    const mediaPhotoArray = nextEvents
      .filter(event => event.image_src)
      .map((event, index) => ({
      type: 'photo',
      media: event.image_src,
      caption: getConvertedItem(event, index),
      // parse_mode: 'HTML',
    }));
    console.log(mediaPhotoArray);
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
    await bot.sendMessage(chatId, `[${event.title.replace(/[^a-zA-Z ]/g, "")}](https://t.me/iv?url=${event.link}&rhash=3479c8d56341a6)`, {
      parse_mode: 'Markdown',
    })
  });

  // nextEvents.forEach(async (event, index) => {
  //   await bot.sendPhoto(chatId, event.image_src, {
  //     caption: getConvertedIVItem(event),
  //     parse_mode: 'Markdown',
  //   })
  // });
  
  // nextEvents.forEach(async (event, index) => {
  //   await bot.sendPhoto(chatId, event.image_src, {
  //     caption: getConvertedItem(event, index)
  //   })
  // });
}

const handleUnknownCommand = async (chatId) => {
  await bot.sendAnimation(chatId, 'CAACAgIAAxkBAAEUyydin8Xttz2BofODQ-iWkeDJuYAzbwACRxcAAkgBuEm6IanKb7R7vyQE');
  await bot.sendMessage(chatId, `I'm sorry, I don't understand you. Try use /help or /? to see what I can do`);
}

const handleHelp = async (chatId) => {
  await bot.sendMessage(chatId, getHelpMessage());
}

const handleNextWithOptions = async (chatId, text) => {
  const [command, amount = 1, modifier] = text.split(' ');
  await handleNextEventsRequest(chatId, amount, modifier);
};

bot.onText(/\/subscribe/, async (msg) => {
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

  const chatIdDictionary = await dbClient.get('chatIdDictionary');
  await bot.sendMessage(chatId, JSON.stringify(chatIdDictionary, null, 2));
});

bot.onText(/\/next( +\d)?/, async (msg) => {
  logMsg(msg);
  const text = msg.text;
  const chatId = msg.chat.id;
  await handleNextWithOptions(chatId, text);
});

bot.onText(/\/short$/, async (msg) => {
  logMsg(msg);
  const text = `/next 10 ${SHORT_MODIFIER}`;
  const chatId = msg.chat.id;
  await handleNextWithOptions(chatId, text);
});

bot.onText(/\/shortpoll$/, async (msg) => {
  logMsg(msg);
  const text = `/next 10 ${SHORT_POLL_MODIFIER}`;
  const chatId = msg.chat.id;
  await handleNextWithOptions(chatId, text);
});

bot.onText(/\/update/, async (msg) => { // temp manual update
  logMsg(msg);
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  const newEventsData = await updateEvents();
  await bot.sendMessage(chatId, `Db is updated
events added: ${newEventsData.count}
events: 
${newEventsData.events.map(event => event.link).join('\n')}`);
});

bot.onText(/\/cleardb/, async (msg) => { // temp manual events removal
  logMsg(msg);
  const chatId = msg.chat.id;
  bot.sendChatAction(chatId, 'typing');
  await dbClient.delete('events');
  bot.sendMessage(chatId, `Db events are cleared`);
});

bot.onText(/\/dropdb/, async (msg) => { // temp manual db cleanup
  logMsg(msg);
  const chatId = msg.chat.id;
  if (chatId != myChatId) {
    handleUnknownCommand(chatId);
    return;
  }
  bot.sendChatAction(chatId, 'typing');
  await dbClient.empty();
  bot.sendMessage(chatId, `Db is emptied`);
});

bot.onText(/\/runupd/, async (msg) => { // temp manual updateProcess start
  const chatId = msg.chat.id;
  if (chatId != myChatId) {
    await handleUnknownCommand(chatId);
    return;
  }
  await updateProcess();
});

bot.onText(/\/all/, async (msg) => { // get all. deprecated
  const chatId = msg.chat.id;
  logMsg(msg);
  await handleNextEventsRequest(chatId);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  logMsg(msg);
  await bot.sendAnimation(chatId, 'CAACAgIAAxkBAAEU0AxioJeEj1RkGVa77FYaOS0BLab_JAACbwAD29t-AAGZW1Coe5OAdCQE');
  await storeChatId(msg);
  await handleHelp(chatId);
});

bot.onText(/\/\?|\/help/, async (msg) => {
  const chatId = msg.chat.id;
  logMsg(msg);
  await handleHelp(chatId);
});

bot.onText(/\/pic/, async (msg) => {
  const chatId = msg.chat.id;
  logMsg(msg);
  if (chatId != myChatId) {
    await handleUnknownCommand(chatId);
    return;
  }

  await bot.sendPhoto(chatId, 'https://i.picsum.photos/id/717/1000/1000.jpg?hmac=qm5FkuwjhKdgBdYuANb10aU9PivVojfQfmYsY41j6As', {
    caption: `
    *bold text*
    https://replit.com/@oneplusuniverse/VilniusEventsBot#index.js:108:22
    [replit](https://replit.com/@oneplusuniverse/VilniusEventsBot#index.js:108:22)`,
    parse_mode: 'Markdown',
  });
});

// bot.onText(/\/(.+)/, async (msg) => { // /\/(.+)/ => anything
//     const chatId = msg.chat.id;
//     logMsg(msg);
//     await handleUnknownCommand(chatId);
// });
