var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;

const game = require('./game.js');
const helper = require('./helper.js');
const inventory = require('./inventory.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const planet = require('./planet.js');
const player = require('./player.js');
const world = require('./world.js');



async function calculateDefense(dirty, object_index, damage_types = []) {

    try {


        let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);
        if(object_type_index === -1) {
            log(chalk.red("Could not get object type index"));
            return 0;
        }
        let defense = 0;
        if(dirty.object_types[object_type_index].defense) {
            defense = dirty.object_types[object_type_index].defense;
        }

        // modify for each damage type we encounter.....
        if(damage_types.length > 0) {


            for(let i = 0; i < damage_types.length; i++) {

                if(damage_types[i] === 'heat' && dirty.object_types[object_type_index].heat_defense_modifier) {
                    defense += dirty.object_types[object_type_index].heat_defense_modifier;
                }

            }


        }


        /*
        if(dirty.object_types[object_type_index].is_ship) {
            // Find ship coords with shields
            let shield_generator_coords = dirty.ship_coords.filter(ship_coord => ship_coord.ship_id === dirty.objects[object_index].id &&
                ship_coord.object_type_id === 48 );

            if(shield_generator_coords.length > 0) {

                let found_energy_source = false;

                for(let shield_coord of shield_generator_coords) {

                    if(!found_energy_source) {
                        let coord_object_index = await getIndex(dirty, shield_coord.object_id);
                        if(coord_object_index !== -1 && dirty.objects[coord_object_index].energy > 1 ) {

                            console.log("Found energy source for shield defense");
                            found_energy_source = true;
                            defense += 5;

                            dirty.objects[coord_object_index].energy -= 1;
                            dirty.objects[coord_object_index].has_change = true;
                        }
                    }

                }
            }
        }

        */

        //console.log("Returning defense of: " + defense);

        return defense;
    } catch(error) {
        log(chalk.red("Error in game_object.calculateDefense: " + error));
        console.error(error);
    }


}


/**
 * @param {Object} dirty
 * @param {String} scope
 * @param {Object} coord
 * @param {Object} data
 * @param {number=} data.object_index
 * @param {number=} data.object_type_id
 * @param {boolean=} data.show_output
 * @returns {Promise<boolean>}
 */
async function canPlace(dirty, scope, coord, data) {
    try {

        let debug_object_type_id = 0;


        let checking_coords = [];

        // we need to have an object type id
        let object_type_id = 0;

        // We can pass it in directly
        if(data.object_type_id) {
            object_type_id = parseInt(data.object_type_id);
        }

        // Or grab it from an object being passed in
        if(data.object_index) {
            object_type_id = dirty.objects[data.object_index].object_type_id;
        }

        if(object_type_id === 0) {
            log(chalk.yellow("With object type display linkers, we need an object type id. Pass it in explicitely (object_type_id), or pass in an object (object_index)"));
            console.trace("TRACEEED");
            return false;
        }

        let object_type_index = dirty.object_types.findIndex(function(obj) { return obj && obj.id === object_type_id; });

        if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
            console.log("in game_object.canPlace for object type: " + dirty.object_types[object_type_index].name);
        }



        // ********** COLLECT ALL THE COORDS WE HAVE TO CHECK **********//
        let display_linkers = dirty.object_type_display_linkers.filter(linker =>
            linker.object_type_id === dirty.object_types[object_type_index].id && !linker.only_visual);

        if(display_linkers.length > 0) {

            if(dirty.object_types[object_type_index].id === debug_object_type_id) {
                console.log("Object type has display linkers");
            }

            for(let linker of display_linkers) {

                let checking_x = coord.tile_x + linker.position_x;
                let checking_y = coord.tile_y + linker.position_y;


                let checking_coord_index = -1;
                if(scope === 'galaxy') {
                    checking_coord_index = await main.getCoordIndex({ 'tile_x': checking_x, 'tile_y': checking_y });

                    if(checking_coord_index !== -1) {
                        checking_coords.push(dirty.coords[checking_coord_index]);
                    }
                } else if(scope === 'planet') {
                    checking_coord_index = await main.getPlanetCoordIndex({ 'planet_id': coord.planet_id,
                        'planet_level': coord.level, 'tile_x': checking_x, 'tile_y': checking_y });

                    if(checking_coord_index !== -1) {
                        checking_coords.push(dirty.planet_coords[checking_coord_index]);
                    }
                } else if(scope === 'ship') {
                    checking_coord_index = await main.getShipCoordIndex({ 'ship_id': coord.ship_id,
                        'level': coord.level,
                        'tile_x': checking_x, 'tile_y': checking_y });

                    if(checking_coord_index !== -1) {
                        checking_coords.push(dirty.ship_coords[checking_coord_index]);
                    }
                }

                // We weren't able to find all the coords we needed to match up to all the display linkers
                if(checking_coord_index === -1) {
                    if(data.show_output) {
                        log(chalk.yellow("Could not find one of the coords we would be placing things on"));
                    }
                    return false;

                }

            }

        } else {
            checking_coords.push(coord);
        }


        //************ GO THROUGH EACH OF THE COORDS THAT WE HAVE **********************//
        for(let checking_coord of checking_coords) {

            if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                console.log("Checking coord id: " + checking_coord.id + " with floor type id: " + checking_coord.floor_type_id);
            }


            // No matter the coord, if the floor type doesn't allow it, it doesn't allow it
            let floor_type_index = main.getFloorTypeIndex(checking_coord.floor_type_id);


            if(floor_type_index !== -1 && !dirty.floor_types[floor_type_index].can_build_on) {

                if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                    log(chalk.yellow("Can't build on that floor type"));
                }
                return false;
            }

            if(floor_type_index !== -1 && dirty.floor_types[floor_type_index].is_protected) {

                if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                    log(chalk.yellow("That floor type is protected"));
                }
                return false;
            }


            // Only block the object type if there's a monster/player/npc if it's not something we can walk on
            if(!dirty.object_types[object_type_index].can_walk_on && (checking_coord.npc_id || checking_coord.player_id || checking_coord.monster_id) ) {
                if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                    log(chalk.yellow("npc, player, or monster already on that coord"));
                }

                return false;
            }

            // Object Type ID comparisons
            if(!data.object_index) {

                // Not going to place a generic object_type on an object
                if(checking_coord.object_id) {
                    if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                        log(chalk.yellow("No object index passed in, and coord already has an object_id"))
                    }
                    return false;
                }

                // False if there's a different object type there.
                if( (checking_coord.object_type_id  && checking_coord.object_type_id !== dirty.object_types[object_type_index].id) || 
                    (checking_coord.belongs_to_object_id && checking_coord.belongs_to_object_type_id !== dirty.object_types[object_type_index].id)) {

                    if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                        log(chalk.yellow("No object index passed in, and coord already has an object_type_id, or belongs_to_object_id"))
                    }
                    return false;
                }
            }
            // comparisons when we have a specific object being placed
            else {

                if( (checking_coord.object_id && checking_coord.object_id !== dirty.objects[data.object_index].id) &&
                    (checking_coord.belongs_to_object_id !== dirty.objects[data.object_index].id) ) {

                    if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                        log(chalk.yellow("Coord has object id or belongs to object id and it doesn't match the object we passed in"));
                    }
                    return false;
                }

                // If the coord we are checking only has an object type id (no object), return false
                if(checking_coord.object_type_id && helper.isFalse(checking_coord.object_id)) {
                    if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                        log(chalk.yellow("Coord has object id or belongs to object id and it doesn't match the object we passed in"));
                    }
                    return false;
                }
            }

            if(scope === 'galaxy' && checking_coord.planet_id || checking_coord.belongs_to_planet_id) {
                if(dirty.object_types[object_type_index].id === debug_object_type_id || data.show_output) {
                    log(chalk.yellow("Can't place on a planet|belongs_to_planet galaxy coord"));
                }
                return false;
            }

        }

        return true;
    } catch(error) {
        log(chalk.red("Error in game_object.canPlace: " + error));
        console.error(error);
    }
}

exports.canPlace = canPlace;


// WARNING!!!! DEPRECATING THIS IN FAVOR OF WORLD.getOpenCoordIndex
/**
 * 
 * @param {Object} dirty 
 * @param {number} tiles_around 
 * @param {Object} data 
 * @param {number=} data.planet_coord_index
 * @param {number=} data.ship_coord_index
 * @param {number=} data.object_index
 * @param {number=} data.object_type_id
 */
// WARNING!!!! DEPRECATING THIS IN FAVOR OF WORLD.getOpenCoordIndex
async function canPlaceAround(dirty, tiles_around, data) {

    try {
        // WARNING!!!! DEPRECATING THIS IN FAVOR OF WORLD.getOpenCoordIndex

        let origin_tile_x;
        let origin_tile_y;
        let placing_coord_index = -1;


        if(typeof data.planet_coord_index !== 'undefined') {
            origin_tile_x = dirty.planet_coords[data.planet_coord_index].tile_x;
            origin_tile_y = dirty.planet_coords[data.planet_coord_index].tile_y;
        }
        
        if(typeof data.ship_coord_index !== 'undefined') {
            origin_tile_x = dirty.ship_coords[data.ship_coord_index].tile_x;
            origin_tile_y = dirty.ship_coords[data.ship_coord_index].tile_y;
        }

        
        

        for(let x = origin_tile_x - tiles_around; placing_coord_index === -1 && x <= origin_tile_x + tiles_around; x++) {
            for(let y = origin_tile_y - tiles_around; placing_coord_index === -1 && y <= origin_tile_y + tiles_around; y++) {

                let trying_coord_index = -1;
                let can_place_data = {};

                if(typeof data.object_index !== 'undefined') {
                    can_place_data.object_index = data.object_index;
                }

                if(typeof data.object_type_id !== 'undefined') {
                    can_place_data.object_type_id = data.object_type_id;
                }


                if(data.planet_coord_index) {
                    trying_coord_index = await main.getPlanetCoordIndex({ 'planet_id': dirty.planet_coords[data.planet_coord_index].planet_id, 
                    'planet_level': dirty.planet_coords[data.planet_coord_index].level, 'tile_x': x, 'tile_y': y });

                    if(trying_coord_index !== -1) {

                        //console.log("Trying coord id: " + dirty.planet_coords[trying_coord_index].id)

                        let can_place_result = await canPlace(dirty, 'planet', dirty.planet_coords[trying_coord_index], can_place_data );
                        //console.log("Can place result: " + can_place_result);
                        if(can_place_result === true) {
                            placing_coord_index = trying_coord_index;
                        }
                    }

                    
                }

                if(data.ship_coord_index) {
                    trying_coord_index = await main.getShipCoordIndex({ 'ship_id': dirty.ship_coords[data.ship_coord_index].ship_id, 
                    'level': dirty.ship_cords[data.planet_coord_index].level, 'tile_x': x, 'tile_y': y });

                    if(trying_coord_index !== -1) {
                        let can_place_result = await canPlace(dirty, 'ship', dirty.ship_coords[trying_coord_index], can_place_data );
                        if(can_place_result === true) {
                            placing_coord_index = trying_coord_index;
                        }
                    }
                }


            }
        }

        return placing_coord_index;


    } catch(error) {
        log(chalk.red("Error in game_object.canPlaceAround: " + error));
        console.error(error);
    }

}

exports.canPlaceAround = canPlaceAround;


//      object_index   |   damage_amount   |   battle_linker (OPTIONAL)   |   object_info   |   calculating_range (OPTIONAL)
//      reason   |   damage_types   |   damage_source_type   |   damage_source_id
/**
 * @param {Object} dirty
 * @param {number} object_index
 * @param {number} damage_amount
 * @param {Object} data
 * @param {Object} data.object_info
 * @param {Array=} data.damage_types
 * @param {Object=} data.battle_linker
 * @param {number=} data.calculating_range
 * @param {String=} data.reason
 */
async function damage(dirty, object_index, damage_amount, data) {
    try {

        if(typeof data.damage_types === 'undefined') {
            data.damage_types = [];
        }

        let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);


        let new_object_hp = dirty.objects[object_index].current_hp - damage_amount;

        // send new object info to the room
        if(data.battle_linker) {
            io.to(data.object_info.room).emit('damaged_data',
                {'object_id': dirty.objects[object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'hp',
                    'damage_source_type': data.battle_linker.attacking_type, 'damage_source_id': data.battle_linker.attacking_id,
                    'damage_types': data.damage_types,
                    'calculating_range': data.calculating_range });

        }
        // We know the damage source type
        else if(data.damage_source_type) {
            io.to(data.object_info.room).emit('damaged_data',
                {'object_id': dirty.objects[object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'hp',
                    'damage_source_type': data.damage_source_type, 'damage_source_id': data.damage_source_id,
                    'damage_types': data.damage_types,
                    'calculating_range': data.calculating_range });
        }

        else {
            io.to(data.object_info.room).emit('damaged_data',
                {   'object_id': dirty.objects[object_index].id, 'damage_amount': damage_amount,
                    'was_damaged_type': 'hp', 'damage_types': data.damage_types });

        }


        if (new_object_hp <= 0) {

            console.log("Object is destroyed");
            if(data.battle_linker) {
                await deleteObject(dirty, { 'object_index': object_index, 'reason': 'battle' });
            } else {
                await deleteObject(dirty, { 'object_index': object_index, 'reason': 'decay' });
            }



        } else {
            //console.log("object not dead yet");

            dirty.objects[object_index].current_hp = new_object_hp;
            dirty.objects[object_index].has_change = true;
            await sendInfo({}, data.object_info.room, dirty, object_index);

            // If the object is a ship
            if(dirty.object_types[object_type_index].is_ship) {
                await game.generateShipDamagedTiles(dirty, object_index);
            }
        }

    } catch(error) {
        log(chalk.red("Error in game_object.damage: " + error));
        console.error(error);
    }
}

exports.damage = damage;



/**
 *
 * @param {Object} dirty
 * @param {Object} data
 * @param {number} data.object_index
 * @param {string=} data.reason
 * @param {Boolean=} data.skip_check_spawned_event
 * @requires main, game
 * @returns {Promise<boolean>}
 */
async function deleteObject(dirty, data) {

    try {

        console.log("In deleteObject");

        if(data.object_index === -1 || !dirty.objects[data.object_index]) {
            console.log("Did not find an object there at dirty.objects");

            return false;
        }

        if(!data.reason) {
            data.reason = false;
        }

        //console.log("In game_object.deleteObject for object id: " + dirty.objects[data.object_index].id);
        //console.log("Reason: " + data.reason);

        //console.log("Deleting object id: " + dirty.objects[data.object_index].id);

        let object_type_index = dirty.object_types.findIndex(function(obj) { return obj && obj.id === dirty.objects[data.object_index].object_type_id; });

        let object_type_display_linkers = dirty.object_type_display_linkers.filter(linker =>
            linker.object_type_id === dirty.object_types[object_type_index].id && !linker.only_visual);

        let object_info = await getCoordAndRoom(dirty, data.object_index);

        if(object_info === false || !object_info.coord) {
            log(chalk.yellow("Could not get the coord the object is on. object_type_id: " +
                dirty.object_types[object_type_index].id + " planet_coord_id: " + dirty.objects[data.object_index].planet_coord_id));
        }

        // Clear out any belongs to object id
        // Not sure if I could just filter planet/galaxy/etc coords by belongs_to_object_id. Might not have all of them
        // in memory???
        // We can only do this if object_info returned a coordinate
        if(object_info !== false) {
            if(object_type_display_linkers.length > 0) {
                object_type_display_linkers.forEach(await async function(linker) {

                    // origin - will be dealt with right after this
                    if(linker.position_x === 0 && linker.position_y === 0) {

                    } else {

                        let belongs_x = object_info.coord.tile_x + linker.position_x;
                        let belongs_y = object_info.coord.tile_y + linker.position_y;

                        // get the belongs coord
                        if(object_info.scope === 'galaxy') {
                            let belongs_coord_index = await main.getCoordIndex({ 'tile_x': belongs_x, 'tile_y': belongs_y });
                            if(belongs_coord_index !== -1) {
                                await main.updateCoordGeneric(false, { 'coord_index': belongs_coord_index,
                                    'belongs_to_object_id': false });
                            }
                        } else if(object_info.scope === 'planet') {
                            let belongs_coord_index = await main.getPlanetCoordIndex({ 'planet_id': object_info.coord.planet_id,
                                'planet_level': object_info.coord.level, 'tile_x': belongs_x, 'tile_y': belongs_y });
                            if(belongs_coord_index !== -1) {
                                await main.updateCoordGeneric(false, { 'planet_coord_index': belongs_coord_index,
                                    'belongs_to_object_id': false });
                            }
                        } else if(object_info.scope === 'ship') {
                            let belongs_coord_index = await main.getShipCoordIndex({ 'ship_id': object_info.coord.ship_id,
                                'level': object_info.coord.level,
                                'tile_x': belongs_x, 'tile_y': belongs_y });
                            if(belongs_coord_index !== -1) {
                                await main.updateCoordGeneric(false, { 'ship_coord_index': belongs_coord_index,
                                    'belongs_to_object_id': false });
                            }
                        }

                    }
                });
            }


            // If the object is associate with a coord, remove it from that coord
            if(object_info.scope === 'galaxy') {
                await main.updateCoordGeneric(false, { 'coord_index': object_info.coord_index, 'object_id': false });
            } else if(object_info.scope === 'planet') {
                await main.updateCoordGeneric(false, { 'planet_coord_index': object_info.coord_index, 'object_id': false });
            } else if(object_info.scope === 'ship') {
                await main.updateCoordGeneric(false, { 'ship_coord_index': object_info.coord_index, 'object_id': false });
                console.log("Updated ship coord to no object_id");
            }
        }



        // OBJECT TYPE SPECIFIC CASES
        // AI
        // There are some special cases on planets - like if it was an AI
        if (dirty.objects[data.object_index].object_type_id === 72) {

            if(dirty.objects[data.object_index].planet_coord_id) {
                let planet_index = await planet.getIndex(dirty, { 'planet_id': dirty.objects[data.object_index].planet_id, 'source': 'game_object.deleteObject' });
                if (planet_index !== -1) {
                    dirty.planets[planet_index].ai_id = false;
                    dirty.planets[planet_index].player_id = false;
                    dirty.planets[planet_index].has_change = true;

                    io.emit('planet_info', { 'planet': dirty.planets[planet_index] });
                }
            } else if(dirty.objects[data.object_index].ship_coord_id) {
                let ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[data.object_index].ship_coord_id });
                if(ship_coord_index !== -1) {
                    let ship_index = await getIndex(dirty, dirty.ship_coords[ship_coord_index].ship_id);
                    if(ship_index !== -1) {
                        dirty.objects[ship_index].ai_id = false;
                        dirty.objects[ship_index].has_change = true;
                        io.emit('object_info', { 'object': dirty.objects[ship_index] });
                    }
                }

            }


        }

        // Spaceship
        if(dirty.object_types[object_type_index].is_ship) {
            console.log("Object is a ship");
            await game.deleteShip(socket, dirty, dirty.objects[data.object_index].id, data.reason);
        }


        // Delete battle linkers
        world.removeBattleLinkers(dirty, { 'object_id': dirty.objects[data.object_index].id });

        // delete any inventory items this had
        await main.getObjectInventory(dirty.objects[data.object_index].id);

        for(let inventory_item of dirty.inventory_items) {
            if(inventory_item && dirty.objects[data.object_index] && inventory_item.owned_by_object_id === dirty.objects[data.object_index].id) {
                await inventory.removeFromInventory(false, dirty, { 'inventory_item_id': inventory_item.id, 'amount': inventory_item.amount });
            }
        }

        // if it's a body - delete any items that are equipped on it
        if(dirty.object_types[object_type_index].race_id) {
            await player.getEquipment(dirty, dirty.objects[data.object_index].id);

            for(let equipment_linker of dirty.equipment_linkers) {
                if(equipment_linker && equipment_linker.body_id === dirty.objects[data.object_index].id) {
                    let equipped_object_index = await getIndex(dirty, equipment_linker.object_id);

                    await deleteObject(dirty, { 'object_index': equipped_object_index });
                }
            }

        }

        // delete any equipment linkers associated with this object
        await (pool.query("DELETE FROM equipment_linkers WHERE object_id = ?", [dirty.objects[data.object_index].id]));


        // delete any rules
        for(let i = 0; i < dirty.rules.length; i++) {
            if(dirty.rules[i] && dirty.rules[i].object_id === dirty.objects[data.object_index].id) {

                if(dirty.rules[i].rule === "protect_3" || dirty.rules[i].rule === "protect_4") {

                    for(let c = 0; c < dirty.coords.length; c++) {
                        if(dirty.coords[c] && dirty.coords[c].watched_by_object_id === dirty.objects[data.object_index].id) {
                            await main.updateCoordGeneric(false, { 'coord_index': c, 'watched_by_object_id': false });
                        }
                    }
                }


                delete dirty.rules[i];

            }
        }

        await (pool.query("DELETE FROM rules WHERE object_id = ?", [dirty.objects[data.object_index].id]));


        // Recalculate ship engines and engine power if this object type is_ship_engine
        if(dirty.object_types[object_type_index].is_ship_engine && dirty.objects[data.object_index].ship_coord_id) {
            console.log("A ship engine was destroyed!!");

            let ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[data.object_index].ship_coord_id});
            if(ship_coord_index !== -1) {
                let ship_index = await getIndex(dirty, dirty.ship_coords[ship_coord_index].ship_id);
                if(ship_index !== -1) {
                    await world.attachShipEngines(dirty, ship_index);
                    await sendInfo(socket, false, dirty, ship_index);
                }
            }
        }



        //console.log("Sending object info with remove from game_object.deleteObject");
        if(object_info !== false) {
            io.to(object_info.room).emit('object_info', { 'remove': true, 'object': dirty.objects[data.object_index] });
        }


        // See if it drops anything
        // Rarity roll

        // We can only do the drop linkers if object_info didn't return false ( error out )
        if(object_info !== false) {
            let rarity_roll = helper.rarityRoll();

            //console.log("Getting all drop linkers for object type id: " + dirty.object_types[object_type_index].id);
            let drop_linkers = dirty.drop_linkers.filter(drop_linker =>
                drop_linker.object_type_id === dirty.object_types[object_type_index].id &&
                drop_linker.reason === data.reason && drop_linker.rarity <= rarity_roll);
            if(drop_linkers.length > 0) {



                let drop_linker = drop_linkers[Math.floor(Math.random() * drop_linkers.length)];


                if(drop_linker.dropped_monster_type_id) {


                    let spawn_monster_data = {};

                    if(object_info.scope === "planet") {
                        spawn_monster_data.planet_coord_index = object_info.coord_index;

                    } else if(object_info.scope === "ship") {
                        spawn_monster_data.ship_coord_index = object_info.coord_index;

                    } else if(object_info.scope === "galaxy") {
                        spawn_monster_data.coord_index = object_info.coord_index;
                    }

                    await monster.spawn(dirty, drop_linker.dropped_monster_type_id, spawn_monster_data);


                } else if(drop_linker.dropped_object_type_id) {
                    console.log("Going to drop object_type_id: " + drop_linker.dropped_object_type_id);


                    if(object_info.scope === "galaxy") {
                        await main.updateCoordGeneric(false, { 'coord_index': object_info.coord_index,
                            'object_type_id': drop_linker.dropped_object_type_id, 'amount': drop_linker.amount });
                    } else if(object_info.scope === "planet") {
                        await main.updateCoordGeneric(false, { 'planet_coord_index': object_info.coord_index,
                            'object_type_id': drop_linker.dropped_object_type_id, 'amount': drop_linker.amount });
                    } else if(object_info.scope === "ship") {
                        await main.updateCoordGeneric(false, { 'ship_coord_index': object_info.coord_index,
                            'object_type_id': drop_linker.dropped_object_type_id, 'amount': drop_linker.amount });

                    }
                }



            } else {
                //console.log("Object type id: " + dirty.object_types[object_type_index].id + " doesn't drop anything");
            }
        }


        let check_spawned_event_id = 0;

        // If the object was attached to an event, and there's nothing else attached to the event, despawn the event
        if(dirty.objects[data.object_index].spawned_event_id) {
            check_spawned_event_id = dirty.objects[data.object_index].spawned_event_id;

        }

        // delete the object
        await (pool.query("DELETE FROM objects WHERE id = ?", [dirty.objects[data.object_index].id]));



        delete dirty.objects[data.object_index];


        if(check_spawned_event_id !== 0 && !data.skip_check_spawned_event) {
            await game.checkSpawnedEvent(dirty, check_spawned_event_id);
        }

        //console.log("Done in game_object.deleteObject");
    } catch(error) {
        log(chalk.red("Error in game_object.deleteObject: " + error));
        console.error(error);
    }



}

exports.deleteObject = deleteObject;


async function getIndex(dirty, object_id) {
    try {

        if(typeof object_id === "undefined" || object_id === null) {
            console.log("Received invalid request. In game_object.getIndex");
            return -1;
        }

        //console.log("In getObjectIndex");

        object_id = parseInt(object_id);

        if(isNaN(object_id)) {
            log(chalk.yellow("NaN object id passed into game_object.getIndex"));
            console.trace("TRACED!");
            return -1;
        }

        let object_index = dirty.objects.findIndex(function(obj) { return obj && obj.id === object_id; });

        if(object_index === -1) {
            let [rows, fields] = await (pool.query("SELECT * FROM objects WHERE id = ?", [object_id]));

            if(rows[0]) {

                let object = rows[0];

                // quickly make sure we haven't already added it
                let memory_index = dirty.objects.findIndex(function(obj) { return obj && obj.id === object_id; });
                if(memory_index !== -1) {
                    //log(chalk.yellow("Already added the object"));
                    return memory_index;
                }

                object.has_change = false;
                //log(chalk.cyan("Adding object id: " + object.id + " to dirty"));
                object_index = dirty.objects.push(object) - 1;
                //console.log("New object index: " + object_index);

                dirty.objects[object_index].id = parseInt(dirty.objects[object_index].id);

                //console.log("Object id: " + dirty.objects[object_index].id);

                if(object.has_inventory) {
                    //log(chalk.cyan("GETTING INVENTORY FOR object id: " + dirty.objects[object_index].id));
                    await main.getObjectInventory(dirty.objects[object_index].id);
                }

                let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);

                if(object_type_index === -1) {
                    console.log("Did not find object type for the object.... " + dirty.objects[object_index].object_type_id);
                } else {

                    //console.log("Object type id: " + dirty.object_types[object_type_index].id + " is_ship: " + dirty.object_types[object_type_index].is_ship);
                    if(dirty.object_types[object_type_index].is_ship) {


                        //log(chalk.cyan("Loading ship coords for object id: " + object.id));

                        await main.getShipCoords(object_index);
                        await world.attachShipEngines(dirty, object_index);

                    }

                    // Might have rules
                    if(dirty.object_types[object_type_index].is_dockable || dirty.object_types[object_type_index].id === 185) {
                        //log(chalk.cyan("Getting rules for object id: " + object.id));
                        await main.getRules(object.id);
                    }
                }

            } else {
                log(chalk.yellow("Did not find object with id: " + object_id + " in the database"));


                // if a planet coord still has this object id, lets remove that as well
                let planet_coord_index = dirty.planet_coords.findIndex(function (obj) { return obj && obj.object_id === object_id; });
                if(planet_coord_index !== -1) {
                    console.log("removing from planet coord that still has it");
                    await main.updateCoordGeneric(socket, { 'planet_coord_index': planet_coord_index, 'object_id': false });
                }

                // if a ship coord still has this object id, lets remove that as well
                let ship_coord_index = dirty.ship_coords.findIndex(function(obj) { return obj && obj.object_id === object_id; });
                if(ship_coord_index !== -1) {
                    await main.updateCoordGeneric(socket, { 'ship_coord_index': ship_coord_index, 'object_id': false });
                }

                let coord_index = dirty.coords.findIndex(function(obj) { return obj && obj.object_id === object_id; });
                if(coord_index !== -1) {
                    await main.updateCoordGeneric(socket, { 'coord_index': coord_index, 'object_id': false });
                }

                // If there's an equipment linker with this object, we remove it
                let equipment_linker_index = dirty.equipment_linkers.findIndex(function(obj) { return obj && obj.object_id === object_id; });
                if(equipment_linker_index !== -1) {
                    console.log("Found an equipment linker with this object");



                    await (pool.query("DELETE FROM equipment_linkers WHERE id = ?", [dirty.equipment_linkers[equipment_linker_index].id]));

                    delete dirty.equipment_linkers[equipment_linker_index];
                }

                // If there's an inventory item with this object, we remvoe it
                let inventory_item_index = dirty.inventory_items.findIndex(function(obj) { return obj && obj.object_id === object_id; });
                if(inventory_item_index !== -1) {
                    console.log("Found an inventory item with this object");
                    await (pool.query("DELETE FROM inventory_items WHERE id = ?", [dirty.inventory_items[inventory_item_index].id]));

                    delete dirty.inventory_items[inventory_item_index];
                }

                return object_index;
            }

        }

        // This seems like a good place to see if something about the object is.... wrong!!!
        // TODO for something like this to work we would need to check inventories too. Good/bad idea?
        /*
        if(!dirty.objects[object_index].ship_coord_id && !dirty.objects[object_index].planet_coord_id && !dirty.objects[object_index].coord_id) {
            log(chalk.red("Potentially broken object: " + dirty.objects[object_index].id));
        }
        */

        //console.log("Returning object index " + object_index);
        return object_index;
    } catch(error) {
        log(chalk.red("Error in game_object.getIndex: " + error + " object id passed in: " + object_id));
        console.error(error);
    }

}

exports.getIndex = getIndex;



async function getCoordAndRoom(dirty, object_index) {

    try {

        let room = false;
        let coord_index = -1;
        let scope = false;
        let coord = false;

        if (!dirty.objects[object_index]) {
            log(chalk.yellow("Could not find the object we are deleting. Object index: " + object_index));
            return {'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope};
        }

        if (dirty.objects[object_index].coord_id) {
            coord_index = await main.getCoordIndex(
                {'coord_id': dirty.objects[object_index].coord_id});
            if (coord_index !== -1) {
                room = "galaxy";
                scope = "galaxy";
                coord = dirty.coords[coord_index];
            }
        }

        if (dirty.objects[object_index].planet_coord_id) {
            coord_index = await main.getPlanetCoordIndex(
                {'planet_coord_id': dirty.objects[object_index].planet_coord_id});
            if (coord_index !== -1) {
                room = "planet_" + dirty.planet_coords[coord_index].planet_id;
                scope = "planet";
                coord = dirty.planet_coords[coord_index];
            }

        } else if (dirty.objects[object_index].ship_coord_id) {
            coord_index = await main.getShipCoordIndex({'ship_coord_id': dirty.objects[object_index].ship_coord_id});
            if (coord_index !== -1) {
                room = "ship_" + dirty.ship_coords[coord_index].ship_id;
                scope = "ship";
                coord = dirty.ship_coords[coord_index];
            }
        }

        return {'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope};
    } catch (error) {
        log(chalk.red("Error in game_object.getCoordAndRoom: " + error));
        console.error(error);
    }
}

exports.getCoordAndRoom = getCoordAndRoom;



/**
 *
 * @param socket
 * @param dirty
 * @param {Object} data
 * @param {number=} data.object_id
 * @param {number=} data.object_index
 * @param {number=} data.planet_coord_index
 * @param {number=} data.ship_coord_index
 * @param {number=} data.coord_index
 * @param {String=} data.reason
 * @returns {Promise<boolean>}
 */
async function place(socket, dirty, data) {

    try {

        //log(chalk.cyan("In game_object.place with data: "));
        //console.log(data);

        let object_index = -1;

        if(typeof data.object_index !== 'undefined') {
            object_index = data.object_index;
        } else if(data.object_id) {
            object_index = await getIndex(dirty, data.object_id);
        }

        if(object_index === -1) {
            return false;
        }

        let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);


        // We can't place things on stairs or a hole - I think in general I should have this in the various canPlace functions
        // But this is such a game breaking thing
        if(typeof data.planet_coord_index !== "undefined" && (dirty.planet_coords[data.planet_coord_index].object_type_id === 63 ||
            dirty.planet_coords[data.planet_coord_index].object_type_id === 62 )) {
            log(chalk.yellow("Can't place on hole or stairs! Why didn't canPlace catch this?!?"));
            console.trace("this!");
            return false;
        }

        // PORTAL    
        if(dirty.object_types[object_type_index].is_portal) {
            let place_portal_data = { };

            if(data.planet_coord_index) {
                place_portal_data.planet_coord_index = data.planet_coord_index;

            } else if(data.ship_coord_index) {
                place_portal_data.ship_coord_index = data.ship_coord_index;
            }

            await game.placePortal(socket, dirty, object_index, place_portal_data );

            // Pretty sure this is inserting and
            //await game.addPortal(socket, dirty, dirty.objects[object_index].id, add_portal_data);

        }
        // AI
        else if(dirty.objects[object_index].object_type_id === 72) {
            let add_ai_data = {};

            if(data.planet_coord_index) {
                add_ai_data = { 'object_id': dirty.objects[object_index].id, 'planet_coord_index': data.planet_coord_index };
            } else if(data.ship_coord_index) {
                add_ai_data = { 'object_id': dirty.objects[object_index].id, 'ship_coord_index': data.ship_coord_index };
            }

            await game.placeAI(socket, dirty, add_ai_data);
        }
        // HOLE
        else if(dirty.object_types[object_type_index].is_hole) {


            console.log("Player is placing a hole");


            if(dirty.object_types[object_type_index].id === 62) {
                log(chalk.red("Can't place the default un-attackable hole"));
                return false;
            }

            // No need for all these checks - it's part of the system! Just add it
            if(data.reason && data.reason === "generate_ship") {

                await main.updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
                return true;
            }

            // Also needs to be level 0 or higher
            if(typeof data.planet_coord_index !== "undefined" && dirty.planet_coords[data.planet_coord_index].level < 1) {
                console.log("Can't place hole on level < 1");
                return false;
            }



            // We need to see if the coord below can accept stairs (we can create it if needed)

            let below_level = dirty.planet_coords[data.planet_coord_index].level - 1;

            let below_data = { 'planet_id': dirty.planet_coords[data.planet_coord_index].planet_id, 'planet_level': below_level,
                'tile_x': dirty.planet_coords[data.planet_coord_index].tile_x,
                'tile_y': dirty.planet_coords[data.planet_coord_index].tile_y };

            // If the below level is still > 0, we can try inserting the coord
            if(below_level > 0) {
                below_data.can_insert = true;
            }

            let below_coord_index = await main.getPlanetCoordIndex(below_data);

            if(below_coord_index === -1) {
                console.log("Couldn't get coord below...");
                return false;
            }

            let already_have_stairs = false;
            // See if there are already stairs below, or if we can make stairs below
            if(dirty.planet_coords[below_coord_index].object_type_id) {
                let below_object_type_index = main.getObjectTypeIndex(dirty.planet_coords[below_coord_index].object_type_id);
                if(below_object_type_index !== -1 && dirty.object_types[below_object_type_index].is_stairs) {
                    already_have_stairs = true;
                }
            }

            // see if we can place an object on that below coord
            if(!already_have_stairs && !await canPlace(dirty, 'planet', dirty.planet_coords[below_coord_index],
                { 'object_type_id': dirty.objects[object_index].object_type_id })) {
                console.log("Something is blocking us from placing the stairs below");
                return false;
            }

            // Looks good. Add the hole
            await main.updateCoordGeneric(socket, { 'planet_coord_index': data.planet_coord_index, 'object_index': object_index });


            // Create and add the stairs
            if(!already_have_stairs) {
                let inserting_object_type_data = {
                    'object_type_id': dirty.object_types[object_type_index].linked_object_type_id };

                // We also want the new stairs to have the same player or npc as the hole does
                if(dirty.objects[object_index].player_id) {
                    inserting_object_type_data.player_id = dirty.objects[object_index].player_id;
                } else if(dirty.objects[object_index].npc_id) {
                    inserting_object_type_data.npc_id = dirty.objects[object_index].npc_id;
                }

                let new_object_id = await world.insertObjectType(socket, dirty, inserting_object_type_data);
                let new_object_index = await getIndex(dirty, new_object_id);
                await main.updateCoordGeneric(socket, { 'planet_coord_index': below_coord_index, 'object_index': new_object_index });
            }




        }
        // STAIRS
        else if(dirty.object_types[object_type_index].is_stairs) {


            console.log("Player is placing stairs");


            if(dirty.object_types[object_type_index].id === 63) {
                log(chalk.red("Can't place the default un-attackable stairs"));
                return false;
            }

            // No need for all these checks - it's part of the system! Just add it
            if(data.reason && data.reason === "generate_ship") {

                await main.updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
                return true;
            } else if(typeof data.ship_coord_index !== "undefined") {

                socket.emit('result_info', { 'status': 'failure', 'text': "Can't place stairs on ships"});
                return false;
            }

            // Also needs to be level 0 or higher
            if(dirty.planet_coords[data.planet_coord_index].level < 0) {
                console.log("Can't place stairs on levels < 0");
                socket.emit('result_info', { 'status': 'failure', 'text': "Can't place stairs underground"});
                return false;
            }



            // We need to see if the coord above
            let above_level = dirty.planet_coords[data.planet_coord_index].level + 1;
            let above_data = { 'planet_id': dirty.planet_coords[data.planet_coord_index].planet_id, 'planet_level': above_level,
                'tile_x': dirty.planet_coords[data.planet_coord_index].tile_x,
                'tile_y': dirty.planet_coords[data.planet_coord_index].tile_y };

            if(above_level > 0) {
                above_data.can_insert = true;
            }

            let above_coord_index = await main.getPlanetCoordIndex(above_data);

            if(above_coord_index === -1) {
                console.log("Couldn't get coord above...");
                return false;
            }

            // See if there's already a hole there, or we are able to make one
            let already_have_hole = false;

            if(dirty.planet_coords[above_coord_index].object_type_id) {
                let above_object_type_index = main.getObjectTypeIndex(dirty.planet_coords[above_coord_index].object_type_id);
                if(above_object_type_index !== -1 && dirty.object_types[above_object_type_index].is_hole) {
                    already_have_hole = true;
                }
            }

            let can_place_stairs_result = await canPlace(dirty, 'planet', dirty.planet_coords[above_coord_index],
            { 'object_type_id': dirty.object_types[object_type_index].linked_object_type_id, 'show_output': true });



            // Looks like we are all good. Add the stairs
            await main.updateCoordGeneric(socket, { 'planet_coord_index': data.planet_coord_index, 'object_index': object_index });

            // Create and add the hole
            let inserting_object_type_data = {
                'object_type_id': dirty.object_types[object_type_index].linked_object_type_id };

            if(dirty.objects[object_index].player_id) {
                inserting_object_type_data.player_id = dirty.objects[object_index].player_id;
            } else if(dirty.objects[object_index].npc_id) {
                inserting_object_type_data.npc_id = dirty.objects[object_index].npc_id;
            }

            let new_object_id = await world.insertObjectType(socket, dirty, inserting_object_type_data);
            let new_object_index = await getIndex(dirty, new_object_id);
            await main.updateCoordGeneric(socket, { 'planet_coord_index': above_coord_index, 'object_index': new_object_index });



        }
        // ELEVATOR
        // It's actually all pretty standard with an elevator - we just need to make sure we mess with the elevator linkers afterwards
        else if(dirty.object_types[object_type_index].id === 269) {


            if(data.planet_coord_index) {
                await main.updateCoordGeneric(socket, { 'planet_coord_index': data.planet_coord_index, 'object_index': object_index });
                dirty.objects[object_index].planet_id = dirty.planet_coords[data.planet_coord_index].planet_id;
                dirty.objects[object_index].has_change = true;
            } else if(data.ship_coord_index) {

                await main.updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
                dirty.objects[object_index].ship_id = dirty.ship_coords[data.ship_coord_index].ship_id;
                dirty.objects[object_index].has_change = true;
            }

            await world.manageElevatorLinkers(socket, dirty, dirty.objects[object_index].id);
        }
        // Default case - we can just update the coord
        else {


            // see if the object type has display linkers that aren't only visual (takes up space)
            let display_linkers = dirty.object_type_display_linkers.filter(linker =>
                linker.object_type_id === dirty.object_types[object_type_index].id && !linker.only_visual);

            // This object will take up multiple tiles of space
            if(display_linkers.length > 0) {

                let origin_coord;
                if(typeof data.coord_index !== 'undefined') {
                    origin_coord = dirty.coords[data.coord_index];
                } else if(typeof data.planet_coord_index !== 'undefined') {
                    origin_coord = dirty.planet_coords[data.planet_coord_index];
                } else if(typeof data.ship_coord_index !== 'undefined') {
                    origin_coord = dirty.ship_coords[data.ship_coord_index];
                }

                display_linkers.forEach(await async function(linker) {

                    // get the coord that the display linker is about
                    let tile_x = origin_coord.tile_x + linker.position_x;
                    let tile_y = origin_coord.tile_y + linker.position_y;

                    let placing_coord_index = -1;
                    if(typeof data.coord_index !== 'undefined') {
                        placing_coord_index = await main.getCoordIndex({ 'tile_x': tile_x, 'tile_y': tile_y });
                    } else if(typeof data.planet_coord_index !== 'undefined') {
                        placing_coord_index = await main.getPlanetCoordIndex({ 'planet_id': origin_coord.planet_id,
                            'planet_level': origin_coord.level, 'tile_x': tile_x, 'tile_y': tile_y });
                    } else if(typeof data.ship_coord_index !== 'undefined') {
                        placing_coord_index = await main.getShipCoordIndex({ 'ship_id': origin_coord.ship_id,
                            'level': origin_coord.level,
                            'tile_x': tile_x, 'tile_y': tile_y });
                    }

                    if(placing_coord_index !== -1) {
                        let update_data = {};

                        if(typeof data.coord_index !== 'undefined') {
                            update_data.coord_index = placing_coord_index;
                        } else if(typeof data.planet_coord_index !== 'undefined') {
                            update_data.planet_coord_index = placing_coord_index;
                        } else if(typeof data.ship_coord_index !== 'undefined') {
                            update_data.ship_coord_index = placing_coord_index;
                        }

                        if(tile_x === origin_coord.tile_x && tile_y === origin_coord.tile_y) {
                            update_data.object_index = object_index;
                        } else {
                            update_data.belongs_to_object_id = dirty.objects[object_index].id;
                        }

                        await main.updateCoordGeneric(socket, update_data);

                    }

                });

            } else {
                // simple way!

                if(typeof data.coord_index !== 'undefined') {
                    await main.updateCoordGeneric(socket, { 'coord_index': data.coord_index, 'object_index': object_index });

                } else if(typeof data.planet_coord_index !== 'undefined') {
                    await main.updateCoordGeneric(socket, { 'planet_coord_index': data.planet_coord_index, 'object_index': object_index });
                    dirty.objects[object_index].planet_id = dirty.planet_coords[data.planet_coord_index].planet_id;
                    dirty.objects[object_index].has_change = true;
                } else if(typeof data.ship_coord_index !== 'undefined') {

                    await main.updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
                    dirty.objects[object_index].ship_id = dirty.ship_coords[data.ship_coord_index].ship_id;
                    dirty.objects[object_index].has_change = true;
                }
            }



        }

        return true;

    } catch(error) {
        log(chalk.red("Error in game_object.place: " + error));
        console.error(error);
    }

}

exports.place = place;



async function removeFromCoord(dirty, object_index) {

    try {

        console.log("In game_object.removeFromCoord");
        console.time("removeFromCoord");

        let has_display_linkers = false;
        let display_linkers = [];

        for(let i = 0; i < dirty.object_type_display_linkers.length; i++) {
            if(dirty.object_type_display_linkers[i] && dirty.object_type_display_linkers[i].object_type_id === dirty.objects[object_index].object_type_id) {

                has_display_linkers = true;
                display_linkers.push(dirty.object_type_display_linkers[i]);
            }
        }

        if(!has_display_linkers) {
            console.log("No display linkers. Simple remove");
            if(dirty.objects[object_index].coord_id) {
                let object_coord_index = await main.getCoordIndex({'coord_id': dirty.objects[object_index].coord_id});
                if(object_coord_index !== -1) {
                    main.updateCoordGeneric(false, { 'coord_index': object_coord_index, 'object_id': false });

                    dirty.objects[object_index].coord_id = false;
                    dirty.objects[object_index].has_change = true;
                }

                
                
            } else if(dirty.objects[object_index].ship_coord_id) {
                let object_coord_index = await main.getShipCoordIndex({'ship_coord_id': dirty.objects[object_index].ship_coord_id});
                if(object_coord_index !== -1) {
                    main.updateCoordGeneric(false, { 'ship_coord_index': object_coord_index, 'object_id': false });

                    dirty.objects[object_index].ship_coord_id = false;
                    dirty.objects[object_index].has_change = true;
                }
            } else if(dirty.objects[object_index].planet_coord_id) {
                let object_coord_index = await main.getPlanetCoordIndex({'planet_coord_id': dirty.objects[object_index].planet_coord_id});
                if(object_coord_index !== -1) {
                    main.updateCoordGeneric(false, { 'planet_coord_index': object_coord_index, 'object_id': false });

                    dirty.objects[object_index].planet_coord_id = false;
                    dirty.objects[object_index].has_change = true;
                }
            }
            
        } else {
            console.log("Has display linkers. Removing from all");

            let origin_tile_x = -1;
            let origin_tile_y = -1;
            let origin_coord_index = -1;
            let scope = '';

            if(dirty.objects[object_index].coord_id) {
                origin_coord_index  = await main.getCoordIndex({ 'coord_id': dirty.objects[object_index].coord_id });

                if(origin_coord_index === -1) {
                    log(chalk.yellow("Could not find origin galaxy coord for the object"));
                    return false;
                }

                origin_tile_x = dirty.coords[origin_coord_index].tile_x;
                origin_tile_y = dirty.coords[origin_coord_index].tile_y;
                scope = 'galaxy';
            } else if(dirty.objects[object_index].ship_coord_id) {
                origin_coord_index  = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[object_index].ship_coord_id });

                if(origin_coord_index === -1) {
                    log(chalk.yellow("Could not find origin ship coord for the object"));
                    return false;
                }

                origin_tile_x = dirty.ship_coords[origin_coord_index].tile_x;
                origin_tile_y = dirty.ship_coords[origin_coord_index].tile_y;
                scope = 'ship';
            } else if(dirty.objects[object_index].planet_coord_id) {
                origin_coord_index  = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.objects[object_index].planet_coord_id });

                if(origin_coord_index === -1) {
                    log(chalk.yellow("Could not find origin planet coord for the object"));
                    return false;
                }

                origin_tile_x = dirty.planet_coords[origin_coord_index].tile_x;
                origin_tile_y = dirty.planet_coords[origin_coord_index].tile_y;
                scope = 'planet';
            }

            for(let i = 0; i < display_linkers.length; i++) {

                let linker_tile_x = display_linkers[i].position_x + origin_tile_x;
                let linker_tile_y = display_linkers[i].position_y + origin_tile_y;

                let update_data = {};
                update_data.object_id = false;
                update_data.belongs_to_object_id = false;
                let valid_update = true;

                if(scope === 'galaxy') {
                    let update_coord_index = await main.getCoordIndex({ 'tile_x': linker_tile_x, 'tile_y': linker_tile_y });
                    if(update_coord_index !== -1) {
                        update_data.coord_index = update_coord_index;
                    } else {
                        valid_update = false;
                    }
                    
                } else if(scope === 'ship') {
                    let update_coord_index = await main.getShipCoordIndex({ 'ship_id': dirty.ship_coords[origin_coord_index].ship_id, 
                    'level': dirty.ship_coords[origin_coord_index].level, 'tile_x': linker_tile_x, 'tile_y': linker_tile_y });
                    if(update_coord_index !== -1) {
                        update_data.ship_coord_index = update_coord_index;
                    } else {
                        valid_update = false;
                    }
                    
                } else if(scope === 'planet') {
                    let update_coord_index = await main.getPlanetCoordIndex({ 'planet_id': dirty.planet_coords[origin_coord_index].planet_id, 
                    'planet_level': dirty.planet_coords[origin_coord_index].level, 'tile_x': linker_tile_x, 'tile_y': linker_tile_y });

                    if(update_coord_index !== -1) {
                        update_data.planet_coord_index = update_coord_index;
                    } else {
                        valid_update = false;
                    }
                }

                if(valid_update) {
                    await main.updateCoordGeneric(false, update_data);
                }


            }

            if(scope === 'galaxy') {
                dirty.objects[object_index].coord_id = false;
                dirty.objects[object_index].has_change = true;
            } else if(scope === 'ship') {
                dirty.objects[object_index].ship_coord_id = false;
                dirty.objects[object_index].has_change = true;
            } else if(scope === 'planet') {
                dirty.objects[object_index].planet_coord_id = false;
                dirty.objects[object_index].has_change = true;
            }

        }

        console.timeEnd("removeFromCoord");

    } catch(error) {
        log(chalk.red("Error in game_object.removeFromCoord: " + error));
        console.error(error);
    }

}

exports.removeFromCoord = removeFromCoord;

async function sendInfo(socket, room, dirty, object_index, source = '') {

    try {


        if(typeof object_index === "undefined" || object_index === -1) {
            log(chalk.yellow("Invalid object_index sent into game_object.sendInfo: " + object_index));
            console.trace("INVALID!");
            return false;
        }

        if(!dirty.objects[object_index]) {
            log(chalk.yellow("Did not find object in dirty. source: " + source));

            console.trace("Lets find you");
            return false;
        }

        let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);


        if(helper.notFalse(socket)) {
            socket.emit('object_info', { 'object': dirty.objects[object_index] });
        }

        if(room !== false) {
            io.to(room).emit('object_info', { 'object': dirty.objects[object_index] });
        }


        // Send the object's inventory
        if(dirty.objects[object_index].has_inventory) {
            //console.log("object id: " + dirty.objects[object_index].id + " has inventory. Sending it");

            dirty.inventory_items.forEach(function(inventory_item, i) {
                //console.log("Checking inventory item id: " + inventory_item.id + " (owned_by_object_id: " + inventory_item.owned_by_object_id +
                //    " against object id: " + dirty.objects[object_index].id);
                if(inventory_item.owned_by_object_id === dirty.objects[object_index].id) {
                    //log(chalk.cyan("Found an inventory item. ID: " + inventory_item.id));
                    if(helper.notFalse(socket)) {
                        //log(chalk.cyan("Sending inventory item id: " + dirty.inventory_items[i].id + " to socket"));
                        socket.emit('inventory_item_info', { 'inventory_item': dirty.inventory_items[i] });
                    } else if(room !== false) {
                        //log(chalk.cyan("Sending inventory item id: " + dirty.inventory_items[i].id + " to room"));
                        io.to(room).emit('inventory_item_info', { 'inventory_item': dirty.inventory_items[i] });
                    }
                }
            });

        }

        // If the object type could have rules
        if(dirty.object_types[object_type_index].can_have_rules) {


            for(let i = 0; i < dirty.rules.length; i++) {
                if(dirty.rules[i] && dirty.rules[i].object_id === dirty.objects[object_index].id) {
                    if(helper.notFalse(socket)) {
                        socket.emit('rule_info', { 'rule': dirty.rules[i] });
                    }

                    if(room !== false) {
                        io.to(room).emit('rule_info', { 'rule': dirty.rules[i] });
                    }
                }
            }

        }

        // If it's an AI, and it's on a ship or a planet, we should let the client know the basic info about that planet/ship
        if(dirty.object_types[object_type_index].object_type_id === 72) {
            if(dirty.objects[object_index].planet_coord_id) {

                await planet.sendInfo(socket, false, dirty, { 'planet_id': dirty.objects[object_index].planet_id });
            } else if(dirty.objects[object_index].ship_coord_id) {
                await sendInfo(socket, false, dirty, { 'object_id': dirty.objects[object_index].ship_coord_id });
            }
        }


    } catch(error) {
        log(chalk.red("Error in game_object.sendInfo: " + error + " source: " + source));
        console.error(error);
    }

}

exports.sendInfo = sendInfo;

async function spawn(dirty, object_index, debug_object_type_id = 0) {

    try {

        //console.log("In game.spawn");
        let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);

        // Grab a random spawn linkerc
        let rarity = helper.rarityRoll();
        let hp_percent = dirty.objects[object_index].current_hp / dirty.object_types[object_type_index].hp * 100;

        // Some object types aren't going to have proper HP values
        if(isNaN(hp_percent)) {
            hp_percent = 100;
        }

        if(dirty.objects[object_index].object_type_id === debug_object_type_id) {
            console.log("Rarity roll: " + rarity + " HP percent: " + hp_percent);
        }

        let object_type_spawn_linkers = dirty.spawn_linkers.filter(linker => linker.object_type_id === dirty.objects[object_index].object_type_id &&
            linker.rarity <= rarity && hp_percent >= linker.minimum_hp_percent && hp_percent <= linker.maximum_hp_percent);

        if(dirty.objects[object_index].object_type_id === debug_object_type_id) {
            console.log("object_type_spawn_linkers length: " + object_type_spawn_linkers.length);
        }


        if(object_type_spawn_linkers.length > 0) {

            let chosen_linker = object_type_spawn_linkers[Math.floor(Math.random()*object_type_spawn_linkers.length)];

            if(dirty.objects[object_index].object_type_id === debug_object_type_id) {
                console.log("Chose spawn linker id: " + chosen_linker.id);
            }

            let met_requirements = true;

            // If the chosen linker requires a floor type, do that check now
            if(chosen_linker.requires_floor_type_class && chosen_linker.requires_floor_type_class !== 0) {
                met_requirements = false;
                let object_info = await getCoordAndRoom(dirty, i);
                if(object_info.coord) {
                    let coord_floor_type_index = main.getFloorTypeIndex(object_info.coord.floor_type_id);

                    if(coord_floor_type_index !== -1 && dirty.floor_types[coord_floor_type_index].class === chosen_linker.requires_floor_type_class) {
                        met_requirements = true;
                    }
                }

            }

            if(met_requirements) {
                if(chosen_linker.ticks_required > 1) {
                    dirty.objects[object_index].current_spawn_linker_id = chosen_linker.id;
                    dirty.objects[object_index].spawner_tick_count = 1;
                    dirty.objects[object_index].has_change = true;
                }
                // We finish it
                else {
                    // Gotta get the real spawn linker back
                    let spawn_linker_index = dirty.spawn_linkers.findIndex(function(obj) { return obj && obj.id === chosen_linker.id; });
                    await game.finishSpawnLinker(dirty, { 'object_index': object_index, 'spawn_linker_index': spawn_linker_index });

                }
            }




        } else {
            if(dirty.objects[object_index].object_type_id === debug_object_type_id) {
                console.log("Did not find any spawn linkers that matched this object");
            }
        }
    } catch(error) {
        log(chalk.red("Error in game.spawn: " + error));
        console.error(error);
    }

}

exports.spawn = spawn;



async function updateType(dirty, object_type_id) {
    try {

        console.log("In game_object.updateType. Updating object type id: " + object_type_id);

        let object_type_index = main.getObjectTypeIndex(object_type_id);

        if(object_type_index === -1) {
            log(chalk.yellow("Couldn't find object type id: " + object_type_id));
            return false;

        }

        if(dirty.object_types[object_type_index].id !== 351) {
            log(chalk.yellow("Object Type was not The Great Nomad: " + object_type_id));
            return false;
        }


        for(let s = 0; s < dirty.objects.length; s++) {

            if(dirty.objects[s]) {

                
                if(dirty.objects[s].object_type_id === dirty.object_types[object_type_index].id) {
                    console.log("Ship id: " + dirty.objects[s].id + " is the ship type we are updating");
    
                    // I suppose at this point we can just go through the ship linkers
                    for(let i = 0; i < dirty.ship_linkers.length; i++) {
                        if(dirty.ship_linkers[i] && dirty.ship_linkers[i].ship_type_id === dirty.object_types[object_type_index].id) {
                            
                            // get the ship coord that would match this ship linker
                            let ship_coord_index = await main.getShipCoordIndex({ 'ship_id': dirty.objects[s].id, 'level': dirty.ship_linkers[i].level,
                            'tile_x': dirty.ship_linkers[i].position_x, 'tile_y': dirty.ship_linkers[i].position_y });
    
                            if(ship_coord_index === -1) {
                                console.log("Would need to create a new coord for ship at tile_x,y: " + dirty.ship_linkers[i].position_x + "," + dirty.ship_linkers[i].position_y);
    
                                await world.createShipCoord(dirty, s, dirty.ship_linkers[i]);
                            } else {
                                console.log("See if we need to update tile_x,y: " + dirty.ship_linkers[i].position_x + "," + dirty.ship_linkers[i].position_y);
    
                                // object_type_id
                                if(helper.notFalse(dirty.ship_linkers[i].object_type_id) && dirty.ship_coords[ship_coord_index].object_type_id !== dirty.ship_linkers[i].object_type_id) {
                                    console.log("Need to update object type id");
                                }
                                
    
                                // floor_type_id
                                if(helper.notFalse(dirty.ship_linkers[i].floor_type_id) && dirty.ship_coords[ship_coord_index].floor_type_id !== dirty.ship_linkers[i].floor_type_id) {
                                    console.log("Need to update floor type id");
                                }
    
                                // spawns_monster_type_id
                                if(helper.notFalse(dirty.ship_linkers[i].spawns_monster_type_id) && dirty.ship_coords[ship_coord_index].spawns_monster_type_id !== dirty.ship_linkers[i].spawns_monster_type_id) {
                                    console.log("Need to update spawns_monster_type_id");
                                }
    
                                // is_weapon_hardpoint
                                if(helper.notFalse(dirty.ship_linkers[i].is_weapon_hardpoint) && dirty.ship_coords[ship_coord_index].is_weapon_hardpoint !== dirty.ship_linkers[i].is_weapon_hardpoint) {
                                    console.log("Need to update is_weapon_hardpoint");
                                }
    
    
                                // is_engine_hardpoint
                                if(helper.notFalse(dirty.ship_linkers[i].is_engine_hardpoint) && dirty.ship_coords[ship_coord_index].is_engine_hardpoint !== dirty.ship_linkers[i].is_engine_hardpoint) {
                                    console.log("Need to update is_engine_hardpoint");
                                }
    
                            }
                        }
                    }
    
                }
            }

            

        }


    

    } catch(error) {
        log(chalk.red("Error in game_object.updateType: " + error));
        console.error(error);
    }
}

exports.updateType = updateType;


module.exports = {
    calculateDefense,
    canPlace,
    damage,
    deleteObject,
    getCoordAndRoom,
    getIndex,
    place,
    removeFromCoord,
    sendInfo,
    spawn,
    updateType
}

