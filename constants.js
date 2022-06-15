module.exports = {
  animations: {
    thinking: 'CAACAgIAAxkBAAEUz_lioJWLrgR6QgMI4s-tj85fSsxeMwACXwAD29t-AAGEsFSbEa7K4yQE',
    happy: 'CAACAgIAAxkBAAEU0_9ioSotv_JRi0X6IN9zzyry2WuE7AACZgAD29t-AAGTzMPQDS2PbCQE',
    newSubscriber: 'CAACAgIAAxkBAAEU3JNiomVG-THTfLuxSYqlSPKwGqa24QACZgAD29t-AAGTzMPQDS2PbCQE',
    start: 'CAACAgIAAxkBAAEU0AxioJeEj1RkGVa77FYaOS0BLab_JAACbwAD29t-AAGZW1Coe5OAdCQE'
  },
  cronTasks: {
    everyTwoMin: '*/2 * * * *', // every two minues
    everyThreeHours: '0 */3 * * *', // every 3 hours
    everyThreeHoursFromNineToTwenty: '0 9-20/3 * * *', // every 3 hours 9-21
    everyHourFromNineToTwenty: '0 9-20 * * *', // every hour from 9 to 20
    everyHour: '0 * * * *', // every hour
    twiceADayAtNine: '0 9,21 * * *' // twice a day at 9 and at 21
  }
}
