const { ivRHash } = require('./constants');

const getIVLink = (text, link) => `[${ text }](https://t.me/iv?url=${ link }&rhash=${ ivRHash })`

const getConvertedItem = (item, index) => {
  return `${ item.title.replace(/[^a-zA-Z ]/g, "") }️`
    + '\n\n' + `📅 ${ item.date }`
    + '\n' + `🗺️ ${ item.location_name.substring(0, 200) } ${ item.location_address.substring(0, 200) } 
(https://maps.google.com/?q=${ encodeURIComponent(item.location_address ? item.location_address : item.location_name) })`
    + '\n\n' + `${ item.content.replace(/<[^>]*>?/gm, '').substring(0, 200) + '...' }`
    + '\n\n' + `${ item.link }`;
};

const getConvertedIVItem = (item, index) => {
  return `${ getIVLink(item.title.replace(/[^a-zA-Z ]/g, ""), item.link) }️`
    + '\n\n' + `${ item.content.replace(/<[^>]*>?/gm, '').substring(0, 200) + '...' }`
    + '\n\n' + `${ item.date }`
    + '\n\n' + `${ item.location_name } ${ item.location_address }`
    + '\n\n' + `[See on map](https://maps.google.com/?q=${ encodeURIComponent(item.location_address ? item.location_address : item.location_name) })`;
};

const getFormattedTimeFromEventDate = (dateString) => {
  const eventTime = new Date(dateString).getTime();
  if (!isNaN(eventTime)) {
    return eventTime;
  }

  if (dateString.split(' - ').length > 1) {
    return new Date(dateString.split(' - ')[1]).getTime();
  }
};

const getHelpMessage = () => (
  `Hello, this is a chat bot that might help you figure out what happens in Vilnius:` +
  '\n\n' + 'Available commands:' +
  '\n\n' + '/next - Show closest event in Vilnius' +
  '\n' + '/next [x] - Show maximum [x] closest events in Vilnius' +
  '\n' + '/short - Show 10 closest events as an Album' +
  '\n' + '/shortpoll - Show 10 closest events as an Album and a poll after it (democracy mode)' +
  '\n' + '/all - Show all upcoming events in Vilnius. Use carefully, it will spam a bunch of messages' +
  '\n' + '/help (/?) - This command will show this exact message. It might help you whenever you feel lost.' +
  '\n' + 'Version: 0.1.0' +
  '\n' + 'Created: 03.06.2022'
);

const getChannelInviteMessage = () => (
  'Great news!' +
  '\n\n' + 'There\'s a new channel with all the events available: ' +
  '\n' + 'https://t.me/+UT5NK83l_ABiMDUy' +
  '\n\n' + 'So if got annoyed by the messages from the bot in your channel you can either remove the bot or use the command /unsubscribe to stop the updates.' +
  '\n\n' + 'You can still find all of those messages in the channel'
)

const logMsg = (msg) => {
  const chatId = msg.chat.id;
  console.group(`┌──[ chat id: ${ chatId } ]────────`);
  console.log(msg);
  console.log(`└──────────────────────────────`);
  console.groupEnd();
};

const logCronMessage = async (myChatId, bot, animationId, newEvents) => {
  await bot.sendAnimation(myChatId, animationId);
  await bot.sendMessage(myChatId,
    '\n\n' + `Chron at ${ new Date().toLocaleString('ru', { timeZone: 'Europe/Vilnius', hour12: false }) }` +
    '\n\n' + `New events found: ${ newEvents.count }` +
    '\n' + `${ newEvents.events.map(event => event.link).join('\n') }` +
    '\n\n' + 'Keep on waiting')
};

module.exports = {
  getConvertedItem,
  getConvertedIVItem,
  getIVLink,
  getFormattedTimeFromEventDate,
  getHelpMessage,
  logMsg,
  logCronMessage,
  getChannelInviteMessage
};
