module.exports = {
    getConvertedItem: (item, index) => {
        return `${index + 1} ➡️ ${item.title}️`
            + '\n\n' + `📅 ${item.date}`
            + '\n' + `🗺️ ${item.location_name} ${item.location_address} 
(https://maps.google.com/?q=${encodeURIComponent(item.location_address ? item.location_address : item.location_name)})`
            + '\n\n' + `${item.content.substring(0,200) + '...'}`
            + '\n\n' + `${item.link}`;
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
};
