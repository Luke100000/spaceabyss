var io_handler = require('./io' + process.env.FILE_SUFFIX + '.js');
var io = io_handler.io;
var database = require('./database' + process.env.FILE_SUFFIX + '.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;

const game_object = require('./game_object' + process.env.FILE_SUFFIX + '.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const world = require('./world' + process.env.FILE_SUFFIX + '.js');

// data:    planet_id   |   planet_index
async function sendInfo(socket, room, dirty, data) {

    try {

        if(data.planet_id) {
            let planet_id = parseInt(data.planet_id);

            if(!data.source) {
                data.source = false;
            }

            if(isNaN(planet_id)) {
                log(chalk.red("NaN planet_id sent into sendPlanetInfo. Source: " + data.source));
                console.trace("RRRRR");
                return false;
            }

            data.planet_index = await main.getPlanetIndex({ 'planet_id': planet_id, 'source': 'planet.sendInfo' });

        } else if(data.planet_index) {

        }


        if(typeof data.planet_index === 'undefined' || data.planet_index === -1) {
            log(chalk.red("Could not send planet info"));

            if(data.source) {
                log(chalk.yellow("Source: " + data.source));
            }
            return false;
        }


        if(socket !== false) {
            socket.emit('planet_info', { 'planet': dirty.planets[data.planet_index] });
        }

        if(room !== false) {
            io.to(room).emit('planet_info', { 'planet': dirty.planets[data.planet_index] });
        }


        // we need to send things related to the planet. If there's a player, AI, AI rules
        if(dirty.planets[data.planet_index].player_id) {
            await world.sendPlayerInfo(io, socket, room, dirty, dirty.planets[data.planet_index].player_id);
        }

        // see if there is an AI on this planet
        if(dirty.planets[data.planet_index].ai_id) {
            //console.log("Calling sendObjectInfo from planet.sendInfo");
            let ai_index = await main.getObjectIndex(dirty.planets[data.planet_index].ai_id);

            if(ai_index !== -1) {
                await game_object.sendInfo(socket, room, dirty, ai_index);
            }
            // AI is gone for some reason
            else {
                dirty.planets[data.planet_index].ai_id = false;
                dirty.planets[data.planet_index].has_change = true;
            }

        }

    } catch(error) {
        log(chalk.red("Error in planet.sendInfo: " + error));
        console.error(error);
    }



}

exports.sendInfo = sendInfo;


module.exports = {
    sendInfo
}