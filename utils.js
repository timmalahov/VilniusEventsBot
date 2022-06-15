module.exports = {
    getConvertedItem: (item, index) => {
        return `${item.title.replace(/[^a-zA-Z ]/g, "")}️`
            + '\n\n' + `📅 ${item.date}`
            + '\n' + `🗺️ ${item.location_name.substring(0,200)} ${item.location_address.substring(0,200)} 
(https://maps.google.com/?q=${encodeURIComponent(item.location_address ? item.location_address : item.location_name)})`
            + '\n\n' + `${item.content.substring(0,200) + '...'}`
            + '\n\n' + `${item.link}`;
    },
    getConvertedIVItem: (item, index) => {
        return `${item.title.replace(/[^a-zA-Z ]/g, "")}️`
            + '\n\n' + `📅 ${item.date}`
            + '\n' + `🗺️ ${item.location_name} ${item.location_address}`
            + '\n' + `[show on map](https://maps.google.com/?q=${encodeURIComponent(item.location_address ? item.location_address : item.location_name)})`
            + '\n\n' + `[.](https://t.me/iv?url=${item.link}&rhash=3479c8d56341a6)`
            + '' + `${item.content.substring(0,200) + '...'}`;
    },
    getFormattedTimeFromEventDate: (dateString) => {
        const eventTime = new Date(dateString).getTime();
        if (!isNaN(eventTime)) {
            return eventTime;
        }

        if (dateString.split(' - ').length > 1) {
            return new Date(dateString.split(' - ')[1]).getTime();
        }
    },
    getHelpMessage: () => (
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
    ),
    logMsg: (msg) => {
        const chatId = msg.chat.id;
        console.group(`┌──[ chat id: ${chatId} ]────────`);
        console.log(msg);
        console.log(`└──────────────────────────────`);
        console.groupEnd();
    }
};
