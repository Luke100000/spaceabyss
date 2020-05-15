var io_handler = require('./io' + process.env.FILE_SUFFIX + '.js');
var io = io_handler.io;
var database = require('./database' + process.env.FILE_SUFFIX + '.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;

const world = require('./world' + process.env.FILE_SUFFIX + '.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const planet = require('./planet' + process.env.FILE_SUFFIX + '.js');



    async function updateMap(io, socket, dirty) {
        try {

            if(!socket.logged_in) {
                return false;
            }

            let player_index = await main.getPlayerIndex({'player_id': socket.player_id });


            if(dirty.players[player_index].planet_coord_id) {
                //console.log("socket player planet_id: " + socket.player_player_id);
                await updateMapPlanet(io, socket, dirty);
            } else if(dirty.players[player_index].ship_coord_id) {
                await updateMapShip(socket, dirty);
            } else if(dirty.players[player_index].coord_id) {
                await updateMapGalaxy(io, socket, dirty);
            } else {
                console.log("Not sure where the player is. Not sure what map to send");
            }

        } catch(error){
            console.error("map.updateMap failed: " + error);
            console.error(error);
        }
    }

    exports.updateMap = updateMap;

    // TODO switch to a similar style to updateMapShip. I think we can store the galaxy size globally, so we never have to lookup
    // TODO coords that aren't in the galaxy space.
    async function updateMapGalaxy(io, socket, dirty) {
        try {
            //console.log("In updateMapGalaxy");

            //console.log("In updateMapPlanet");
            let player_index = await main.getPlayerIndex({ 'player_id': socket.player_id });

            if(player_index === -1) {
                log(chalk.yellow("Unable to find socket player in map.updateMapPlanet"));
                return;
            }

            let coord_index = await main.getCoordIndex({ 'coord_id': dirty.players[player_index].coord_id });

            if(coord_index === -1) {
                log(chalk.yellow("Could not find player's galaxy coord to update the map"));
                return false;
            }

            let starting_x = dirty.coords[coord_index].tile_x - Math.floor(global.show_cols / 2);
            let starting_y = dirty.coords[coord_index].tile_y - Math.floor(global.show_rows / 2);
            let ending_x = starting_x + global.show_cols + 1;
            let ending_y = starting_y + global.show_rows + 1;

            if(starting_x < 0) { starting_x = 0; }

            if(starting_y < 0) { starting_y = 0; }



            for(let i = starting_x; i < ending_x; i++) {
                for (let j = starting_y; j < ending_y; j++) {

                    let other_coord_index = await main.getCoordIndex({ 'tile_x': i, 'tile_y': j});

                    if(other_coord_index !== -1) {


                        socket.emit('coord_info', { 'coord': dirty.coords[other_coord_index] });

                        if(dirty.coords[other_coord_index].planet_id && dirty.coords[other_coord_index].planet_id !== 0) {
                            //console.log("Coord has a planet id: " + dirty.coords[other_coord_index].planet_id);
                            await planet.sendInfo(socket, false, dirty,
                                { 'planet_id': dirty.coords[other_coord_index].planet_id, 'source': 'map.updateMapGalaxy' });
                        }

                    }
                }
            }

        } catch(error) {
            log(chalk.red("Error in map.updateMapGalaxy: " + error));
            console.error(error);
        }


    }

    // TODO we need a solution for planet levels > 0. I THINK the only real way to go about it is to just load
    // TODO planet coords with level > 0 into memory on server load, so we know we don't have to query the DB
    async function updateMapPlanet(io, socket, dirty) {
        try {
            //console.log("In updateMapPlanet");
            let player_index = await main.getPlayerIndex({ 'player_id': socket.player_id });

            if(player_index === -1) {
                log(chalk.yellow("Unable to find socket player in map.updateMapPlanet"));
                return;
            }

            let coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.players[player_index].planet_coord_id });

            if(coord_index === -1) {
                log(chalk.yellow("Could not find player's planet coord to update the map"));
                return false;
            }


            let planet_index = await main.getPlanetIndex({ 'planet_id': dirty.planet_coords[coord_index].planet_id });

            let starting_x = dirty.planet_coords[coord_index].tile_x - Math.floor(global.show_cols / 2);
            let starting_y = dirty.planet_coords[coord_index].tile_y - Math.floor(global.show_rows / 2);
            let ending_x = starting_x + global.show_cols + 1;
            let ending_y = starting_y + global.show_rows + 1;

            // No point in querying planet coords less than 0 since they don't exist
            // TODO get the planet size, and make sure ending_x and ending_y are <= the max coords for the planet
            if(starting_x < 0) { starting_x = 0; }
            if(starting_y < 0) { starting_y = 0; }

            if(ending_x > dirty.planets[planet_index].x_size) {
                ending_x = dirty.planets[planet_index].x_size;
            }

            if(ending_y > dirty.planets[planet_index].y_size) {
                ending_y = dirty.planets[planet_index].y_size;
            }


            let found_coords = [];

            // Initial testing is that this is like 10x faster than grabbing each coord we need
            for(let i = 0; i < dirty.planet_coords.length; i++) {
                if(dirty.planet_coords[i] && dirty.planet_coords[i].planet_id === dirty.planet_coords[coord_index].planet_id &&
                    dirty.planet_coords[i].level === dirty.planet_coords[coord_index].level &&
                    dirty.planet_coords[i].tile_x <= ending_x && dirty.planet_coords[i].tile_x >= starting_x &&
                    dirty.planet_coords[i].tile_y <= ending_y && dirty.planet_coords[i].tile_y >= starting_y) {

                    found_coords.push({ 'tile_x': dirty.planet_coords[i].tile_x, 'tile_y': dirty.planet_coords[i].tile_y, 'planet_coord_index': i });

                }
            }

            // quick iterate through our map, and run getPlanetCoordIndex on the ones we didn't find

            // TODO not sure this is great for levels > 0
            for(let i = starting_x; i < ending_x; i++) {
                for (let j = starting_y; j < ending_y; j++) {

                    let in_found_coords = false;
                    let sending_coord_index = -1;

                    for(let p = 0; p < found_coords.length && in_found_coords === false; p++) {
                        if(found_coords[p].tile_x === i && found_coords[p].tile_y === j) {
                            in_found_coords = true;
                            sending_coord_index = found_coords[p].planet_coord_index;
                        }
                    }

                    if(!in_found_coords) {
                        //console.log("Did not find coord tile_x,y: " + i + "," + j + " in found coords");
                        let planet_coord_data = { 'planet_id': dirty.planet_coords[coord_index].planet_id,
                            'planet_level': dirty.planet_coords[coord_index].level, 'tile_x': i, 'tile_y': j };
                        sending_coord_index = await main.getPlanetCoordIndex(planet_coord_data);
                    }

                    if(sending_coord_index !== -1) {
                        socket.emit('planet_coord_info', { 'planet_coord': dirty.planet_coords[sending_coord_index] });


                        if(dirty.planet_coords[sending_coord_index].monster_id) {
                            await world.sendMonsterInfo(socket, false, dirty, { 'monster_id': dirty.planet_coords[sending_coord_index].monster_id });
                            await world.checkMonsterBattleConditions(dirty, dirty.planet_coords[sending_coord_index].monster_id, 'player', socket.player_id, socket);
                        }

                        if(dirty.planet_coords[sending_coord_index].object_id) {
                            await world.checkObjectBattleConditions(socket, dirty, dirty.planet_coords[sending_coord_index].object_id, 'player', socket.player_id);
                        }

                        if(dirty.planet_coords[sending_coord_index].player_id) {
                            await world.sendPlayerInfo(io, socket, false, dirty, dirty.planet_coords[sending_coord_index].player_id);
                        }
                    }

                }
            }


        } catch(error) {
            log(chalk.red("Error in map.updateMapPlanet:" + error));
        }



    }

    async function updateMapShip(socket, dirty) {
        //console.log("Sending ship_data from updateMapShip");

        let player_index = await main.getPlayerIndex({ 'player_id': socket.player_id });

        if(player_index === -1) {
            log(chalk.yellow("Unable to find socket player in map.updateMapPlanet"));
            return;
        }

        let player_ship_coord_index = await main.getShipCoordIndex({'ship_coord_id': dirty.players[player_index].ship_coord_id });

        if(player_ship_coord_index === -1) {
            log(chalk.yellow("Could not find player's ship coord to update the map"));
            return false;
        }



        let starting_x = dirty.ship_coords[player_ship_coord_index].tile_x - Math.floor(global.show_cols / 2);
        let starting_y = dirty.ship_coords[player_ship_coord_index].tile_y - Math.floor(global.show_rows / 2);
        let ending_x = starting_x + global.show_cols + 1;
        let ending_y = starting_y + global.show_rows + 1;

        if(starting_x < 0) { starting_x = 0; }

        if(starting_y < 0) { starting_y = 0; }


        // I think the only feasible way to do this is to always just make sure
        // active ship coords are loaded - we are almost never going to have full screens

        for(let i = 0; i < dirty.ship_coords.length; i++) {
            if(dirty.ship_coords[i] && dirty.ship_coords[i].ship_id === dirty.ship_coords[player_ship_coord_index].ship_id &&
                dirty.ship_coords[i].level === dirty.ship_coords[player_ship_coord_index].level &&
                dirty.ship_coords[i].tile_x <= ending_x && dirty.ship_coords[i].tile_x >= starting_x &&
                dirty.ship_coords[i].tile_y <= ending_y && dirty.ship_coords[i].tile_y >= starting_y ) {

                //console.log("Sending ship coord id: " + dirty.ship_coords[i]);
                socket.emit('ship_coord_info', { 'ship_coord': dirty.ship_coords[i] });
            }
        }


        /*
        console.time("updateMapShip");

        for(let i = starting_x; i < ending_x; i++) {
            for(let j = starting_y; j < ending_y; j++) {
                //console.log("Going to send coord data for " + i + "," + j);

                let ship_coord_data = { 'ship_id': dirty.ship_coords[player_ship_coord_index].ship_id, 'tile_x': i, 'tile_y': j };
                let ship_coord_index = await main.getShipCoordIndex(ship_coord_data);

                if(ship_coord_index !== -1) {
                    socket.emit('ship_coord_info', { 'ship_coord': dirty.ship_coords[ship_coord_index] });




                } else {
                    // TODO stop querying the database for planet coords that are outside of the planet's bounds
                    //console.log("Could not find planet coord for planet id: " + socket.player_planet_id + " level: " + socket.player_planet_level +
                    //    " " + i + " , " + j);
                }

            }
        }

        console.timeEnd("updateMapShip");

        */

    }
    