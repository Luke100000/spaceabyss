module.exports = function(main, io, mysql, pool, chalk, log, world) {

    var module = {};

    io.sockets.on('connection', function (socket) {


        async function updateMap(socket, dirty) {
            try {

                if(!socket.logged_in) {
                    return false;
                }

                let player_index = await main.getPlayerIndex({'player_id': socket.player_id });


                if(dirty.players[player_index].planet_coord_id) {
                    //console.log("socket player planet_id: " + socket.player_player_id);
                    await updateMapPlanet(socket, dirty);
                } else if(dirty.players[player_index].ship_coord_id) {
                    await updateMapShip(socket, dirty);
                } else if(dirty.players[player_index].coord_id) {
                    await updateMapGalaxy(socket, dirty);
                } else {
                    console.log("Not sure where the player is. Not sure what map to send");
                }

            } catch(error){
                console.error("map.updateMap failed: " + error);
            }
        }

        module.updateMap = updateMap;

        async function updateMapGalaxy(socket, dirty) {
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
                                await world.sendPlanetInfo(socket, false, dirty,
                                    { 'planet_id': dirty.coords[other_coord_index].planet_id, 'source': 'map.updateMapGalaxy' });
                            }

                        }
                    }
                }
            } catch(error) {
                log(chalk.red("Error in map.updateMapGalaxy: " + error));
            }


        }

        async function updateMapPlanet(socket, dirty) {
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

                let starting_x = dirty.planet_coords[coord_index].tile_x - Math.floor(global.show_cols / 2);
                let starting_y = dirty.planet_coords[coord_index].tile_y - Math.floor(global.show_rows / 2);
                let ending_x = starting_x + global.show_cols + 1;
                let ending_y = starting_y + global.show_rows + 1;

                // No point in querying planet coords less than 0 since they don't exist
                // TODO get the planet size, and make sure ending_x and ending_y are <= the max coords for the planet
                if(starting_x < 0) { starting_x = 0; }
                if(starting_y < 0) { starting_y = 0; }

                for(let i = starting_x; i < ending_x; i++) {
                    for(let j = starting_y; j < ending_y; j++) {
                        //console.log("Going to send coord data for " + i + "," + j);

                        let planet_coord_data = { 'planet_id': dirty.planet_coords[coord_index].planet_id,
                            'planet_level': dirty.planet_coords[coord_index].level, 'tile_x': i, 'tile_y': j };
                        let planet_coord_index = await main.getPlanetCoordIndex(planet_coord_data);

                        if(planet_coord_index !== -1) {

                            socket.emit('planet_coord_info', { 'planet_coord': dirty.planet_coords[planet_coord_index] });


                            if(dirty.planet_coords[planet_coord_index].monster_id) {
                                world.sendMonsterInfo(socket, false, dirty, { 'monster_id': dirty.planet_coords[planet_coord_index].monster_id });
                                world.checkMonsterBattleConditions(dirty, dirty.planet_coords[planet_coord_index].monster_id, 'player', socket.player_id, socket);
                            }

                            if(dirty.planet_coords[planet_coord_index].object_id) {
                                world.checkObjectBattleConditions(socket, dirty, dirty.planet_coords[planet_coord_index].object_id, 'player', socket.player_id);
                            }

                            if(dirty.planet_coords[planet_coord_index].player_id) {
                                world.sendPlayerInfo(socket, false, dirty, dirty.planet_coords[planet_coord_index].player_id);
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

        }

    });

    return module;
};