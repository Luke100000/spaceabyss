var io_handler = require('./io' + process.env.FILE_SUFFIX + '.js');
var io = io_handler.io;
var database = require('./database' + process.env.FILE_SUFFIX + '.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;

const game_object = require('./game_object' + process.env.FILE_SUFFIX + '.js');


async function sendShips(io, socket, dirty, player_index) {

    try {

        // lets create an array of the object type ids that are ships
        let object_type_ids = [];
        for(let i = 0; i < dirty.object_types.length; i++) {
            if(dirty.object_types[i] && dirty.object_types[i].is_ship) {
                object_type_ids.push(dirty.object_types[i].id);
            }
        }

        for(let s = 0; s < dirty.objects.length; s++) {
            if(dirty.objects[s] && dirty.objects[s].player_id === dirty.players[player_index].id &&
                object_type_ids.includes(dirty.objects[s].object_type_id)) {

                await game_object.sendInfo(socket, false, dirty, s);
            }
        }

    } catch(error) {
        log(chalk.red("Error in sendPlayerShips: " + error));
        console.error(error);
    }


}

exports.sendShips = sendShips;


module.exports = {
    sendShips
}