var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const { Worker, isMainThread, parentPort } = require('worker_threads');
const chalk = require('chalk');
const log = console.log;

const game = require('./game.js');
const game_object = require('./game_object.js');
const helper = require('./helper.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const planet = require('./planet.js');
const world = require('./world.js');


async function calculateDefense(dirty, monster_index, damage_types = []) {

    try {

        let monster_type_index = main.getMonsterTypeIndex(dirty.monsters[monster_index].monster_type_id);
        if(monster_type_index === -1) {
            log(chalk.yellow("Was unable to get monster type index in battle.calculateMonsterDefense"));
            return 1;

        }

        let defense = 1;

        if(dirty.monster_types[monster_type_index].defense) {
            defense = dirty.monster_types[monster_type_index].defense;
        }

        // modify for each damage type we encounter.....
        if(damage_types.length > 0) {


            for(let i = 0; i < damage_types.length; i++) {

                if(damage_types[i] === 'hacking' && dirty.monster_types[monster_type_index].hacking_defense_modifier) {
                    defense += dirty.monster_types[monster_type_index].hacking_defense_modifier;
                }

                if(damage_types[i] === 'piercing' && dirty.monster_types[monster_type_index].piercing_defense_modifier) {
                    defense += dirty.monster_types[monster_type_index].piercing_defense_modifier;
                }
            }


        }

        return defense;


    } catch(error) {
        log(chalk.red("Error in monster.calculateDefense: " + error));
        console.error(error);
    }


}



//   data: monster_index   |   damage_amount   |   battle_linker   |   monster_info   |   calculating_range   |   damage_types
//   damage_source_type   |   damage_source_id
async function damage(dirty, data) {
    try {

        let monster_type_index = main.getMonsterTypeIndex(dirty.monsters[data.monster_index].monster_type_id);

        if(monster_type_index === -1) {
            console.log("Couldn't find monster type");
            return false;
        }

        // If we didn't pass in the monster info, grab it now
        if(!data.monster_info) {
            data.monster_info = await getCoordAndRoom(dirty, data.monster_index);
        }

        data.damage_amount = parseInt(data.damage_amount);

        if(isNaN(data.damage_amount)) {
            log(chalk.yellow("Can't damage monster a NaN amount"));
            console.trace("Here's the culprit");
            return false;
        }


        let new_monster_hp = dirty.monsters[data.monster_index].current_hp - data.damage_amount;
        //console.log("Calculated new_monster_hp as: " + new_monster_hp + " have calculating_range as: " + data.calculating_range);

        if(!data.damage_types) {
            data.damage_types = [];
        }

        // send new monster info to the room

        // Normally the monster will be attacked through a direct battle linker
        if(data.battle_linker) {

            io.to(data.monster_info.room).emit('damaged_data',
                {'monster_id': dirty.monsters[data.monster_index].id, 'damage_amount': data.damage_amount, 'damage_types': data.damage_types,
                    'was_damaged_type': 'hp',
                    'damage_source_type': data.battle_linker.attacking_type, 'damage_source_id': data.battle_linker.attacking_id,
                    'calculating_range': data.calculating_range });
        }
        // But it's also possible it's not directly through a battle linker (splash, AOE damage, decay)
        else if(data.damage_source_type) {


            if(data.damage_source_type === 'decay') {
                io.to(data.monster_info.room).emit('damaged_data',
                    {   'monster_id': dirty.monsters[data.monster_index].id, 'damage_amount': data.damage_amount,
                        'damage_types': data.damage_types, 'was_damaged_type': 'hp',
                        'damage_source_type': data.damage_source_type });
            } else {
                io.to(data.monster_info.room).emit('damaged_data',
                    {   'monster_id': dirty.monsters[data.monster_index].id, 'damage_amount': data.damage_amount,
                        'damage_types': data.damage_types, 'was_damaged_type': 'hp',
                        'damage_source_type': data.damage_source_type, 'damage_source_id': data.damage_source_id,
                        'calculating_range': data.calculating_range });
            }




            if(data.damage_source_type !== 'decay') {
                // And the monster is going to be PISSED


                console.log("Damage is not from a battle linker. Lets see if we can attack the source of the damage");

                // If the monster isn't already attacking something, attack the damage source
                let existing_battle_linker_index = dirty.battle_linkers.findIndex(function(obj) { return obj &&
                    obj.attacking_id === dirty.monsters[data.monster_index].id && obj.attacking_type === 'monster' });

                if(existing_battle_linker_index === -1) {
                    let battle_linker_data = {
                        'attacking_id': dirty.monsters[data.monster_index].id, 'attacking_type': 'monster',
                        'being_attacked_id': data.damage_source_id, 'being_attacked_type': data.damage_source_type };

                    //console.log("Battle linker data: ");
                    //console.log(battle_linker_data);

                    await world.addBattleLinker(socket, dirty, battle_linker_data);
                }
            }

        } else {
            log(chalk.yellow("Should really add in some data about where this damage is coming from"));

        }



        if (new_monster_hp <= 0) {

            //console.log("Monster is killed");


            // It's a player that killed the monster
            if(data.battle_linker && data.battle_linker.attacking_type === 'player') {
                let player_index = await main.getPlayerIndex({ 'player_id': data.battle_linker.attacking_id });
                //console.log("Adding exp to player");

                if(helper.notFalse(dirty.monster_types[monster_type_index].exp)) {
                    dirty.players[player_index].exp = dirty.players[player_index].exp + dirty.monster_types[monster_type_index].exp;
                    dirty.players[player_index].has_change = true;
                } else {
                    log(chalk.red("BIG ISSUE! Monster type id: " + dirty.monster_types[monster_type_index].id + " gives no exp!"));
                }



                if(main.isFalse(dirty.players[player_index].exp)) {
                    log(chalk.red("BIG ISSUE! Player just killed monster type id: " + dirty.monster_types[monster_type_index].id + " and has 0 exp!"));
                }

                await game.addKilledLinker(dirty.players[player_index].player_id, dirty.monsters[data.monster_index].monster_type_id);

                //console.log("Should be calling game.checkExp");
                game.checkExp(socket, dirty, player_index);

                if(dirty.monster_types[monster_type_index].race_id) {

                    let race_index = main.getRaceIndex(dirty.monster_types[monster_type_index].race_id);

                    // lets modify the player's relationship with that race
                    await world.updatePlayerRelationship(io.sockets.connected[data.battle_linker.socket_id], dirty, player_index,
                        { 'type': 'race', 'type_index': race_index, 'change': -1 });

                }
            }

            //console.log("Calling deleteMonster with monster index: " + data.monster_index);
            await deleteMonster(dirty, { 'monster_index': data.monster_index, 'reason': 'battle', 'battle_linker': data.battle_linker });
            //console.log("Done with deleteMonster");

        } else {
            //console.log("monster not dead yet");

            if(isNaN(new_monster_hp)) {
                log(chalk.red("We tried setting the monster's current hp to a NaN value: " + new_monster_hp));
            } else {
                dirty.monsters[data.monster_index].current_hp = new_monster_hp;
                dirty.monsters[data.monster_index].has_change = true;

                // send the monster info to players in the room
                io.to(data.monster_info.room).emit('monster_info', { 'monster': dirty.monsters[data.monster_index]});
            }



        }

    } catch(error) {
        log(chalk.red("Error in monster.damage: " + error));
        console.error(error);
    }
}

exports.damage = damage;

// monster_index   |   reason   |   skip_check_spawned_event
async function deleteMonster(dirty, data) {

    try {

        //console.log("In deleteMonster");

        if(typeof data.monster_index === "undefined") {
            console.log("No data.monster_index");
            return false;
        }

        if(!dirty.monsters[data.monster_index]) {
            log(chalk.yellow("Could not find the monster we are deleting. Monster index: " + data.monster_index));
            return false;
        }

        if(!data.reason) {
            data.reason = false;
        }

        //log(chalk.yellow("MONSTER IS DEAD"));

        let monster_type_index = dirty.monster_types.findIndex(function(obj) { return obj && obj.id === dirty.monsters[data.monster_index].monster_type_id; });
        let monster_info = await getCoordAndRoom(dirty, data.monster_index);

        if(monster_info === false) {
            log(chalk.yellow("Looks like world.getMonsterCoordAndRoom failed"));
            return false;
        }


        // If the object is associate with a coord, remove it from that coord
        if(monster_info.scope === 'galaxy') {
            await main.updateCoordGeneric(false, { 'coord_index': monster_info.coord_index, 'monster_id': false });
        } else if(monster_info.scope === 'planet') {
            await main.updateCoordGeneric(false, { 'planet_coord_index': monster_info.coord_index, 'monster_id': false });
        } else if(monster_info.scope === 'ship') {
            await main.updateCoordGeneric(false, { 'ship_coord_index': monster_info.coord_index, 'monster_id': false });
            console.log("Updated ship coord to no object_id");
        }


        world.removeBattleLinkers(dirty, {'monster_id': dirty.monsters[data.monster_index].id });



        if(monster_type_index !== -1) {
            // grab the drop linkers for the monster type
            //console.log("Getting all drop linkers for monster type id: " + dirty.monster_types[monster_type_index].id);
            let drop_linkers = dirty.drop_linkers.filter(drop_linker => drop_linker.monster_type_id === dirty.monster_types[monster_type_index].id);
            if(drop_linkers.length > 0) {

                // get a random drop linker - and it will drop that
                let drop_linker = drop_linkers[Math.floor(Math.random() * drop_linkers.length)];
                //console.log("Going to drop object_type_id: " + drop_linker.dropped_object_type_id);

                let placing_coord_index = -1;

                let can_place_result = await game_object.canPlace(dirty, monster_info.scope, monster_info.coord,
                    { 'object_type_id': drop_linker.dropped_object_type_id });

                if(can_place_result === false) {

                    // try the coords around it
                    for(let x = monster_info.coord.tile_x - 1; can_place_result === false && x <= monster_info.coord.tile_x + 1; x++) {
                        for(let y = monster_info.coord.tile_y - 1; can_place_result === false && y <= monster_info.coord.tile_y + 1; y++) {

                            if(x === monster_info.coord.tile_x && y === monster_info.coord.tile_y) {

                            } else {

                                let adjacent_coord_index = -1;
                                if(monster_info.scope === 'planet') {
                                    adjacent_coord_index = await main.getPlanetCoordIndex({ 'planet_id': dirty.planet_coords[monster_info.coord_index].planet_id,
                                        'planet_level': dirty.planet_coords[monster_info.coord_index].level, 'tile_x': x, 'tile_y': y });
                                } else if(monster_info.scope === 'ship') {
                                    adjacent_coord_index = await main.getShipCoordIndex({ 'ship_id': dirty.ship_coords[monster_info.coord_index].ship_id,
                                        'level': dirty.ship_coords[monster_info.coord_index].level, 'tile_x': x, 'tile_y': y });
                                }



                                if(adjacent_coord_index !== -1) {

                                    if(monster_info.scope === "planet") {
                                        can_place_result = await game_object.canPlace(dirty, monster_info.scope, dirty.planet_coords[adjacent_coord_index],
                                            { 'object_type_id': drop_linker.dropped_object_type_id });
                                    } else if(monster_info.scope === "ship") {
                                        can_place_result = await game_object.canPlace(dirty, monster_info.scope, dirty.ship_coords[adjacent_coord_index],
                                            { 'object_type_id': drop_linker.dropped_object_type_id });
                                    }


                                    if(can_place_result === true) {
                                        placing_coord_index = adjacent_coord_index;
                                    }


                                }



                            }
                        }
                    }



                } else {
                    placing_coord_index = monster_info.coord_index;
                }

                if(placing_coord_index !== -1) {

                    if(monster_info.scope === 'planet') {
                        //console.log("Monster is dropping amount: " + drop_linker.amount + " of object_type_id: " + drop_linker.dropped_object_type_id);
                        await main.updateCoordGeneric(false, { 'planet_coord_index': placing_coord_index, 'object_type_id': drop_linker.dropped_object_type_id,
                            'amount': drop_linker.amount });
                    } else if(monster_info.scope === 'ship') {
                        //console.log("Monster is dropping amount: " + drop_linker.amount + " of object_type_id: " + drop_linker.dropped_object_type_id);
                        await main.updateCoordGeneric(false, { 'ship_coord_index': placing_coord_index, 'object_type_id': drop_linker.dropped_object_type_id,
                            'amount': drop_linker.amount });
                    }


                } else {

                    log(chalk.green("Put something in the waiting drops!"));
                    // We... couldn't find a spot!
                    if(monster_info.scope === "planet") {
                        dirty.waiting_drops.push({'object_type_id': drop_linker.dropped_object_type_id, 'amount': drop_linker.amount, 'planet_coord_index': monster_info.coord_index });
                    } else if(monster_info.scope === "ship") {
                        dirty.waiting_drops.push({'object_type_id': drop_linker.dropped_object_type_id, 'amount': drop_linker.amount, 'ship_coord_index': monster_info.coord_index });
                    }


                }

            } else {
                //console.log("Monster type id: " + dirty.monster_types[monster_type_index].id + " doesn't drop anything");
            }
        } else {
            log(chalk.yellow("Could not find monster type id for killed monster"));
        }



        // an idea.. probably best to do it immediately
        //dirty.monsters[monster_index].is_dead = true;
        //dirty.monsters[monsteR_index].has_change = true;

        let monster_id = dirty.monsters[data.monster_index].id;


        // If a planet coord spawned the monster, we cam update that to false
        //console.log("Going to set spawned monster id to false");
        let spawned_monster_planet_coord_index = await main.getPlanetCoordIndex({'spawned_monster_id': dirty.monsters[data.monster_index].id });
        if(spawned_monster_planet_coord_index !== -1) {
            dirty.planet_coords[spawned_monster_planet_coord_index].spawned_monster_id = false;
            dirty.planet_coords[spawned_monster_planet_coord_index].has_change = true;
        }

        let check_spawned_event_id = 0;
        if(dirty.monsters[data.monster_index].spawned_event_id) {
            check_spawned_event_id = dirty.monsters[data.monster_index].spawned_event_id;
        }

        // Trying to not await due to time delay from MySQL
        (pool.query("DELETE FROM monsters WHERE id = ?", [dirty.monsters[data.monster_index].id]));

        delete dirty.monsters[data.monster_index];



        //log(chalk.yellow("Sending to anyone on planet to remove monster"));
        io.to(monster_info.room).emit('monster_info',
            { 'monster': { 'id': monster_id }, 'remove': true });




        // If this monster was spawned from an AI, we will have the AI escalate if it's able to
        // If we are an AI Daemon, we attempt to spawn the next level of AI helper, the AI....
        if(dirty.monster_types[monster_type_index].id === 33) {
            log(chalk.cyan("AI is trying to advance attack/defense to the next level due to daemon death"));

            let ai_id = 0;

            if(monster_info.scope === "planet") {
                let planet_index = await planet.getIndex(dirty, { 'planet_id': dirty.planet_coords[monster_info.coord_index].planet_id, 'source': 'game.deleteMonster' });
                ai_id = dirty.planets[planet_index].ai_id;

                // and try and attack the attacking player - WHO IS THE ATTACKER IN THIS FUNCTION
                let attack_data = {
                    'ai_id': ai_id,
                    'attacking_type': data.battle_linker.attacking_type,
                    'attacking_id': data.battle_linker.attacking_id,
                    'attack_level': 2
                };

                await world.aiAttack(dirty, attack_data);

            } else if(monster_info.scope === "ship") {
                let ship_index = await main.getObjectIndex(dirty.ship_coords[monster_info.coord_index].ship_id);
                ai_id = dirty.objects[ship_index].ai_id;

                // and try and attack the attacking player
                let attack_data = {
                    'ai_id': ai_id,
                    'attacking_type': data.battle_linker.attacking_type,
                    'attacking_id': data.battle_linker.attacking_id,
                    'attack_level': 2
                };

                await world.aiAttack(dirty, attack_data);
            }

        }

        if(check_spawned_event_id !== 0&& !data.skip_check_spawned_event) {
            await game.checkSpawnedEvent(dirty, check_spawned_event_id);
        }

    } catch(error) {
        log(chalk.red("Error in monster.deleteMonster: " + error));
        console.error(error);
    }



}

exports.deleteMonster = deleteMonster;


async function getCoordAndRoom(dirty, monster_index) {

    try {

        let room = false;
        let coord_index = -1;
        let scope = false;
        let coord = false;

        // Monster isn't here
        if(!dirty.monsters[monster_index]) {
            log(chalk.yellow("Trying to delete a monster that we couldn't find. monster_index: " + monster_index));
            return { 'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope };
        }

        if(dirty.monsters[monster_index].coord_id) {
            coord_index = await main.getCoordIndex(
                { 'coord_id': dirty.monsters[monster_index].coord_id });
            if(coord_index !== -1) {
                room = "galaxy";
                scope = "galaxy";
                coord = dirty.coords[coord_index];
            }
        }

        if(dirty.monsters[monster_index].planet_coord_id) {
            coord_index = await main.getPlanetCoordIndex(
                { 'planet_coord_id': dirty.monsters[monster_index].planet_coord_id });
            if(coord_index !== -1) {
                room = "planet_" + dirty.planet_coords[coord_index].planet_id;
                scope = "planet";
                coord = dirty.planet_coords[coord_index];
            }

        } else if(dirty.monsters[monster_index].ship_coord_id) {
            coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.monsters[monster_index].ship_coord_id });
            if(coord_index !== -1) {
                room = "ship_" + dirty.ship_coords[coord_index].ship_id;
                scope = "ship";
                coord = dirty.ship_coords[coord_index];
            }
        }

        return { 'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope };
    } catch(error) {
        log(chalk.red("Error in monster.getCoordAndRoom: " + error));
        console.error(error);
    }

}

exports.getCoordAndRoom = getCoordAndRoom;

/**
 *
 * @param dirty
 * @param {number} i - Monster Index
 * @param {Object} data
 * @param {number=} data.monster_type_index
 * @param {string=} data.reason
 * @returns {Promise<boolean>}
 */
async function move(dirty, i, data) {

    try {


        let battle_linker_index = dirty.battle_linkers.findIndex(function(obj) {
            return obj && obj.attacking_type === 'monster' && obj.attacking_id === dirty.monsters[i].id;
        });

        // make sure the monster isn't attacking something if this is an idle movement
        if(data.reason === 'idle' && battle_linker_index !== -1) {
            return false;
        }



        /************ STEP 1. DETERMINE THE DESTINATION COORD!!!!!! *****************/
        let new_x = -1;
        let new_y = -1;
        let old_coord = false;
        let old_coord_index = -1;
        let scope;
        let room;
        let planet_coord_index = -1;
        let attacking_coord = false;

        if(dirty.monsters[i].planet_coord_id) {

            if(typeof dirty.monsters[i].planet_coord_index !== "undefined") {
                planet_coord_index = dirty.monsters[i].planet_coord_index;
            } else {
                planet_coord_index = await main.getPlanetCoordIndex(
                    { 'planet_coord_id': dirty.monsters[i].planet_coord_id });
    
                if(planet_coord_index === -1) {
                    return false;
                }
            }

           

            old_coord = dirty.planet_coords[planet_coord_index];
            old_coord_index = planet_coord_index;
            scope = 'planet';
            room = "planet_" + old_coord.planet_id;
        } else if(dirty.monsters[i].ship_coord_id) {
            let ship_coord_index = await main.getShipCoordIndex(
                { 'ship_coord_id': dirty.monsters[i].ship_coord_id });

            if(ship_coord_index === -1) {
                return false;
            }

            old_coord = dirty.ship_coords[ship_coord_index];
            old_coord_index = ship_coord_index;
            scope = 'ship';
            room = "ship_" + old_coord.ship_id;
        }


        // If we already have a path, we just use that!
        if(dirty.monsters[i].path && dirty.monsters[i].path !== false && dirty.monsters[i].path[0]) {

            new_x = dirty.monsters[i].path[0][0];
            new_y = dirty.monsters[i].path[0][1];
            //console.log("Reading from path to send monster to x,y: " + new_x + "," + new_y);


            // Remove the part of the path we just used
            dirty.monsters[i].path.splice(0, 1);

        } else {

            let change_x = -1;
            let change_y = -1;


            if(data.reason === 'idle' && (dirty.monster_types[data.monster_type_index].idle_movement_type === 'default' ||
                !dirty.monster_types[data.monster_type_index].idle_movement_type)) {

                //console.log("Doing idle movement");
                // get a random x/y around this coord


                if (helper.getRandomIntInclusive(0, 1) === 1) {
                    change_x = 1;
                }

                if (helper.getRandomIntInclusive(0, 1) === 1) {
                    change_y = 1;
                }

                // randomly set one to 0 - so we aren't moving diagonal
                if (helper.getRandomIntInclusive(0, 1) === 1) {
                    change_x = 0;
                } else {
                    change_y = 0;
                }

                new_x = old_coord.tile_x + change_x;
                new_y = old_coord.tile_y + change_y;
            } else if(data.reason === 'battle') {
                //console.log("Doing default battle move");

                // get the thing the monster is attacking

                if(data.battle_linker.being_attacked_type === 'player') {
                    let player_index = await main.getPlayerIndex({ 'player_id': data.battle_linker.being_attacked_id });

                    if(dirty.players[player_index].planet_coord_id) {
                        let player_planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.players[player_index].planet_coord_id });
                        attacking_coord = dirty.planet_coords[player_planet_coord_index];
                    } else if(dirty.players[player_index].ship_coord_id) {
                        let player_ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.players[player_index].ship_coord_id });
                        attacking_coord = dirty.ship_coords[player_ship_coord_index];
                    }
                } else if(data.battle_linker.being_attacked_type === 'object') {
                    let object_index = await main.getObjectIndex(data.battle_linker.being_attacked_id);

                    if(dirty.objects[object_index].planet_coord_id) {
                        let object_planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.objects[object_index].planet_coord_id });
                        attacking_coord = dirty.planet_coords[object_planet_coord_index];
                    } else if(dirty.objects[object_index].ship_coord_id) {
                        let object_ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[object_index].ship_coord_id });
                        attacking_coord = dirty.ship_coords[object_ship_coord_index];
                    }
                }

                let x_difference = main.diff(attacking_coord.tile_x, old_coord.tile_x);
                let y_difference = main.diff(attacking_coord.tile_y, old_coord.tile_y);

                // Pretty sure we don't need to do all this if we are already next to the player
                if(x_difference <= 1 && y_difference <= 1) {
                    return;
                }


                if( dirty.monster_types[data.monster_type_index].attack_movement_type === 'default' ||
                    !dirty.monster_types[data.monster_type_index].attack_movement_type ) {

                    let rand_move = helper.getRandomIntInclusive(1,2);

                    if(x_difference !== 0 && rand_move === 1) {
                        if(attacking_coord.tile_x > old_coord.tile_x) {
                            new_x = old_coord.tile_x + 1;
                            change_x = 1;
                        } else {
                            new_x = old_coord.tile_x - 1;
                            change_x = -1;
                        }

                        new_y = old_coord.tile_y;
                        change_y = 0;
                    } else if(y_difference !== 0 && rand_move === 2) {
                        if(attacking_coord.tile_y > old_coord.tile_y) {
                            new_y = old_coord.tile_y + 1;
                            change_y = 1;
                        } else {
                            new_y = old_coord.tile_y - 1;
                            change_y = -1;
                        }

                        new_x = old_coord.tile_x;
                        change_x = 0;
                    } else if(x_difference !== 0) {
                        if(attacking_coord.tile_x > old_coord.tile_x) {
                            new_x = old_coord.tile_x + 1;
                            change_x = 1;
                        } else {
                            new_x = old_coord.tile_x - 1;
                            change_x = -1;
                        }

                        new_y = old_coord.tile_y;
                        change_y = 0;
                    } else if(y_difference !== 0) {
                        if(attacking_coord.tile_y > old_coord.tile_y) {
                            new_y = old_coord.tile_y + 1;
                            change_y = 1;
                        } else {
                            new_y = old_coord.tile_y - 1;
                            change_y = -1;
                        }

                        new_x = old_coord.tile_x;
                        change_x = 0; 
                    }

                } else if(dirty.monster_types[data.monster_type_index].attack_movement_type === 'warp_to') {

                    let found_coord = false;

                    for(let x = attacking_coord.tile_x - 1;
                        x <= attacking_coord.tile_x + 1; x++) {
                        for(let y = attacking_coord.tile_y - 1;
                            y <= attacking_coord.tile_y + 1; y++) {

                            if(!found_coord) {
                                let checking_data = {};

                                if(scope === 'planet') {

                                    let checking_data = { 'planet_id': attacking_coord.planet_id,
                                        'planet_level': attacking_coord.level,
                                        'tile_x': x, 'tile_y':y };
                                    let checking_coord_index = await main.getPlanetCoordIndex(checking_data);

                                    let monster_can_place_result = await main.canPlaceMonster('planet',
                                        dirty.planet_coords[checking_coord_index], {'monster_index': i });

                                    if(checking_coord_index !== -1 && monster_can_place_result === true ) {

                                        new_x = dirty.planet_coords[checking_coord_index].tile_x;
                                        new_y = dirty.planet_coords[checking_coord_index].tile_y;

                                        change_x = new_x - old_coord.tile_x;
                                        change_y = new_y - old_coord.tile_y;
                                        found_coord = true;

                                    }
                                } else if(scope === 'ship') {

                                    let checking_data = { 'ship_id': attacking_coord.ship_id,
                                        'level': attacking_coord.level,
                                        'tile_x': x, 'tile_y':y };
                                    let checking_coord_index = await main.getShipCoordIndex(checking_data);

                                    let monster_can_place_result = await main.canPlaceMonster('ship',
                                        dirty.ship_coords[checking_coord_index], { 'monster_index': i });

                                    if(checking_coord_index !== -1 && monster_can_place_result === true ) {

                                        new_x = dirty.ship_coords[checking_coord_index].tile_x;
                                        new_y = dirty.ship_coords[checking_coord_index].tile_y;

                                        change_x = new_x - old_coord.tile_x;
                                        change_y = new_y - old_coord.tile_y;

                                        found_coord = true;

                                    }

                                }


                            }


                        }
                    }

                }

            }

            else {
                log(chalk.yellow("Not sure what move we are doing on this monster. reason: " + data.reason +
                    " idle movement type: " + dirty.monster_types[data.monster_type_index].idle_movement_type));
                return false;
            }
        }



        if(new_x === -1 || new_y === -1) {
            log(chalk.yellow("-1 for new_x or new_y"));
            return false;
        }





        /************* STEP 2. SEE IF WE CAN PLACE ****************/

        let last_x = new_x + dirty.monster_types[data.monster_type_index].movement_tile_width - 1;
        let last_y = new_y + dirty.monster_types[data.monster_type_index].movement_tile_height - 1;



        // Get the destination coord
        let new_coord_index = -1;
        let new_coord = false;

        if(dirty.monsters[i].ship_coord_id) {

            new_coord_index = await main.getShipCoordIndex({
                'ship_id': old_coord.ship_id, 'level': old_coord.level, 'tile_x': new_x, 'tile_y': new_y
            });

            if(new_coord_index === -1) {
                return false;
            }

            new_coord = dirty.ship_coords[new_coord_index];

        } else if(dirty.monsters[i].planet_coord_id) {

            new_coord_index = await main.getPlanetCoordIndex({
                'planet_id': old_coord.planet_id, 'planet_level': old_coord.level,
                'tile_x': new_x, 'tile_y': new_y
            });

            if(new_coord_index === -1) {
                return false;
            }

            new_coord = dirty.planet_coords[new_coord_index];
        }



        //if(dirty.monsters[i].id === 5128) {
        //    can_place_data.debug = true;
        //}

        let can_place = await main.canPlaceMonster(scope, new_coord, { 'monster_index': i });


        if(!can_place) {


            // If we have a path and we just failed to place, the path is invalid!
            if(dirty.monsters[i].path) {
                console.log("Monster path failed");
                dirty.monsters[i].path = false;
                dirty.monsters[i].ticks_until_next_path = 8;
            }

            //if(dirty.monsters[i].id === 5128) {
            //    console.log("Can't do the move");
            //}


            // We can only do pathfinding for monsters that are 1 tile
            // TODO this is currently limited to just planet coords - lets add in support for other coord types
            if(attacking_coord !== false && dirty.monsters[i].planet_coord_id &&
                dirty.monster_types[data.monster_type_index].movement_tile_width === 1 &&
                dirty.monster_types[data.monster_type_index].movement_tile_height === 1) {

                // Lets delay pathfinding attempts a bit
                if(dirty.monsters[i].ticks_until_next_path && dirty.monsters[i].ticks_until_next_path > 1) {
                    dirty.monsters[i].ticks_until_next_path--;
                    return false;
                }
                //log(chalk.cyan("MONSTER PATHFINDING TIME!"));

                const worker = new Worker('./worker_pathfinding.js');


                worker.on('message', (path) => {
                    //console.log("Monster id: " + dirty.monsters[i].id + " path from worker is:");
                    //console.log(path);
                    dirty.monsters[i].path = path;
                });

                worker.on('error', (error) => {
                    console.log("Worker error!");
                    console.error(error);
                });

                worker.on('exit', (code) => {
                    //console.log("Worker exited! Code: ");
                    //console.log(code);


                });

                worker.on('online', () => {
                    //console.log("Worker is online");
                });


                let pathfinding_coords = [];
                for(let c = 0; c < dirty.planet_coords.length; c++) {
                    if(dirty.planet_coords[c] && dirty.planet_coords[c].planet_id === dirty.planet_coords[planet_coord_index].planet_id &&
                        dirty.planet_coords[c].level === dirty.planet_coords[planet_coord_index].level &&
                        dirty.planet_coords[c].tile_x >= dirty.planet_coords[planet_coord_index].tile_x - 3 &&
                        dirty.planet_coords[c].tile_x <= dirty.planet_coords[planet_coord_index].tile_x + 3 &&
                        dirty.planet_coords[c].tile_y >= dirty.planet_coords[planet_coord_index].tile_y - 3 &&
                        dirty.planet_coords[c].tile_y <= dirty.planet_coords[planet_coord_index].tile_y + 3) {
                        pathfinding_coords.push(dirty.planet_coords[c]);
                    }
                }

                //console.log("Sending " + pathfinding_coords.length + " coords into the pathfinding worker");

                worker_data = { 'coords': pathfinding_coords, 'monster': dirty.monsters[i],
                    'origin_x': dirty.planet_coords[planet_coord_index].tile_x, 'origin_y': dirty.planet_coords[planet_coord_index].tile_y,
                    'destination_x': attacking_coord.tile_x, 'destination_y': attacking_coord.tile_y };

                worker.postMessage(worker_data);
            }
            return false;


        }



        /**************** STEP 3: COLLECT THE CURRENT COORDS THE MONSTER IS ON ************************/
        let current_coords = [];

        let old_last_x = old_coord.tile_x + dirty.monster_types[data.monster_type_index].movement_tile_width - 1;
        let old_last_y = old_coord.tile_y + dirty.monster_types[data.monster_type_index].movement_tile_height - 1

        if(dirty.monster_types[data.monster_type_index].movement_tile_width > 1 ||
            dirty.monster_types[data.monster_type_index].movement_tile_height > 1) {

            for(let ox = old_coord.tile_x; ox <= old_last_x; ox++) {
                for(let oy = old_coord.tile_y; oy <= old_last_y; oy++) {

                    if(dirty.monsters[i].planet_coord_id) {
                        let current_planet_coord_index = await main.getPlanetCoordIndex({ 'tile_x': ox, 'tile_y': oy,
                            'planet_level': old_coord.level, 'planet_id': old_coord.planet_id });

                        if(current_planet_coord_index !== -1) {
                            current_coords.push({'planet_coord_id': dirty.planet_coords[current_planet_coord_index].id,
                                'planet_coord_index': current_planet_coord_index, 'still_used': false });
                        }
                    } else if(dirty.monsters[i].ship_coord_id) {
                        let current_ship_coord_index = await main.getShipCoordIndex({ 'tile_x': ox, 'tile_y': oy,
                            'level': old_coord.level,
                            'ship_id': old_coord.ship_id });
                        if(current_ship_coord_index !== -1) {
                            current_coords.push({ 'ship_coord_id': dirty.ship_coords[current_ship_coord_index].id,
                                'ship_coord_index': current_ship_coord_index, 'still_used': false });
                        }
                    }

                    //current_coords.push({ 'tile_x': ox, 'tile_y': oy, 'still_used': false });
                }
            }
        }
        // We just have to push the current coord the monster is on
        else {

            if(dirty.monsters[i].planet_coord_id) {
                current_coords.push({ 'planet_coord_id': old_coord.id, 'planet_coord_index': old_coord_index,
                    'still_used': false });
            } else if(dirty.monsters[i].ship_coord_id) {
                current_coords.push({ 'ship_coord_id': old_coord.id, 'ship_coord_index': old_coord_index,
                    'still_used': false });
            }

        }



        /********* STEP 3: PLACE THE MONSTER THERE **************/



        for(let x = new_x; x <= last_x; x++) {
            for(let y = new_y; y <= last_y; y++) {

                let placing_coord_index = -1;
                let update_data = {};
                if(dirty.monsters[i].planet_coord_id) {
                    placing_coord_index = await main.getPlanetCoordIndex({
                        'planet_id': old_coord.planet_id, 'planet_level': old_coord.level,
                        'tile_x': x, 'tile_y': y
                    });

                    update_data.planet_coord_index = placing_coord_index;
                } else if(dirty.monsters[i].ship_coord_id) {
                    placing_coord_index = await main.getShipCoordIndex({
                        'ship_id': old_coord.ship_id, 'level': old_coord.level,
                        'tile_x': x, 'tile_y': y
                    });

                    update_data.ship_coord_index = placing_coord_index;
                }



                if(x === new_x && y === new_y) {
                    update_data.monster_id = dirty.monsters[i].id;
                    await main.updateCoordGeneric(false, update_data);
                } else {


                    // If it's the previous coord, we were on, we need the monster_id to be false
                    if(x === old_coord.tile_x && y === old_coord.tile_y) {
                        update_data.monster_id = false;
                        update_data.belongs_to_monster_id = dirty.monsters[i].id;
                        await main.updateCoordGeneric(false, update_data);
                    } else {
                        update_data.belongs_to_monster_id = dirty.monsters[i].id;
                        await main.updateCoordGeneric(false, update_data);
                    }


                }

                let current_coord_index = -1;
                if(dirty.monsters[i].planet_coord_id) {
                    current_coord_index = current_coords.findIndex(function(obj) { return obj &&
                        obj.planet_coord_index === placing_coord_index; });
                } else if(dirty.monsters[i].ship_coord_id) {
                    current_coord_index = current_coords.findIndex(function(obj) { return obj &&
                        obj.ship_coord_index === placing_coord_index; });
                }

                if(current_coord_index !== -1) {
                    current_coords[current_coord_index].still_used = true;
                }

            }
        }


        // foreach current coords not used, remove it!

        for(let oc = 0; oc < current_coords.length; oc++) {

            if(current_coords[oc].still_used === false) {
                let update_data = {};

                if(current_coords[oc].planet_coord_index) {
                    update_data.planet_coord_index = current_coords[oc].planet_coord_index;
                } else if(current_coords[oc].ship_coord_index) {
                    update_data.ship_coord_index = current_coords[oc].ship_coord_index;
                }

                update_data.monster_id = false;
                await main.updateCoordGeneric(false, update_data);

            }

        }

        if(scope === 'planet') {
            dirty.monsters[i].planet_coord_id = new_coord.id;
            dirty.monsters[i].planet_coord_index = new_coord_index;
            dirty.monsters[i].has_change = true;
        } else if(scope === 'ship') {
            dirty.monsters[i].ship_coord_id = new_coord.id;
            dirty.monsters[i].ship_coord_index = new_coord_index;
            dirty.monsters[i].has_change = true;
        }

        // update the room with the move
        io.to(room).emit('monster_info', { 'monster': dirty.monsters[i] });


    } catch(error) {
        log(chalk.red("Error in monster.move: " + error));
        console.error(error);
    }

}

exports.move = move;


module.exports = {
    calculateDefense,
    damage,
    deleteMonster,
    getCoordAndRoom,
    move
}