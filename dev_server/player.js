//@ts-check
var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;

const game = require('./game.js');
const game_object = require('./game_object.js');
const helper = require('./helper.js');
const inventory = require('./inventory.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const movement = require('./movement.js');
const world = require('./world.js');


async function calculateDefense(dirty, player_index, damage_type = '') {

    try {
        // By default all players have one defense
        let player_defense = 1;

        // Base level + body/ship type
        let defense_level = await world.getPlayerLevel(dirty, { 'player_index': player_index, 'skill_type': 'defense' });

        let player_body_index = await game_object.getIndex(dirty, dirty.players[player_index].body_id);
        let player_body_type_index = main.getObjectTypeIndex(dirty.objects[player_body_index].object_type_id);


        // Start with defense as defense level
        player_defense = defense_level;


        if(damage_type === 'electric' && helper.notFalse(dirty.object_types[player_body_type_index].electric_defense_modifier) ) {
            
            player_defense += dirty.object_types[player_body_type_index].electric_defense_modifier;
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
        log(chalk.red("Error in player.calculateDefense: " + error));
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
            let player_body_index = await game_object.getIndex(dirty, dirty.players[socket.player_index].body_id);
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
        let ship_index = await game_object.getIndex(dirty, parseInt(ship_id));

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
                    let changing_object_index = await game_object.getIndex(dirty, dirty.ship_coords[i].object_id);
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


/**
 * 
 * @param {Object} dirty 
 * @param {Object} data 
 * @param {number} data.player_index
 * @param {number} data.damage_amount
 * @param {Object=} data.battle_linker
 * @param {Array} data.damage_types
 * @param {number} data.calculating_range
 * @param {String=} data.flavor_text
 */
async function damage(dirty, data) {
    try {



        let new_player_hp = dirty.players[data.player_index].current_hp - data.damage_amount;


        if(isNaN(new_player_hp)) {
            log(chalk.red("Something damaged a player and set their HP to NaN!!!!"));
            console.trace("INVESTIGATE!");

            if(isNan(dirty.players[data.player_index].current_hp)) {
                log(chalk.red("Player has NaN HP! Gave them 100 HP!"));
                dirty.players[data.player_index].current_hp = 100;
                dirty.players[data.player_index].has_change = true;
            }
            return false;
        }

        if(!data.flavor_text) {
            data.flavor_text = false;
        } else {
            console.log("In player.damage with flavor text: " + data.flavor_text);
        }

        if(!data.damage_types) {
            data.damage_types = ['normal'];
        }

        let player_socket = false;

        if(data.battle_linker && data.battle_linker.being_attacked_socket_id) {
            player_socket = io.sockets.connected[data.battle_linker.being_attacked_socket_id];
        } else {
            player_socket = await world.getPlayerSocket(dirty, data.player_index);
        }

        if(new_player_hp <= 0) {
            console.log("Calling player.kill");
            player.kill(dirty, data.player_index);
        } else {
            dirty.players[data.player_index].current_hp = new_player_hp;
            dirty.players[data.player_index].has_change = true;

            await world.increasePlayerSkill(player_socket, dirty, data.player_index, ['defending']);

            if(data.battle_linker) {
                if(player_socket) {
                    io.sockets.connected[data.battle_linker.being_attacked_socket_id].emit('damaged_data', {
                        'player_id': dirty.players[data.player_index].id, 'damage_amount': data.damage_amount, 'was_damaged_type': 'hp',
                        'damage_source_type': data.battle_linker.attacking_type, 'damage_source_id': data.battle_linker.attacking_id,
                        'damage_types': data.damage_types,
                        'calculating_range': data.calculating_range, 'flavor_text': data.flavor_text
                    });
                }

            } else {


                if(player_socket) {
                    player_socket.emit('damaged_data', {
                        'player_id': dirty.players[data.player_index].id, 'damage_amount': data.damage_amount,
                        'damage_types': data.damage_types, 'was_damaged_type': 'hp',
                    })
                }




            }


        }

        if(data.damage_types.length !== 0) {
            for(let i = 0; i < data.damage_types.length; i++) {

                if(data.damage_types[i] === 'poison') {
                    console.log("Player was attacked by a poison attack!");
                    let player_body_index = await game_object.getIndex(dirty, dirty.players[data.player_index].body_id);
                    let object_type_index = main.getObjectTypeIndex(365);
                    game.addAddictionLinker(dirty, player_socket, object_type_index, { 'player_index': data.player_index, 'player_body_index': player_body_index });
                }
            }
        }
    } catch(error) {
        log(chalk.red("Error in player.damage: " + error));
        console.error(error);
    }

}

exports.damage = damage;


async function kill(dirty, player_index) {

    try {

        // return false if we already have an entry in the database queue
        let database_queue_index = database_queue.findIndex(function(obj) { return obj &&
            obj.player_id === socket.player_id && obj.action === 'kill' });;

        if(database_queue_index !== -1) {
            console.log("Already killing player");
            return false;
        }

        // Immediately put in a memory block from multi killing the player
        database_queue_index = database_queue.push({'player_id': socket.player_id, 'action': 'kill' }) - 1;

        log(chalk.green("\nPlayer id: " + dirty.players[player_index].id + " has died"));


        // First thing we do is remove all battle linkers
        world.removeBattleLinkers(dirty, { 'player_id': dirty.players[player_index].id });

        // Get the socket the player is connected with
        let player_socket = world.getPlayerSocket(dirty, player_index);
        if(player_socket === false) {
            console.log("Got player socket as FALSE");
        } else {
            console.log("Got player socket id as: " + player_socket.id);
        }


        // We're going to spawn a dead body whether we can place it or not
        let insert_object_type_data = { 'object_type_id': 151 };
        let new_object_id = await world.insertObjectType(false, dirty, insert_object_type_data);
        let new_object_index = await game_object.getIndex(dirty, new_object_id);

        console.log("Created the dead body");

        // Players can die while on a planet, in their ship, or if their ship got destroyed

        if(dirty.players[player_index].planet_coord_id) {
            let coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.players[player_index].planet_coord_id });

            // player is off this planet coord
            dirty.planet_coords[coord_index].player_id = false;
            dirty.planet_coords[coord_index].has_change = true;


            let can_place_result = await game_object.canPlace(dirty, 'planet', dirty.planet_coords[coord_index],
                { 'object_type_id': 151 });

            // place the dead body
            if(can_place_result) {
                

                await main.placeObject(false, dirty, { 'object_index': new_object_index,
                    'planet_coord_index': coord_index });

                /*
                await world.addObjectToPlanetCoord(dirty, new_object_index, coord_index);
                await world.sendPlanetCoordInfo(false, "planet_" + dirty.planet_coords[coord_index].planet_id,
                    dirty, { 'planet_coord_index': coord_index});
                */
                console.log("Added it to planet coord, and sent planet coord info");

            } else {

                dirty.waiting_drops.push({'object_index': new_object_index, 'planet_coord_index': coord_index });
                log(chalk.yellow("Could not place dead body. Pushed to waiting_drops"));
            }

            



           



        }
        // Ship ID before coord id
        else if(dirty.players[player_index].ship_coord_id) {
            let coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.players[player_index].ship_coord_id });



            // Don't want to overwrite the object that is already on the tile
            if(!dirty.ship_coords[coord_index].object_id) {
                await main.updateCoordGeneric(player_socket, { 'ship_coord_index': coord_index, 'player_id': false, 'object_index': new_object_index });
            } else {
                dirty.waiting_drops.push({'object_index': new_object_index, 'ship_coord_index': coord_index });
                log(chalk.yellow("Could not place dead body. Pushed to waiting_drops"));
            }




            console.log("Added it to ship coord, and sent ship coord info");

        } else if(dirty.players[player_index].coord_id) {
            /// ?????????????????
            log(chalk.yellow("Ship should have been damaged, not player. Maybe ship got to 0 HP?"));
            return false;
        }


        // lets see what the player has on their body, and put it in the dead body
        let body_index = await game_object.getIndex(dirty, dirty.players[player_index].body_id);
        console.log("Got body index as: " + body_index + ". Player body id was: " + dirty.players[player_index].body_id);

        // Unequip all the items (this puts basically everything back into the inventory of the player



        for(let equipment_linker of dirty.equipment_linkers) {
            if(equipment_linker) {
                if(equipment_linker.body_id === dirty.objects[body_index].id) {
                    await unequip(player_socket, dirty, equipment_linker.id);
                }
            }

        }


        console.log("Unequipped everything from the dead body");

        for(let i = 0; i < dirty.inventory_items.length; i++) {
            if(dirty.inventory_items[i] && dirty.inventory_items[i].player_id === dirty.players[player_index].id) {

                // remove the inventory item
                let remove_data = { 'inventory_item_id': dirty.inventory_items[i].id, 'amount': dirty.inventory_items[i].amount };
                let add_data = { 'adding_to_type': 'object', 'adding_to_id': new_object_id, 'amount': dirty.inventory_items[i].amount };
                if(dirty.inventory_items[i].object_id) {
                    add_data.object_id = dirty.inventory_items[i].object_id;
                }

                if(dirty.inventory_items[i].object_type_id) {
                    add_data.object_type_id = dirty.inventory_items[i].object_type_id;
                }
                await inventory.removeFromInventory(player_socket, dirty, remove_data);

                await inventory.addToInventory(player_socket, dirty, add_data);
            }
        }


        console.log("Moved inventory items into dead body");

        // delete the old body
        console.log("Going to delete the old body. Body index: " + body_index);
        await game_object.deleteObject(dirty, { 'object_index': body_index });

        console.log("Deleted the old body");

        // give the player a new body
        // TODO we want to have a cost for body switching for any reason
        await world.setPlayerBody(dirty, player_index);

        // and put our HP back to max
        dirty.players[player_index].current_hp = dirty.players[player_index].max_hp;
        dirty.players[player_index].has_change = true;



        console.log("DONE WITH THE NEW STUFF");



        await movement.switchToGalaxy(player_socket, dirty, 'death');
        player_socket.emit('message_data', { 'message': "Your body was killed", 'scope': 'system' });

        // and clear out the database queue
        delete database_queue[database_queue_index];


    } catch(error) {
        log(chalk.red("Error in player.kill: " + error));
        console.error(error);
    }
}

exports.kill = kill;

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
            let old_ship_index = await game_object.getIndex(dirty, dirty.players[player_index].ship_id);
            let new_ship_index = await game_object.getIndex(dirty, parseInt(data.ship_id));

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
                            let changing_object_index = await game_object.getIndex(dirty, dirty.ship_coords[i].object_id);
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



    async function unequip(socket, dirty, equipment_linker_id) {

        try {

            equipment_linker_id = parseInt(equipment_linker_id);

            console.log("Player is unequipping equipment_linker_id: " + equipment_linker_id);

            let equipment_linker_index = dirty.equipment_linkers.findIndex(function(obj) { return obj && obj.id === equipment_linker_id; });

            if(equipment_linker_index === -1) {
                return false;
            }


            if(dirty.equipment_linkers[equipment_linker_index].object_id) {
                let adding_to_data = { 'adding_to_type': 'player', 'adding_to_id': socket.player_id,
                    'object_id': dirty.equipment_linkers[equipment_linker_index].object_id,
                    'object_type_id': dirty.equipment_linkers[equipment_linker_index].object_type_id, 'amount':1 };
                await inventory.addToInventory(socket, dirty, adding_to_data);
            } else {
                let adding_to_data = { 'adding_to_type': 'player', 'adding_to_id': socket.player_id,
                    'object_type_id': dirty.equipment_linkers[equipment_linker_index].object_type_id, 'amount': dirty.equipment_linkers[equipment_linker_index].amount };
                await inventory.addToInventory(socket, dirty, adding_to_data);
            }

            // emit equipment data
            socket.emit('equipment_linker_info', { 'remove': true, 'equipment_linker': dirty.equipment_linkers[equipment_linker_index] });


            await (pool.query("DELETE FROM equipment_linkers WHERE id = ?", [dirty.equipment_linkers[equipment_linker_index].id]));

            delete dirty.equipment_linkers[equipment_linker_index];


        } catch(error) {
            log(chalk.red("Error in player.unequip: " + error));
            console.error(error);
        }

    }
    exports.unequip = unequip;

module.exports = {
    calculateDefense,
    calculateMovementModifier,
    claimShip,
    damage,
    kill,
    sendInfo,
    sendShips,
    switchShip,
    unequip
}