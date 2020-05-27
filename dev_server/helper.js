var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;


function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}


function notFalse(the_value) {

    if(typeof the_value === "undefined" || the_value === 0 || the_value === "0" ||
        the_value === false || the_value === null || the_value === "null" || the_value === "") {
        return false;
    }

    return true;
}


function rarityRoll() {

    let rarity_roll = getRandomIntInclusive(1, 200);

    if(rarity_roll <= 130) {
        return 1;
    } else if(rarity_roll <= 184) {
        return 2;
    } else if(rarity_roll <= 196) {
        return 3;
    } else {
        return 4;
    }

}

module.exports = {

    getRandomIntInclusive,
    notFalse,
    rarityRoll

}
