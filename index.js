const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const {
  getConvertedItem,
  getFormattedTimeFromEventDate,
  getHelpMessage,
  logMsg,
  logCronMessage,
  getIVLink,
  getConvertedIVItem
} = require('./utils');
const { animations, cronTasks } = require('./constants');
require('dotenv').config();
const CronJob = require('cron').CronJob;
require('keep-alive-replit').listen(80);

const token = process.env.TELEGRAM_TOKEN;
const myChannelId = process.env.CHANNEL_ID;
const myChatId = process.env.MY_CHAT_ID;
const Client = require("@replit/database");
const dbClient = new Client();
const bot = new TelegramApi(token, { polling: true });

new CronJob(
  cronTasks.everyHourFromNineToTwenty,
  async () => {
    const newEvents = await updateAndNotify();
    if (newEvents.count) {
      await logCronMessage(myChatId, bot, animations.happy, newEvents);
      return;
    }
    await bot.sendAnimation(myChatId, animations.thinking);
  },
  null,
  true, // job.start() not needed if true
  'Europe/Vilnius'
);

const SHORT_MODIFIER = 'short';
const SHORT_POLL_MODIFIER = 'shortpoll';
const IV_BASE_MODIFIER = 'ivBaseModifier';
const mediaModifiers = [SHORT_MODIFIER, SHORT_POLL_MODIFIER];
const ivModifiers = [IV_BASE_MODIFIER];
const CHAT_ID_DICTIONARY_KEY = 'chatIdDictionary';

/**
 * Checks for new events
 * @returns {Promise<{count: number, events: *[]}>} - object containing new events and cmount of those in count.
 */
const fetchNewEvents = async () => {
  const eventsData = await axios
    .get('https://www.vilnius-events.lt/en/api/')
    .then(res => res.data)
    .catch(async error => {
      console.error(error);
      await bot.sendMessage(myChatId, 'Something went wrong fetching events data from API');
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
    dbData: null
  };

  for (let key in dbData) {
    if (!prevEventsData[key]) {
      newEventsSummary.count++;
      newEventsSummary.events = newEventsSummary.events.concat(dbData[key]);
    }
  }

  newEventsSummary.dbData = dbData;
  return newEventsSummary;
};

const storeChatId = async (msg) => {
  const chatId = msg.chat.id;
  const chatInfo = msg.chat;
  const chatIdDictionary = await dbClient.get(CHAT_ID_DICTIONARY_KEY) || {};
  const newChatIdDictionary = { ...chatIdDictionary, [chatId]: chatInfo };
  await dbClient.set(CHAT_ID_DICTIONARY_KEY, newChatIdDictionary);

  await bot.sendAnimation(myChatId, animations.newSubscriber);
  await bot.sendMessage(myChatId, `New subscriber - ${ chatInfo.title || chatInfo.username }`);
};

const updateAndNotify = async (notify = true) => {
  const newEventsData = await fetchNewEvents();

  if (newEventsData.count === 0) return newEventsData;

  await dbClient.set('events', newEventsData.dbData); // save to db

  if (notify) {
    const subscribersChatIdList = await dbClient.get(CHAT_ID_DICTIONARY_KEY);

    for (let chatId in subscribersChatIdList) {
      try {
        // await bot.sendMessage(chatId, 'New upcoming events:');
        // await sendEvents(chatId, newEventsData.count, SHORT_MODIFIER, newEventsData.events);
        await sendEvents(chatId, newEventsData.count, IV_BASE_MODIFIER, newEventsData.events);
      } catch (e) {
        console.error('Batch messages error [updateAndNotify]', e);
      }
    }
  }
  return newEventsData;
}

const sendEvents = async (chatId, amount, modifier, events) => { // TODO жэстачайшэ зарефакторить!
  await bot.sendChatAction(chatId, 'typing');

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
        caption: getConvertedItem(event, index)
      }));
    console.log('mediaPhotoArray', mediaPhotoArray);
    await bot.sendMediaGroup(chatId, mediaPhotoArray);

    if (modifier === SHORT_POLL_MODIFIER) {
      const pollOptions = nextEvents.map((event, index) => `${ index }. ${ event.title }`);
      const form = {
        is_anonymous: true,
        allows_multiple_answers: true,
        disable_notification: true,
        protect_content: true
      }
      await bot.sendPoll(chatId, 'So which one will it be?', pollOptions, form);
    }
    return;
  }

  if (ivModifiers.includes(modifier)) {
    for (let i = 0; i < nextEvents.length; i++) {
      await bot.sendMessage(chatId, getConvertedIVItem(nextEvents[i]), {
        parse_mode: 'Markdown'
      });
    }

    return;
  }

  for (let i = 0; i < nextEvents.length; i++) {
    await bot.sendMessage(chatId, getConvertedIVItem(nextEvents[i]), {
      parse_mode: 'Markdown'
    });
  }
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
  await sendEvents(chatId, amount, modifier);
};

bot.onText(/\/subscribe/, async (msg) => {
  logMsg(msg);
  await storeChatId(msg);
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
  const text = `/next 10 ${ SHORT_MODIFIER }`;
  const chatId = msg.chat.id;
  await handleNextWithOptions(chatId, text);
});

bot.onText(/\/shortpoll$/, async (msg) => {
  logMsg(msg);
  const text = `/next 10 ${ SHORT_POLL_MODIFIER }`;
  const chatId = msg.chat.id;
  await handleNextWithOptions(chatId, text);
});

bot.onText(/\/update/, async (msg) => { // temp manual update
  logMsg(msg);
  const chatId = msg.chat.id;
  if (chatId != myChatId) {
    await handleUnknownCommand(chatId);
    return;
  }

  await bot.sendChatAction(myChatId, 'typing');
  const newEventsData = await updateAndNotify(false);
  await bot.sendMessage(chatId, `Db is updated
   events added: ${ newEventsData.count }
   events:
   ${ newEventsData.events.map(event => event.link).join('\n') }`);
});

bot.onText(/\/cleardb/, async (msg) => { // temp manual events removal
  logMsg(msg);
  const chatId = msg.chat.id;
  await bot.sendChatAction(chatId, 'typing');
  await dbClient.delete('events');
  await bot.sendMessage(chatId, `Db events are cleared`);
});

bot.onText(/\/dropdb/, async (msg) => { // temp manual db cleanup
  logMsg(msg);
  const chatId = msg.chat.id;
  if (chatId != myChatId) {
    await handleUnknownCommand(chatId);
    return;
  }
  await bot.sendChatAction(chatId, 'typing');
  await dbClient.empty();
  await bot.sendMessage(chatId, `Db is emptied`);
});

bot.onText(/\/runupd/, async (msg) => { // temp manual updateProcess start
  const chatId = msg.chat.id;
  if (chatId != myChatId) {
    await handleUnknownCommand(chatId);
    return;
  }
  await updateAndNotify();
});

bot.onText(/\/all/, async (msg) => { // get all. deprecated
  const chatId = msg.chat.id;
  logMsg(msg);
  await sendEvents(chatId);
});

bot.onText(/\/iv/, async (msg) => { // get all. deprecated
  const chatId = msg.chat.id;
  logMsg(msg);
  await sendEvents(chatId, 5);
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  logMsg(msg);
  await bot.sendAnimation(chatId, animations.start);
  await storeChatId(msg);
  await handleHelp(chatId);
});

bot.onText(/\/\?|\/help/, async (msg) => {
  const chatId = msg.chat.id;
  logMsg(msg);
  await handleHelp(chatId);
});

bot.onText(/\/pic/, async (msg) => {
  logMsg(msg);
  const chatId = msg.chat.id;
  if (chatId != myChatId) {
    await handleUnknownCommand(chatId);
    return;
  }

  await bot.sendPhoto(chatId, 'https://i.picsum.photos/id/717/1000/1000.jpg?hmac=qm5FkuwjhKdgBdYuANb10aU9PivVojfQfmYsY41j6As', {
    caption: `
    *bold text*
    https://replit.com/@oneplusuniverse/VilniusEventsBot#index.js:108:22
    [replit](https://replit.com/@oneplusuniverse/VilniusEventsBot#index.js:108:22)`,
    parse_mode: 'Markdown'
  });
});

bot.onText(/\/updchan/, async (msg) => {
  logMsg(msg);
  const chatId = msg.chat.id;
  if (chatId != myChatId) {
    await handleUnknownCommand(chatId);
    return;
  }
  await sendEvents(myChannelId);
});

// bot.onText(/\/subchan/, async (msg) => {
//   logMsg(msg);
//   const chatId = msg.chat.id;
//   if (chatId != myChatId) {
//     await handleUnknownCommand(chatId);
//     return;
//   }

// //  const chatId = msg.chat.id;
//   //const chatInfo = msg.chat;
  
//   await storeChatId({chat: {id: myChannelId, first_name: 'VilniusEventsChannel'}});
// });