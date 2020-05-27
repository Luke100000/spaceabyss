var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const { Worker, isMainThread, parentPort } = require('worker_threads');
const chalk = require('chalk');
const log = console.log;

//const game = require('./game.js');
const game_object = require('./game_object.js');
const helper = require('./helper.js');
const monster = require('./monster.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const planet = require('./planet.js');
const world = require('./world.js');



async function deleteSpawnedEvent(dirty, spawned_event_index) {

    try {

        if(!dirty.spawned_events[spawned_event_index]) {
            log(chalk.yellow("Trying to delete a spawned event that we can't find!"));
            return false;
        }


        //console.log("Despawning spawned event id: " + dirty.spawned_events[spawned_event_index].id);

        // Remove spawned objects - We skip the check spawned event check because... WE ARE ALREADY DELETING THE SPAWNED EVENT!
        for(let i = 0; i < dirty.objects.length; i++) {
            if(dirty.objects[i] && dirty.objects[i].spawned_event_id === dirty.spawned_events[spawned_event_index].id) {
                await game_object.deleteObject(dirty, { 'object_index': i, 'reason': 'Deleting Spawned Event', 'skip_check_spawned_event': true });

            }
        }

        // Remove spawned monsters - We skip the check spawned event check because... WE ARE ALREADY DELETING THE SPAWNED EVENT!
        for(let i = 0; i < dirty.monsters.length; i++) {
            if(dirty.monsters[i] && dirty.monsters[i].spawned_event_id === dirty.spawned_events[spawned_event_index].id) {
                await monster.deleteMonster(dirty, { 'monster_index': i, 'reason': 'Deleting Spawned Event', 'skip_check_spawned_event': true });
            }
        }



        // Event linkers can drop things when they despawn.
        // Events can 'give' object types when they despawn. Lets see if that is going to happen

        // Various event linkers are going to have drops, get our base tile_x, tile_y
        let origin_tile_x = 0;
        let origin_tile_y = 0;
        let origin_coord_index = -1;

        if(dirty.spawned_events[spawned_event_index].origin_planet_coord_id) {
            origin_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.spawned_events[spawned_event_index].origin_planet_coord_id });
            if(origin_coord_index !== -1) {
                origin_tile_x = dirty.planet_coords[origin_coord_index].tile_x;
                origin_tile_y = dirty.planet_coords[origin_coord_index].tile_y;
            }
        } else if(dirty.spawned_events[spawned_event_index].origin_ship_coord_id) {
            origin_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.spawned_events[spawned_event_index].origin_ship_coord_id });
            if(origin_coord_index !== -1) {
                origin_tile_x = dirty.ship_coords[origin_coord_index].tile_x;
                origin_tile_y = dirty.ship_coords[origin_coord_index].tile_y;
            }
        } else if(dirty.spawned_events[spawned_event_index].origin_coord_id) {
            let origin_coord_index = await main.getCoordIndex({ 'coord_id': dirty.spawned_events[spawned_event_index].origin_coord_id });
            if(origin_coord_index !== -1) {
                origin_tile_x = dirty.coords[origin_coord_index].tile_x;
                origin_tile_y = dirty.coords[origin_coord_index].tile_y;
            }
        }


        // WE PERFORM THE CONVERSION
        // In the old looping through event_linkers - we had the below in it. Conversions. and I DON'T KNOW WHY.
        //convert(false, dirty, { 'converter_object_id': dirty.planet_coords[linker_planet_coord_index].object_id,
        //    'input_type': 'object_type', 'input_object_type_id': dirty.event_linkers[e].gives_object_type_id,
        //    'input_paid': true });

        for(let e = 0; e < dirty.event_linkers[e].length; e++) {

            // We'll only be interested in event linkers associated with the event type - and for now, just the same level.
            if(dirty.event_linkers[e] && dirty.event_linkers[e].event_id === dirty.spawned_events[spawned_event_index].event_id &&
                dirty.event_linkers[e].level === 0) {



                // TODO NOW I need to factor in the rarity here and with monster drops. Find a place I'm already doing it.
                // I really guess I just gotta check all the stupid drop linkers
                let drop_linkers = dirty.drop_linkers.filter(drop_linker => drop_linker.event_linker_id === dirty.event_linkers[e].id);
                if(drop_linkers.length > 0) {

                    let event_linker_tile_x = origin_tile_x + dirty.event_linkers[e].position_x;
                    let event_linker_tile_y = origin_tile_y + dirty.event_linkers[e].position_y;


                    // get a random drop linker - and it will drop that
                    let drop_linker = drop_linkers[Math.floor(Math.random() * drop_linkers.length)];
                    //console.log("Going to drop object_type_id: " + drop_linker.dropped_object_type_id);

                    if(dirty.spawned_events[spawned_event_index].origin_planet_coord_id) {

                        let event_linker_coord_index = await main.getPlanetCoordIndex({ 'planet_id': dirty.planet_coords[origin_coord_index].planet_id,
                            'planet_level': dirty.planet_coords[origin_coord_index].level, 'tile_x': event_linker_tile_x, 'tile_y': event_linker_tile_y });

                        if(drop_linker.dropped_object_type_id) {
                            if(await game_object.canPlace(dirty, 'planet',dirty.planet_coords[event_linker_coord_index],
                                { 'object_type_id': drop_linker.dropped_object_type_id })) {

                                //console.log("Monster is dropping amount: " + drop_linker.amount + " of object_type_id: " + drop_linker.dropped_object_type_id);
                                await main.updateCoordGeneric(false, { 'planet_coord_index': event_linker_coord_index, 'object_type_id': drop_linker.dropped_object_type_id,
                                    'amount': drop_linker.amount });
                            }
                        }



                    } else if(dirty.spawned_events[spawned_event_index].origin_ship_coord_id) {

                        let event_linker_coord_index = await main.getShipCoordIndex({ 'ship_id': dirty.ship_coords[origin_coord_index].ship_id,
                            'level': dirty.ship_coords[origin_coord_index].level, 'tile_x': event_linker_tile_x, 'tile_y': event_linker_tile_y });

                        if(await game_object.canPlace(dirty, 'ship',dirty.ship_coords[event_linker_coord_index],
                            { 'object_type_id': drop_linker.dropped_object_type_id })) {
                            await main.updateCoordGeneric(false, { 'ship_coord_index': event_linker_coord_index, 'object_type_id': drop_linker.dropped_object_type_id,
                                'amount': drop_linker.amount });
                        }

                    } else if(dirty.spawned_events[spawned_event_index].origin_coord_id) {

                        let event_linker_coord_index = await main.geCoordIndex({ 'tile_x': event_linker_tile_x, 'tile_y': event_linker_tile_y });

                        if(await game_object.canPlace(dirty, 'galaxy',dirty.coords[event_linker_coord_index],
                            { 'object_type_id': drop_linker.dropped_object_type_id })) {
                            await main.updateCoordGeneric(false, { 'coord_index': event_linker_coord_index, 'object_type_id': drop_linker.dropped_object_type_id,
                                'amount': drop_linker.amount });
                        }

                    }

                }

            }
        }

        // and finally delete the spawned event
        await (pool.query("DELETE FROM spawned_events WHERE id = ?", [dirty.spawned_events[spawned_event_index].id]));
        delete dirty.spawned_events[spawned_event_index];



    } catch(error) {
        log(chalk.red("Error in event.deleteSpawnedEvent: " + error));
        console.error(error);
    }
}



/**
 *
 * @param {Object} dirty
 * @param {number} event_index
 * @param {Object} data
 * @param {string=} data.scope
 * @returns {Promise<boolean>}
 */
async function spawn(dirty, event_index, data) {

    try {

        

        let debug_event_ids = [64,66];

        let planet_index = -1;
        let planet_event_linker_index = -1;
        let origin_tile_x = -1;
        let origin_tile_y = -1;
        let origin_planet_level = 0;
        let origin_ship_level = 0;
        let origin_planet_coord_id = 0;
        let origin_coord_index = -1;
        let event_scope = '';


        if(event_index === -1 || !dirty.events[event_index]) {
            log(chalk.yellow("Could not find event"));
            return false;
        }

        let event_linkers = dirty.event_linkers.filter(event_linker => event_linker.event_id === dirty.events[event_index].id);
        if(event_linkers.length === 0) {
            log(chalk.yellow("No linkers associated with this event"));
            return false;
        }

        if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
            console.log("In event.spawn for event id: " + dirty.events[event_index].id + " name: " + dirty.events[event_index].name);
        }



        /***** STEP 1: FIND THE ORIGIN X,Y ********/

        if(data.planet_id) {
            planet_index = await planet.getIndex(dirty, { 'planet_id': data.planet_id, 'source': 'event.spawn' });

            if(planet_index === -1) {
                return false;
            }

            // find the planet_event_linker
            planet_event_linker_index = dirty.planet_event_linkers.findIndex(function(obj) {
                return obj && obj.event_id === dirty.events[event_index].id &&
                    obj.planet_type_id === dirty.planets[planet_index].planet_type_id });

            if(planet_event_linker_index === -1) {
                log(chalk.yellow("Could not find planet event linker"));
                return false;
            }

            // Find possible planet coords where this can spawn at
            let possible_planet_coords = [];

            if( helper.notFalse(dirty.events[event_index].requires_floor_type_id) ) {
                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    console.log("Event requires a specific floor type id");
                }

                possible_planet_coords = dirty.planet_coords.filter(
                    planet_coord => planet_coord.planet_id === dirty.planets[planet_index].id &&
                        planet_coord.floor_type_id === dirty.events[event_index].requires_floor_type_id &&
                        planet_coord.level <= dirty.planet_event_linkers[planet_event_linker_index].highest_planet_level &&
                        planet_coord.level >= dirty.planet_event_linkers[planet_event_linker_index].lowest_planet_level
                );


            } else if( helper.notFalse(dirty.events[event_index].requires_floor_type_class) ) {

                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    console.log("Event requires a specific floor type class: " + dirty.events[event_index].requires_floor_type_class);
                }

                // get the floor types that have this class
                let class_floor_type_ids = [];
                for(let i = 0; i < dirty.floor_types.length; i++) {
                    if(dirty.floor_types[i].class === dirty.events[event_index].requires_floor_type_class) {
                        class_floor_type_ids.push(dirty.floor_types[i].id);
                    }
                }

                possible_planet_coords = dirty.planet_coords.filter(
                    planet_coord => planet_coord.planet_id === dirty.planets[planet_index].id &&
                        class_floor_type_ids.includes(planet_coord.floor_type_id) &&
                        planet_coord.level <= dirty.planet_event_linkers[planet_event_linker_index].highest_planet_level &&
                        planet_coord.level >= dirty.planet_event_linkers[planet_event_linker_index].lowest_planet_level
                );

            }

            else {


                possible_planet_coords = dirty.planet_coords.filter(
                    planet_coord => planet_coord.planet_id === dirty.planets[planet_index].id &&
                        planet_coord.level <= dirty.planet_event_linkers[planet_event_linker_index].highest_planet_level &&
                        planet_coord.level >= dirty.planet_event_linkers[planet_event_linker_index].lowest_planet_level
                );


            }



            if(possible_planet_coords.length === 0) {
                log(chalk.yellow("No possible planet coords for planet event " + dirty.events[event_index].name));
                return false;
            }

            let origin_planet_coord = possible_planet_coords[Math.floor(Math.random() * possible_planet_coords.length)];
            origin_planet_coord_id = origin_planet_coord.id;
            origin_tile_x = origin_planet_coord.tile_x;
            origin_tile_y = origin_planet_coord.tile_y;
            origin_planet_level = origin_planet_coord.level;
            event_scope = 'planet';

            if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                console.log("Set origin planet coord id to: " + origin_planet_coord_id);
            }


        } else if(typeof data.planet_coord_index !== "undefined") {

            planet_index = await planet.getIndex(dirty, { 'planet_id': dirty.planet_coords[data.planet_coord_index].planet_id, 'source': 'event.spawn' });
            origin_tile_x = dirty.planet_coords[data.planet_coord_index].tile_x;
            origin_tile_y = dirty.planet_coords[data.planet_coord_index].tile_y;
            origin_planet_level = dirty.planet_coords[data.planet_coord_index].level;
            event_scope = 'planet';

            // find the planet_event_linker
            planet_event_linker_index = dirty.planet_event_linkers.findIndex(function(obj) {
                return obj && obj.event_id === dirty.events[event_index].id &&
                    obj.planet_type_id === dirty.planets[planet_index].planet_type_id });

            if(planet_event_linker_index === -1) {
                log(chalk.yellow("Could not find planet event linker"));
                return false;
            }


        } else if(typeof data.ship_coord_index !== "undefined") {
            origin_tile_x = dirty.ship_coords[data.ship_coord_index].tile_x;
            origin_tile_y = dirty.ship_coords[data.ship_coord_index].tile_y;
            origin_ship_level = dirty.ship_coords[data.ship_coord_index].level;

            event_scope = 'ship';
        } else if(typeof data.coord_index !== "undefined") {
            origin_tile_x = dirty.coords[data.coord_index].tile_x;
            origin_tile_y = dirty.coords[data.coord_index].tile_y;

            event_scope = 'galaxy';
        } else if(data.scope === 'galaxy') {


            origin_tile_x = helper.getRandomIntInclusive(2,98);
            origin_tile_y = helper.getRandomIntInclusive(2,98);

            event_scope = 'galaxy';

            origin_coord_index = await main.getCoordIndex({ 'tile_x': origin_tile_x, 'tile_y': origin_tile_y });


        }

        if(origin_tile_x === -1 || origin_tile_y === -1) {
            log(chalk.yellow("Could not find origin tile"));
            return false;
        }



        // TODO listen to the event's min and max planet level
        // TODO when we do this we need to figure out the lowest level on that particular planet
        // TODO structure_types has a multi level implementation - but it's a little odd since we move the NPC up



        // see if we are going to be able to do this event here

        let can_spawn = true;

        // make sure that we aren't exceeding the limit of the planet
        // Not 100% sure how to do this. For now just check the object or monster at 0,0 and see how many of them
        // we find
        if( event_scope === 'planet' && dirty.planet_event_linkers[planet_event_linker_index].limit_per_planet) {
            if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                console.log("Event " + dirty.events[event_index].name + " has a limit of: " +
                    dirty.planet_event_linkers[planet_event_linker_index].limit_per_planet + " on planet type id: " +
                    dirty.planets[planet_index].planet_type_id);
            }


            // see how many events with this id the planet has
            let currently_spawned = dirty.spawned_events.filter(spawned_event => spawned_event.event_id === dirty.events[event_index].id &&
                spawned_event.planet_id === dirty.planets[planet_index].id);

            if(currently_spawned.length >= dirty.planet_event_linkers[planet_event_linker_index].limit_per_planet) {
                can_spawn = false;
                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    log(chalk.yellow("Can't spawn. Planet is at limit. Found " + currently_spawned.length + " existing events of this type"));
                }

                return false;
            }

            //console.log("Found " + currently_spawned.length + " of that event already on the planet");

        } else if(event_scope === 'galaxy' && helper.notFalse(dirty.events[event_index].galaxy_limit)) {

            let spawned_in_galaxy_count = 0;
            for(let s = 0; s < dirty.spawned_events.length; s++) {

                if(dirty.spawned_events[s] && dirty.spawned_events[s].event_id === dirty.events[event_index].id) {
                    spawned_in_galaxy_count++;
                }

            }

            if(spawned_in_galaxy_count >= dirty.events[event_index].galaxy_limit) {
                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    log(chalk.yellow("Can't spawn. Galaxy is at limit. Found " + spawned_in_galaxy_count + " existing events of this type"));
                }

                return false;
            }

        }



        for(let event_linker of event_linkers) {
            let tile_x = origin_tile_x + event_linker.position_x;
            let tile_y = origin_tile_y + event_linker.position_y;
            let tile_level = 0;
            if(event_scope === 'planet') {
                tile_level = origin_planet_level + event_linker.level;
            } else if(event_scope === 'ship') {
                tile_level = origin_ship_level + event_linker.level;
            }


            // If the event linker has a object, make sure we can place an object there

            let checking_coord_index = -1;
            let checking_coord = false;
            if(event_scope === 'planet') {
                let planet_coord_data = { 'planet_id': dirty.planets[planet_index].id,
                    'planet_level': tile_level, 'tile_x': tile_x, 'tile_y': tile_y };

                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    console.log("Data going into getPlanetCoordIndex:");
                    console.log(planet_coord_data);
                }

                checking_coord_index = await main.getPlanetCoordIndex(planet_coord_data);

                if(checking_coord_index === -1) {
                    log(chalk.yellow("Could not find the coord we are checking"));
                    return false;
                }
            } else if(event_scope === 'ship') {

                checking_coord_index = await main.getShipCoordIndex({
                    'ship_id': dirty.ship_coords[data.ship_coord_index].ship_id,
                    'level': tile_level, 'tile_x': tile_x, 'tile_y': tile_y
                });
            } else if(event_scope === 'galaxy') {
                checking_coord_index = await main.getCoordIndex({ 'tile_x': tile_x, 'tile_y': tile_y });
            }

            if(checking_coord_index === -1) {
                can_spawn = false;

                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    log(chalk.yellow("Was unable to find the coord to check. tile_x,tile_y: " + tile_x + "," + tile_y));
                }

                return false;

            }


            if(event_scope === 'planet') {
                checking_coord = dirty.planet_coords[checking_coord_index];
            } else if(event_scope === 'ship') {
                checking_coord = dirty.ship_coords[checking_coord_index];
            } else if(event_scope === 'galaxy') {
                checking_coord = dirty.coords[checking_coord_index];
            }


            let can_place_object_result = false;
            if(event_linker.object_type_id) {

                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    log(chalk.yellow("Going to check to see if we can place an object on a coord with floor_type_id: " + checking_coord.floor_type_id));
                }

                can_place_object_result = await game_object.canPlace(dirty, event_scope, checking_coord,
                    { 'object_type_id': event_linker.object_type_id });
            }


            if(event_linker.object_type_id && can_place_object_result === false) {
                can_spawn = false;
                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1 && event_scope === 'planet') {
                    log(chalk.yellow("Couldn't put an object type on coord at " +
                        dirty.planet_coords[checking_coord_index].tile_x + "," + dirty.planet_coords[checking_coord_index].tile_y))
                }

            } else {


                if(event_linker.object_type_id && debug_event_ids.indexOf(dirty.events[event_index].id) !== -1 ) {
                    console.log("Looks like we can place there. can_place_object_result: " + can_place_object_result);
                }

                if(event_linker.object_type_id && checking_coord.floor_type_id === 26) {
                    log(chalk.red("game_object.canPlace should NOT have returned true on this coord"));
                    can_spawn = false;
                }

            }



            let can_place_floor_result = false;
            if(event_linker.floor_type_id) {

                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    console.log("Event linker has a floor_type_id");
                }

                can_place_floor_result = await main.canPlaceFloor({ 'scope': event_scope, 'coord': checking_coord,
                    'floor_type_id': event_linker.floor_type_id });

            } else if(event_linker.floor_type_class) {

                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    console.log("Event linker has a floor_type_class");
                }

                can_place_floor_result = await main.canPlaceFloor({ 'scope': event_scope, 'coord': checking_coord,
                    'floor_type_class': event_linker.floor_type_class });

            }

            if(event_linker.floor_type_id && can_place_floor_result === false) {
                can_spawn = false;
                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    log(chalk.yellow("Couldn't put floor on coord at " +
                        checking_coord.tile_x + "," + checking_coord.tile_y))
                }


            }

            let can_place_monster_result = false;
            if(event_linker.monster_type_id) {
                can_place_monster_result = await main.canPlaceMonster(event_scope,checking_coord,
                    { 'monster_type_id': event_linker.monster_type_id });

            }

            if(event_linker.monster_type_id && can_place_monster_result === false) {
                can_spawn = false;
                if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                    log(chalk.yellow("Couldn't put monster type on coord at " +
                        dirty.planet_coords[checking_coord_index].tile_x + "," + dirty.planet_coords[checking_coord_index].tile_y))
                }
            }

        }


        if(!can_spawn) {
            if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
                log(chalk.yellow("Was unable to spawn the event"));
            }

            return false;
        }


        if(debug_event_ids.indexOf(dirty.events[event_index].id) !== -1) {
            log(chalk.green("Can spawn this event here!"));
        }


        // Lets add an event linker
        let sql = "";
        let inserts = "";
        if(event_scope === 'planet') {
            sql = "INSERT INTO spawned_events(event_id,planet_id,origin_planet_coord_id) VALUES(?,?,?)";
            inserts = [dirty.events[event_index].id, dirty.planets[planet_index].id, origin_planet_coord_id];
        } else if(event_scope === 'ship') {
            sql = "INSERT INTO spawned_events(event_id,ship_id,origin_ship_coord_id) VALUES(?,?,?)";
            inserts = [dirty.events[event_index].id, dirty.ship_coords[data.ship_coord_index].ship_id, dirty.ship_coords[data.ship_coord_index].id];
        } else if(event_scope === 'galaxy') {
            sql = "INSERT INTO spawned_events(event_id,origin_coord_id) VALUES(?,?)";
            inserts = [dirty.events[event_index].id, dirty.coords[origin_coord_index].id];
        }



        let [result] = await (pool.query(sql,inserts));

        let spawned_event_id = result.insertId;
        let spawned_event_index = -1;

        let [rows, fields] = await (pool.query("SELECT * FROM spawned_events WHERE id = ?", [spawned_event_id]));
        if(rows[0]) {
            let spawned_event = rows[0];
            spawned_event.has_change = false;

            spawned_event_index = dirty.spawned_events.push(spawned_event) - 1;

        }

        console.log("Inserted spawned event");

        event_linkers.forEach(await async function(event_linker) {

            try {
                let tile_x = origin_tile_x + event_linker.position_x;
                let tile_y = origin_tile_y + event_linker.position_y;
                let tile_level = 0;
                if(event_scope === 'planet') {
                    tile_level = origin_planet_level + event_linker.level;
                } else if(event_scope === 'ship') {
                    tile_level = origin_ship_level + event_linker.level;
                }

                let linker_coord_index = -1;
                let linker_coord = false;
                if(event_scope === 'planet') {
                    let planet_coord_data = { 'planet_id': dirty.planets[planet_index].id,
                        'planet_level': tile_level, 'tile_x': tile_x, 'tile_y': tile_y };
                    linker_coord_index = await main.getPlanetCoordIndex(planet_coord_data);
                    linker_coord = dirty.planet_coords[linker_coord_index];
                } else if(event_scope === 'ship') {

                    linker_coord_index = await main.getShipCoordIndex({
                        'ship_id': dirty.ship_coords[data.ship_coord_index].ship_id,
                        'level': tile_level, 'tile_x': tile_x, 'tile_y': tile_y
                    });
                    linker_coord = dirty.ship_coords[linker_coord_index];
                } else if(event_scope === 'galaxy') {
                    linker_coord_index = await main.getCoordIndex({ 'tile_x': tile_x, 'tile_y': tile_y });
                    linker_coord = dirty.coords[linker_coord_index];
                }


                if(event_linker.object_type_id) {
                    let insert_object_type_data = { 'object_type_id': event_linker.object_type_id, 'spawned_event_id': spawned_event_id };
                    let new_object_id = await world.insertObjectType(false, dirty, insert_object_type_data);

                    if(new_object_id === false) {
                        log(chalk.yellow("Failed to insert object type in event.spawn"));
                        return false;
                    }

                    let new_object_index = await main.getObjectIndex(new_object_id);

                    if(new_object_index === -1) {
                        log(chalk.yellow("Was unable to get object index from object id: " + new_object_id + " in event.spawn"));
                        return false;
                    }

                    console.log("Created new object id: " + dirty.objects[new_object_index].id +
                        " with spawned_event_id: " + dirty.objects[new_object_index].spawned_event_id);

                    if(event_scope === 'planet') {
                        await main.placeObject(false, dirty, { 'object_index': new_object_index,
                            'planet_coord_index': linker_coord_index });

                        console.log("Object's planet_coord_id: " + dirty.objects[new_object_index].planet_coord_id);
                    } else if(event_scope === 'ship') {
                        await main.placeObject(false, dirty, { 'object_index': new_object_index,
                            'ship_coord_index': linker_coord_index });

                        console.log("Object's ship_coord_id: " + dirty.objects[new_object_index].ship_coord_id);
                    } else if(event_scope === 'galaxy') {
                        await main.placeObject(false, dirty, { 'object_index': new_object_index,
                            'coord_index': linker_coord_index });

                        console.log("Object's coord_id: " + dirty.objects[new_object_index].coord_id);
                    }


                    /*
                    await world.addObjectToPlanetCoord(dirty, new_object_index, checking_coord_index);
                    await game.objectFindTarget(dirty, new_object_index);

                     */
                }

                if( helper.notFalse(event_linker.floor_type_id) ) {
                    if(event_scope === 'planet') {
                        await world.changeFloor(dirty, { 'planet_coord_index': linker_coord_index, 'floor_type_id': event_linker.floor_type_id });
                    } else if(event_scope === 'ship') {
                        await world.changeFloor(dirty, { 'ship_coord_index': linker_coord_index, 'floor_type_id': event_linker.floor_type_id });
                    } else if(event_scope === 'galaxy') {
                        await world.changeFloor(dirty, { 'coord_index': linker_coord_index, 'floor_type_id': event_linker.floor_type_id });
                    }
                } else if( helper.notFalse(event_linker.floor_type_class) ) {

                    console.log("Event linker has a floor type class")


                    if(event_scope === 'planet') {

                        let rarity_roll = helper.rarityRoll();
                        let possible_floor_type_ids = [];

                        for(let f = 0; f < dirty.planet_floor_linkers.length; f++) {

                            // Check to see if this is a linker that applies to our planet and level and rarity roll
                            if(dirty.planet_floor_linkers[f] && dirty.planet_floor_linkers[f].planet_type_id === dirty.planets[planet_index].planet_type_id && 
                                dirty.planet_floor_linkers[f].lowest_planet_level <= dirty.planet_coords[linker_coord_index].level && 
                                dirty.planet_floor_linkers[f].highest_planet_level >= dirty.planet_coords[linker_coord_index].level &&
                                dirty.planet_floor_linkers[f].rarity <= rarity_roll
                                ) {

                                let planet_floor_type_index = main.getFloorTypeIndex(dirty.planet_floor_linkers[f].floor_type_id);
                                if(planet_floor_type_index !== -1 && dirty.floor_types[planet_floor_type_index].class === event_linker.floor_type_class) {
                                    possible_floor_type_ids.push(dirty.floor_types[planet_floor_type_index].id);
                                }



                            }
                        }

                        let chosen_floor_type_id = 0;
                        if(possible_floor_type_ids.length > 1) {
                            chosen_floor_type_id = possible_floor_type_ids[Math.floor(Math.random() * possible_floor_type_ids.length)];
                        } else if(possible_floor_type_ids.length === 1) {
                            chosen_floor_type_id = possible_floor_type_ids[0];
                        } else if(possible_floor_type_ids.length === 0) {
                            log(chalk.yellow("No possible floor types found"));
                        }

                        if(chosen_floor_type_id !== 0) {
                            await world.changeFloor(dirty, { 'planet_coord_index': linker_coord_index, 'floor_type_id': chosen_floor_type_id });
                        }

                    }


                }

                if(event_linker.monster_type_id) {

                    let spawn_monster_data = { 'spawned_event_id': spawned_event_id };
                    if(event_scope === 'planet') {
                        spawn_monster_data.planet_coord_index = linker_coord_index;

                    } else if(event_scope === 'ship') {
                        spawn_monster_data.ship_coord_index = linker_coord_index;

                    } else if(event_scope === 'galaxy') {
                        spawn_monster_data._coord_index = linker_coord_index;
                        log(chalk.red("CODE IT BOY!"));
                    }

                    await world.spawnMonster(dirty, event_linker.monster_type_id, spawn_monster_data);

                }

                // If there's an hp effect, have it hurt non-event things at this spot
                if(event_linker.hp_effect) {
                    console.log("Spawning event has a hp effect at this location");

                    if(linker_coord.object_id) {
                        let object_index = await main.getObjectIndex(linker_coord.object_id);

                        // We found the object here and it's not from our event
                        if(object_index !== -1 && dirty.objects[object_index].spawned_event_id !== spawned_event_id) {
                            let object_info = await game_object.getCoordAndRoom(dirty, object_index);

                            await game_object.damage(dirty, { 'object_index': object_index,
                                'damage_amount': event_linker.hp_effect, 'object_info': object_info, 'reason': 'event' });
                        }
                    }
                    else if(linker_coord.object_type_id) {
                        let object_type_index = dirty.object_types.findIndex(function(obj) {
                            return obj && obj.id === linker_coord.object_type_id; });

                        // We can't store an updated HP amount for a non object object type, so it would just be destroyed
                        if(object_type_index !== -1 && dirty.object_types[object_type_index].can_be_attacked) {

                            if(event_scope === 'planet') {
                                await main.updateCoordGeneric(false, { 'planet_coord_index': linker_coord_index, 'object_type_id': false });
                            } else if(event_scope === 'ship') {
                                await main.updateCoordGeneric(false, { 'ship_coord_index': linker_coord_index, 'object_type_id': false });
                            } else if(event_scope === 'galaxy') {
                                await main.updateCoordGeneric(false, { 'coord_index': linker_coord_index, 'object_type_id': false });
                            }


                        }
                    }


                }
            } catch(error) {
                log(chalk.red("Error in event.spawn - event_linker: " + error));
                console.error(error);
            }



        });


    } catch(error) {
        log(chalk.red("Error in event.spawn: " + error));
        console.error(error);
    }



}

async function tickSpawnedEvents(dirty) {

    try {
        for(let i = 0; i < dirty.spawned_events.length; i++) {
            if(dirty.spawned_events[i]) {
                //console.log("Checking on spawned event id: " + dirty.spawned_events[i].id);

                dirty.spawned_events[i].tick_count++;
                dirty.spawned_events[i].has_change = true;

                let event_index = dirty.events.findIndex(function(obj) { return obj && obj.id === dirty.spawned_events[i].event_id; });



                // See if we despawn the event - Either do it because it's been ticking for FOREVER!!! Or it has a tick_count
                // specified and we are over that
                if(dirty.spawned_events[i].tick_count > 10000 ||
                    (helper.notFalse(dirty.events[event_index].tick_count) && dirty.spawned_events[i].tick_count > dirty.events[event_index].tick_count )) {
                    //console.log("Going to delete spawned event id: " + dirty.spawned_events[i].id);
                    //console.log("Spawned event tick count: " + dirty.spawned_events[i].tick_count + " Event tick count: " + dirty.events[event_index].tick_count);
                    await deleteSpawnedEvent(dirty, i);
                }



                // Now that we've deleted any object or monsters associated with the event, calling this
                // will despawn it
                //await checkSpawnedEvent(dirty, dirty.spawned_events[i].id);
            }

        }

    } catch(error) {
        log(chalk.red("Error in event.tickSpawnedEvents: " + error));
        console.error(error);
    }
}


async function tickSpawning(dirty) {


    try {

        let debug_planet_type_id = 0;


        // Spawn Events On Every Planet!
        for(let i = 0; i < dirty.planets.length; i++) {
            if(dirty.planets[i]) {

                if(dirty.planets[i].planet_type_id === debug_planet_type_id) {
                    log(chalk.cyan("Spawning events for planet id: " + dirty.planet[i].id + " planet_type_id: " + dirty.planets[i].planet_type_id));
                }

                // rarity roll for every planet
                let rarity = helper.rarityRoll();

                if(dirty.planets[i].planet_type_id === debug_planet_type_id) {
                    console.log("Rarity roll: " + rarity);
                }

                let planet_event_linkers = dirty.planet_event_linkers.filter(planet_event_linker =>
                    planet_event_linker.planet_type_id === dirty.planets[i].planet_type_id && planet_event_linker.rarity <= rarity);

                if(planet_event_linkers.length !== 0) {

                    if(dirty.planets[i].planet_type_id === debug_planet_type_id) {
                        console.log("Have " + planet_event_linkers.length + " events for planet type id: " + dirty.planets[i].planet_type_id);
                        console.log(planet_event_linkers);
                    }

                    let random_planet_event_linker = planet_event_linkers[Math.floor(Math.random() * planet_event_linkers.length)];



                    // get the event
                    let event_index = dirty.events.findIndex(function(obj) { return obj && obj.id === random_planet_event_linker.event_id; });

                    if(event_index !== -1 && dirty.planets[i].planet_type_id === debug_planet_type_id) {
                        console.log("Randomly chose event id: " + dirty.events[event_index].id + " " + dirty.events[event_index].name);
                    } else if(dirty.planets[i].planet_type_id === debug_planet_type_id) {
                        log(chalk.yellow("Could not find that event. event id: " + random_planet_event_linker.event_id));
                    }

                    if(event_index !== -1 && dirty.events[event_index].is_active) {
                        //log(chalk.green("Going to spawn event " + dirty.events[event_index].name + " id: " + dirty.events[event_index].id + " on planet id: " + dirty.planets[i].id));
                        await spawn(dirty, event_index, { 'planet_id': dirty.planets[i].id });
                    }

                }

            }
        }


        log(chalk.green("In galaxy spawn part!"));
        // Spawn Events In The Galaxy!
        let galaxy_event_index = -1;
        let galaxy_rarity = helper.rarityRoll();

        let galaxy_linkers = dirty.events.filter(event_filter =>
            event_filter.spawns_in_galaxy && event_filter.rarity <= galaxy_rarity);

        if(galaxy_linkers.length > 0) {
            let random_galaxy_event = galaxy_linkers[Math.floor(Math.random() * galaxy_linkers.length)];

            // get the event
            galaxy_event_index = dirty.events.findIndex(function(obj) { return obj && obj.id === random_galaxy_event.id; });
        } else {
            console.log("No relevant galaxy linkers");
        }

        if(galaxy_event_index === -1) {
            log(chalk.yellow("Could not find the galaxy event"));
            return false;
        }

        if(!dirty.events[galaxy_event_index].is_active) {
            log(chalk.yellow("Picked a galaxy event that isn't active yet"));
            return false;
        }


        log(chalk.green("Going to spawn event IN GALAXY " + dirty.events[galaxy_event_index].name + " id: " + dirty.events[galaxy_event_index].id));
        await spawn(dirty, galaxy_event_index, { 'scope': 'galaxy'});




    } catch(error) {
        log(chalk.red("Error in event.tickSpawning: " + error));
        console.error(error);
    }

}



module.exports = {

    spawn,
    tickSpawnedEvents,
    tickSpawning

}
