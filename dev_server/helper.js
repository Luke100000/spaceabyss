var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;


function cleanStringInput(name) {

    try {
        return name.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"").trim();
    } catch(error) {
        log(chalk.red("Error in cleanStringInput: " + error));
    }


}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

function isFalse(the_value) {

    if(typeof the_value === "undefined" || the_value === 0 || the_value === "0" ||
        the_value === false || the_value === null || the_value === "null" || 
        (the_value.constructor === Object && Object.keys(the_value).length === 0) ) {
        return true;
    }

    return false;
}



function notFalse(the_value) {

    if(typeof the_value === "undefined" || the_value === 0 || the_value === "0" ||
        the_value === false || the_value === null || the_value === "null" || the_value === "" || 
        (the_value.constructor === Object && Object.keys(the_value).length === 0)) {
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

    cleanStringInput,
    getRandomIntInclusive,
    isFalse,
    notFalse,
    rarityRoll

}
