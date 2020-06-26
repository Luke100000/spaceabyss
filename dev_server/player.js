var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;

const game_object = require('./game_object.js');
const helper = require('./helper.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const world = require('./world.js');


async function calculateDefense(dirty, player_index, damage_type = false) {

    try {
        // By default all players have one defense
        let player_defense = 1;

        // Base level + body/ship type
        let defense_level = await world.getPlayerLevel(dirty, { 'player_index': player_index, 'skill_type': 'defense' });

        let player_body_index = await main.getObjectIndex(dirty.players[player_index].body_id);
        let player_body_type_index = main.getObjectTypeIndex(dirty.objects[player_body_index].object_type_id);


        // Start with defense as defense level
        player_defense = defense_level;

        if(damage_type !== false) {

            if(damage_type === 'electric' && helper.notFalse(dirty.object_types[player_body_type_index].electric_defense_modifier) ) {
                
                player_defense += dirty.object_types[player_body_type_index].electric_defense_modifier;
            }

        }



        let player_equipment_linkers = dirty.equipment_linkers.filter(linker => linker.body_id === dirty.players[player_index].body_id);

        for(let equipment_linker of player_equipment_linkers) {
            let object_type_index = dirty.object_types.findIndex(function(obj) { return obj && obj && obj.id === equipment_linker.object_type_id; });
            if(object_type_index !== -1) {
                // see if the object attack is in this range
                if(dirty.object_types[object_type_index].defense > 0) {
                    //log(chalk.cyan("Have equipped item in range. Adding: " + dirty.object_types[object_type_index].attack_strength));
                    player_defense += dirty.object_types[object_type_index].defense;
                }
            }
        }


        //console.log("In calculatePlayerDefense. attacks_defended: " + dirty.players[player_index].attacks_defended);
        // and we modify the final defense based on how many things the player is defending from this turn
        if(dirty.players[player_index].attacks_defended > 1) {
            //console.log("Doing math: " + player_defense + " / " + dirty.players[player_index].attacks_defended);
            player_defense = Math.ceil(player_defense / dirty.players[player_index].attacks_defended);

        }


        for(let i = 0; i < dirty.eating_linkers.length; i++) {
            if(dirty.eating_linkers[i] && dirty.eating_linkers[i].body_id === dirty.players[player_index].body_id) {
                let race_linker_index = main.getRaceEatingLinkerIndex({
                    'race_id': dirty.object_types[player_body_type_index].race_id, 'object_type_id': dirty.eating_linkers[i].eating_object_type_id
                });

                if(dirty.race_eating_linkers[race_linker_index].defense) {
                    //console.log("Eating increased player attack by: " + dirty.race_eating_linkers[race_linker_index].attack);
                    player_defense += dirty.race_eating_linkers[race_linker_index].defense;
                }
            }
        }

        return player_defense;
    } catch(error) {
        log(chalk.red("Error in player.caclculateDefense: " + error));
        console.error(error);
    }


}

exports.calculateDefense = calculateDefense;


async function calculateMovementModifier(socket, dirty, scope, coord_index) {

    try {
        
        
        if(scope === 'ship' || scope === 'planet') {

            let previous_socket_movement_modifier = socket.movement_modifier;

            // Get the floor type of the tile we moved to, and put in a move modifier for the socket on the next
            // move if it's applicable
            let floor_type_index = -1;
            if(scope === 'planet') {
                floor_type_index = main.getFloorTypeIndex(dirty.planet_coords[coord_index].floor_type_id);
            } else if(scope === 'ship') {
                floor_type_index = main.getFloorTypeIndex(dirty.ship_coords[coord_index].floor_type_id);
            }
            

            if(floor_type_index !== -1 && dirty.floor_types[floor_type_index].movement_modifier) {

                socket.movement_modifier = dirty.floor_types[floor_type_index].movement_modifier;

            }

            //console.time("land/fluid_check");
            let player_body_index = await main.getObjectIndex(dirty.players[socket.player_index].body_id);
            if(player_body_index !== -1) {
                let player_body_type_index = main.getObjectTypeIndex(dirty.objects[player_body_index].object_type_id);
                if(player_body_type_index !== -1) {
                    if(player_body_type_index !== -1 && floor_type_index !== -1 ) {

                        if(dirty.object_types[player_body_type_index].land_movement_modifier !== 1 && dirty.floor_types[floor_type_index].movement_type === 'land') {
                            socket.movement_modifier = socket.movement_modifier * dirty.object_types[player_body_type_index].land_movement_modifier;
                            //console.log("body land movement modifier changed socket.movement_modifier to: " + socket.movement_modifier);
                        }

                        
                        if(dirty.object_types[player_body_type_index].fluid_movement_modifier !== 1 && dirty.floor_types[floor_type_index].movement_type === 'fluid') {
                            socket.movement_modifier = socket.movement_modifier * dirty.object_types[player_body_type_index].fluid_movement_modifier;
                            //console.log("body land movement modifier changed socket.movement_modifier to: " + socket.movement_modifier);
                        }

                        
                        if(dirty.object_types[player_body_type_index].air_movement_modifier !== 1 && dirty.floor_types[floor_type_index].movement_type === 'air') {
                            socket.movement_modifier = socket.movement_modifier * dirty.object_types[player_body_type_index].air_movement_modifier;
                            //console.log("body land movement modifier changed socket.movement_modifier to: " + socket.movement_modifier);
                        }

                    }
                }
            }
            
            

            //console.timeEnd("land/fluid_check");

            if(socket.movement_modifier !== previous_socket_movement_modifier) {
                //console.log("Reset socket move count: " + socket.movement_modifier + " !== " + previous_socket_movement_modifier);
                socket.move_count = 1;
                socket.move_totals = 0;
            }

        } else {
            //console.log("Galaxy set socket move modifer to 1");
            socket.movement_modifier = 1;
        }

    } catch(error) {
        log(chalk.red("Error in player.calculateMovementModifier: " + error));
        console.error(error);
    }
}

exports.calculateMovementModifier = calculateMovementModifier;


/**
 * 
 * @param {Object} socket 
 * @param {Object} dirty 
 * @param {number} ship_id 
 */
async function claimShip(socket, dirty, ship_id) {
    try {


        if(isNaN(ship_id)) {
            log(chalk.yellow("isNaN ship_id"));
            return false;
        }

        log(chalk.cyan("Player is claiming a ship! with id: " + ship_id));

        if(typeof socket.player_index === 'undefined') {
            log(chalk.yellow("Socket doesn't have a player yet"));
            return false;
        }
        let ship_index = await main.getObjectIndex(parseInt(ship_id));

        if(ship_index === -1) {
            log(chalk.yellow("Couldn't find ship"));
            return false;
        }



        // Make sure the new ship isn't owned by someone already
        if(dirty.objects[ship_index].npc_id || (dirty.objects[ship_index].player_id && dirty.objects[ship_index].player_id !== dirty.players[socket.player_index].id) ) {
            console.log("Can't claim a ship that is already owned by someone");
            socket.emit('chat', { 'message': "Can't claim ship. Already owned", 'scope':'system' });
            socket.emit('result_info', { 'status': 'failure', 'text': "That ship is already owned"});
            return false;
        }

        let ship_object_type_index = main.getObjectTypeIndex(dirty.objects[ship_index].object_type_id);

        if(!dirty.object_types[ship_object_type_index].can_be_claimed) {
            console.log("This cannot be claimed");
            socket.emit('chat', { 'message': "Cannot be claimed", 'scope':'system' });
            socket.emit('result_info', { 'status': 'failure', 'text': dirty.object_types[ship_object_type_index].name + " will not let you claim it" });
            return false; 
        }

        if(dirty.object_types[ship_object_type_index].id === 114) {
            console.log("Can't just claim a pod");
            socket.emit('chat', { 'message': "Cannot be claimed", 'scope':'system' });
            socket.emit('result_info', { 'status': 'failure', 'text': "You can't claim pods (but can switch to them)" });
            return false; 
        }


        // The new ship is now controlled by the player
        dirty.objects[ship_index].player_id = dirty.players[socket.player_index].id;
        dirty.objects[ship_index].has_change = true;

        await game_object.sendInfo(socket, "galaxy", dirty, ship_index);


        for(let i = 0; i < dirty.ship_coords.length; i++) {
            if(dirty.ship_coords[i] && dirty.ship_coords[i].ship_id === dirty.objects[ship_index].id) {

                // Switch the airlock over to the claiming player too
                if(dirty.ship_coords[i].object_type_id === 266) {
                    let changing_object_index = await main.getObjectIndex(dirty.ship_coords[i].object_id);
                    if(changing_object_index !== -1) {
                        dirty.objects[changing_object_index].player_id = dirty.players[socket.player_index].id;
                        dirty.objects[changing_object_index].has_change = true;
                    }
                }

            }
        }


    } catch(error) {
        log(chalk.red("Error in player.claimShip: " + error));
        console.error(error);
    }
}

exports.claimShip = claimShip;


async function sendInfo(socket, room, dirty, player_id) {

    try {
        player_id = parseInt(player_id);
        //console.log("In sendPlayerInfo with player_id " + player_id);

        let player_index = await main.getPlayerIndex({ 'player_id': player_id });

        if (player_index === -1) {
            log(chalk.red("Unable to find player"));
            return false;
        }


        if (socket !== false) {
            socket.emit('player_info', { 'player': dirty.players[player_index] });
        }

        if (room !== false) {
            io.to(room).emit('player_info', { 'player': dirty.players[player_index] });
        }




        // If we are requesting player info for the player that the socket belongs to, grab an AI objects
        // and AI rules
        // Not sure we need this here. We send the info when the player logs in
        /*
        if(socket.player_id === player_id) {
            sendPlayerAIs(socket, room, dirty, player_id);

        }

        */
    } catch (error) {
        log(chalk.red("Error in player.sendInfo: " + error));
        console.error(error);
    }

}

exports.sendInfo = sendInfo;


async function sendShips(socket, dirty, player_index) {

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


// There are two general scenarios where this is called
    // 1. Claiming and switching to a ship in the galaxy mode
    // 2. Switching to a different ship at a spaceport
    //  data:   ship_id
    async function switchShip(socket, dirty, data) {
        try {
            log(chalk.cyan("Player is switching to ship(object) with id: " + data.ship_id));

            let player_index = await main.getPlayerIndex({ 'player_id': socket.player_id });

            if(player_index === -1) {
                log(chalk.yellow("Could not find player. Returning false"));
                return false;
            }

            // So lets go through the various scenarios
            // 1. Player was on a pod, now they aren't
            // 2. Player was already on another ship


            // ship is an object, and we store it as the player's ship_id
            let old_ship_index = await main.getObjectIndex(dirty.players[player_index].ship_id);
            let new_ship_index = await main.getObjectIndex(parseInt(data.ship_id));

            if(!old_ship_index) {
                log(chalk.yellow("Couldn't find old ship index"));
                return false;
            }

            if(dirty.objects[old_ship_index].id === dirty.objects[new_ship_index].id) {
                console.log("Can't claim your current ship");
                socket.emit('chat', { 'message': "Can't reclaim your current ship", 'scope':'system' });
                return false;
            }

            // Make sure the new ship isn't owned by someone already
            if(dirty.objects[new_ship_index].player_id && dirty.objects[new_ship_index].player_id !== socket.player_id) {
                console.log("Can't claim a ship that is already owned by someone");
                socket.emit('chat', { 'message': "Can't claim ship. Already owned", 'scope':'system' });
                return false;
            }

            let new_ship_object_type_index = main.getObjectTypeIndex(dirty.objects[new_ship_index].object_type_id);

            if(!dirty.object_types[new_ship_object_type_index].can_be_claimed) {
                console.log("This cannot be claimed");
                socket.emit('chat', { 'message': "Cannot be claimed", 'scope':'system' });
                return false; 
            }




            // Switch is happening in a spaceport
            if(dirty.players[player_index].planet_coord_id) {
                dirty.players[player_index].ship_id = dirty.objects[new_ship_index].id;
                dirty.players[player_index].ship_coord_id = false;
                dirty.players[player_index].previous_ship_coord_id = false;
                dirty.players[player_index].has_change = true;
                await sendInfo(socket, false, dirty, dirty.players[player_index].id);
            }
            // Switch is happening on a ship
            // 1. Switching to the ship our other ship is docked at, since we own both
            // 2. Switching between two ships docked at a station we are on
            // 3. Jumping out of a ship via an emergency pod
            if(dirty.players[player_index].ship_coord_id) {

                console.log("Player is switching to ship: " + dirty.objects[new_ship_index].id + " while on another ship");

                dirty.players[player_index].ship_id = dirty.objects[new_ship_index].id;
                dirty.players[player_index].has_change = true;

                // We switched ships while on a ship that isn't dockable - meaning we jumped out!
                /*
                if(!dirty.objects[old_ship_index].is_dockable) {

                    let previous_ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.players[player_index].ship_coord_id });

                    main.updateCoordGeneric(socket, { 'ship_coord_index': previous_ship_coord_index, 'player_id': false });

                    dirty.players[player_index].ship_coord_id = false;
                    dirty.players[player_index].previous_ship_coord_id = false;
                    dirty.players[player_index].has_change = true;
                }

                // We're still at the same place on the ship we are currently on
                else {

                    console.log("Just set a new ship_id for the player");

                }
                */


                await sendInfo(socket, false, dirty, dirty.players[player_index].id);

                // If our new ship is docked at something, we remove our player from the galaxy coord
                if(dirty.players[player_index].coord_id && dirty.objects[new_ship_index].docked_at_object_id) {

                    let coord_index = await main.getCoordIndex({ 'coord_id': dirty.players[player_index].coord_id });
                    await main.updateCoordGeneric(socket, { 'coord_index': coord_index, 'player_id': false });

                    dirty.players[player_index].coord_id = false;
                    dirty.players[player_index].has_change = true;
                    await sendInfo(socket, "galaxy", dirty, dirty.players[player_index].id);
                    await sendInfo(socket, "ship_" + dirty.objects[new_ship_index].id, dirty, dirty.players[player_index].id);
                }


            }

            // Switching ships could happen on a planet, or on a galaxy
            // If we are on the galaxy, we are moving the player to the coord with the new ship
            else if(dirty.objects[new_ship_index].coord_id) {

                let new_ship_coord_index = await main.getCoordIndex({'coord_id': dirty.objects[new_ship_index].coord_id});
                let old_player_coord_index = await main.getCoordIndex({'coord_id': dirty.players[player_index].coord_id});

                if(new_ship_coord_index === -1 || old_player_coord_index === -1) {
                    return false;
                }

                // The old ship is now on a coord (set in updateCoordGeneric), without a player
                dirty.objects[old_ship_index].player_id = false;
                dirty.objects[old_ship_index].has_change = true;
                await game_object.sendInfo(socket, "galaxy", dirty, old_ship_index);



                // The player leaves the old ship on the coord they were on (leaving that coord)
                await main.updateCoordGeneric(socket, { 'coord_index': old_player_coord_index,
                    'object_id': dirty.objects[old_ship_index].id, 'player_id': false });

                // And moves to the new ship
                await main.updateCoordGeneric(socket, { 'coord_index': new_ship_coord_index, 'object_id': false,
                    'player_id': dirty.players[player_index].id });


                // The player now owns the new ship, and moves to the coord where it was
                dirty.players[player_index].ship_id = dirty.objects[new_ship_index].id;
                dirty.players[player_index].coord_id = dirty.coords[new_ship_coord_index].id;
                dirty.players[player_index].ship_coord_id = false;
                dirty.players[player_index].previous_ship_coord_id = false;
                dirty.players[player_index].has_change = true;
                await sendInfo(socket, "galaxy", dirty, dirty.players[player_index].id);

                world.setPlayerMoveDelay(socket, dirty, player_index);



            } else if(dirty.objects[new_ship_index].planet_coord_id) {
                log(chalk.red("Not sure we are supporting ships showing up on planets right now"));
                return false;
                /*
                let new_ship_planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.objects[new_ship_index].planet_coord_id });
                let old_player_planet_coord_index = await main.getPlanetCoordIndex({'planet_coord_id': dirty.players[player_index].planet_coord_id });

                if(new_ship_planet_coord_index === -1 || old_player_planet_coord_index === -1) {
                    return false;
                }

                // The player leaves the old ship on the coord they were on (leaving that coord)
                await main.updateCoordGeneric(socket, { 'coord_index': old_player_planet_coord_index,
                    'object_id': dirty.objects[old_ship_index].id, 'player_id': false });

                // And moves to the new ship
                await main.updateCoordGeneric(socket, { 'coord_index': new_ship_planet_coord_index, 'object_id': false,
                    'player_id': dirty.players[player_index].id });


                console.log("Sent old ship object info with player_id = false when player_id used to be " + dirty.objects[old_ship_index].player_id);
                // The old ship is now on a coord (set in updateCoordGeneric), without a player
                dirty.objects[old_ship_index].player_id = false;
                dirty.objects[old_ship_index].has_change = true;
                await game_object.sendInfo(socket, "planet_" + dirty.planet_coords[new_ship_planet_coord_index].planet_id, dirty, old_ship_index);


                // The new ship is now not on any coord, since it's controlled by the player
                dirty.objects[new_ship_index].planet_coord_id = false;
                dirty.objects[new_ship_index].player_id = dirty.players[player_index].id;
                dirty.objects[new_ship_index].has_change = true;
                await game_object.sendInfo(socket, "planet_" + dirty.planet_coords[new_ship_planet_coord_index].planet_id, dirty, new_ship_index);


                // The player now owns the new ship, and moves to the coord where it was
                dirty.players[player_index].ship_id = dirty.objects[new_ship_index].id;
                dirty.players[player_index].ship_coord_id = false;
                dirty.players[player_index].planet_coord_id = dirty.planet_coords[new_ship_planet_coord_index].id;
                dirty.players[player_index].has_change = true;
                await world.sendPlayerInfo(socket, "planet_" + dirty.planet_coords[new_ship_planet_coord_index].planet_id, dirty, dirty.players[player_index].id);

                // Bounce the player to the galaxy
                movement.switchToGalaxy(socket, dirty);

                // We change the socket move delay to the move delay of the ship the player is now at
                let new_ship_object_type_index = main.getObjectTypeIndex(dirty.objects[new_ship_index].object_type_id);

                // deprecated. Use world.setPlayerMoveDelay
                if(dirty.object_types[new_ship_object_type_index].move_delay) {
                    socket.move_delay = dirty.object_types[new_ship_object_type_index].move_delay;
                }

                */

            }


            // Finally, we want to switch the airlock and the engines over to the player that now owns the ship ( if it's a different player for this ship )
            if(dirty.objects[new_ship_index].player_id !== dirty.players[player_index].id) {

                // The new ship is now controlled by the player
                dirty.objects[new_ship_index].player_id = dirty.players[player_index].id;
                dirty.objects[new_ship_index].has_change = true;

                await game_object.sendInfo(socket, "galaxy", dirty, new_ship_index);


                for(let i = 0; i < dirty.ship_coords.length; i++) {
                    if(dirty.ship_coords[i] && dirty.ship_coords[i].ship_id === dirty.objects[new_ship_index].id) {

                        if(dirty.ship_coords[i].object_type_id === 265 || dirty.ship_coords[i].object_type_id === 266) {
                            let changing_object_index = await main.getObjectIndex(dirty.ship_coords[i].object_id);
                            if(changing_object_index !== -1) {
                                dirty.objects[changing_object_index].player_id = dirty.players[player_index].id;
                                dirty.objects[changing_object_index].has_change = true;
                            }
                        }

                    }
                }
            }







        } catch(error) {
            log(chalk.red("Error in player.switchShip: " + error));
            console.error(error);
        }
    }

    exports.switchShip = switchShip;


module.exports = {
    calculateDefense,
    calculateMovementModifier,
    claimShip,
    sendInfo,
    sendShips,
    switchShip
}