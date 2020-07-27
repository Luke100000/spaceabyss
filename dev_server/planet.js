var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;

const game_object = require('./game_object.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const player = require('./player.js');
//const world = require('./world.js');



async function getCoordAndRoom(dirty, planet_index) {

    try {

        let room = false;
        let coord_index = -1;
        let scope = false;
        let coord = false;

        if (!dirty.planets[planet_index]) {
            log(chalk.yellow("Could not find the planet. Planet index: " + planet_index));
            return { 'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope };
        }


        coord_index = await main.getCoordIndex(
            { 'coord_id': dirty.planets[planet_index].coord_id });
        if (coord_index !== -1) {
            room = "galaxy";
            scope = "galaxy";
            coord = dirty.coords[coord_index];
        }

        return { 'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope };
    } catch (error) {
        log(chalk.red("Error in planet.getCoordAndRoom: " + error));
        console.error(error);
        return false;
    }

}

exports.getCoordAndRoom = getCoordAndRoom;


/**
 * 
 * @param {Object} dirty 
 * @param {Object} data 
 * @param {number} data.planet_id
 * @param {string=} data.source
 */

async function getIndex(dirty, data) {
    try {

        data.planet_id = parseInt(data.planet_id);


        let planet_index = dirty.planets.findIndex(function(obj) { return obj && obj.id === data.planet_id; });

        if(planet_index === -1) {

            let [rows, fields] = await (pool.query("SELECT * FROM planets WHERE id = ?",
                [data.planet_id]));

            if(rows[0]) {

                // make sure we didn't add it in the time it took us to do the mysql query
                planet_index = dirty.planets.findIndex(function(obj) { return obj && obj.id === data.planet_id; });
                if(planet_index === -1) {
                    planet_index = dirty.planets.push(rows[0]) - 1;
                }

            }

        }

        return planet_index;

    } catch(error) {

        if(!data.source) {
            data.source = false;
        }
        log(chalk.red("Error in planet.getIndex: " + error + " source: " + data.source));
        console.error(error);
    }
}

exports.getIndex = getIndex;


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

            data.planet_index = await getIndex(dirty, {'planet_id': planet_id, 'source': 'planet.sendInfo' });

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
            await player.sendInfo(socket, room, dirty, dirty.planets[data.planet_index].player_id);
        }

        // see if there is an AI on this planet
        if(dirty.planets[data.planet_index].ai_id) {
            //console.log("Calling sendObjectInfo from planet.sendInfo");
            let ai_index = await game_object.getIndex(dirty, dirty.planets[data.planet_index].ai_id);

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
    getCoordAndRoom,
    getIndex,
    sendInfo
}