// Functions in here use a variety of depedancies that conflict in the order they are loaded

// For now just make sure the player can't eat multiple of the same thing at once
// TODO maybe let the tick count of each object type stack (just in tick count, so longer ) up to x5 of it's normal tick count
// data:    inventory_item_id   |   npc_index
async function eat(socket, dirty, database_queue, data) {

    try {

        if(socket !== false && !socket.player_id) {
            console.log("Invalid player data sent in");
            return false;
        }

        let npc_index = -1;
        if(typeof data.npc_index !== 'undefined') {
            npc_index = data.npc_index;
        }




        let inventory_item_id = parseInt(data.inventory_item_id);
        let inventory_item_index = dirty.inventory_items.findIndex(function(obj) {
            return obj && obj.id === inventory_item_id; });
        let inventory_item_object_type_index = dirty.object_types.findIndex(function(obj) {
            return obj && obj.id === dirty.inventory_items[inventory_item_index].object_type_id; });


        let player_body_index = -1;
        let player_body_object_type_index = -1;

        if(socket) {
            player_body_index = await getObjectIndex(dirty.players[socket.player_index].body_id);
            player_body_object_type_index = dirty.object_types.findIndex(function(obj) {
                return obj && obj.id === dirty.objects[player_body_index].object_type_id; });
        }


        let race_eating_linker_index = -1;
        if(socket) {
            race_eating_linker_index = dirty.race_eating_linkers.findIndex(function(obj) { return obj &&
                obj.race_id === dirty.object_types[player_body_object_type_index].race_id &&
                obj.object_type_id ===  dirty.object_types[inventory_item_object_type_index].id;
            });
        } else {
            race_eating_linker_index = dirty.race_eating_linkers.findIndex(function(obj) { return obj &&
                obj.race_id === 13 &&
                obj.object_type_id ===  dirty.object_types[inventory_item_object_type_index].id;
            });
        }

        if(race_eating_linker_index === -1) {
            console.log("Didn't find a race eating linker");
            return false;
        }

        // make sure this type of thing isn't already being eaten
        let existing_eating_index = -1;
        if(socket) {
            existing_eating_index = dirty.eating_linkers.findIndex(function(obj) {
                return obj && obj.body_id === dirty.objects[player_body_index].id
                    && obj.eating_object_type_id === dirty.object_types[inventory_item_object_type_index].id; });
        } else {
            existing_eating_index = dirty.eating_linkers.findIndex(function(obj) {
                return obj && obj.npc_id === dirty.npcs[npc_index].id
                    && obj.eating_object_type_id === dirty.object_types[inventory_item_object_type_index].id; });
        }


        if(existing_eating_index !== -1) {

            if(socket) {
                socket.emit('chat', { 'message': 'You can only eat one of something at a time', 'scope': 'system' });
            }

            return false;
        }

        // return false if we already have an entry in the database queue
        let database_queue_index = -1;

        if(socket) {
            database_queue_index = database_queue.findIndex(function(obj) { return obj &&
                obj.player_id === socket.player_id && obj.eating_object_type_id === dirty.object_types[inventory_item_object_type_index].id });
        } else {
            database_queue_index = database_queue.findIndex(function(obj) { return obj &&
                obj.npc_id === dirty.npcs[npc_index].id && obj.eating_object_type_id === dirty.object_types[inventory_item_object_type_index].id });
        }


        if(database_queue_index !== -1) {
            console.log("MySQL is slow. Eating");
            if(socket) {
                socket.emit('chat', { 'message': 'You can only eat one of something at a time', 'scope': 'system' });
            }

            return false;
        }

        let remove_inventory_data = { 'inventory_item_id': dirty.inventory_items[inventory_item_index].id, 'amount': 1};
        inventory.removeFromInventory(socket, dirty, remove_inventory_data);



        // add an entry to the database queue
        if(socket) {
            database_queue_index = database_queue.push({'player_id': socket.player_id, 'eating_object_type_id': dirty.object_types[inventory_item_object_type_index].id}) - 1;
        } else {
            database_queue_index = database_queue.push({'npc_id': dirty.npcs[npc_index].id, 'eating_object_type_id': dirty.object_types[inventory_item_object_type_index].id}) - 1;
        }

        // Lets insert this guy!
        let sql = "";
        let inserts = [];

        if(socket) {
            sql = "INSERT INTO eating_linkers(player_id, body_id, eating_object_type_id, ticks_completed)VALUES(?, ?, ?, 0)";
            inserts = [socket.player_id, dirty.objects[player_body_index].id, dirty.object_types[inventory_item_object_type_index].id];
        } else {
            sql = "INSERT INTO eating_linkers(npc_id, eating_object_type_id, ticks_completed)VALUES(?, ?, 0)"
            inserts = [dirty.npcs[npc_index].id, dirty.object_types[inventory_item_object_type_index].id]
        }

        let [result] = await (pool.query(sql, inserts));
        let insert_id = result.insertId;
        //console.log("Got insert id as: " + result.insertId);

        eating_linker_index = await getEatingLinkerIndex({ 'id': insert_id});

        //console.log("New eating linker eating_object_type_id: " + dirty.eating_linkers[eating_linker_index].eating_object_type_id);

        // and remove it from the database queue
        //database_queue_index = database_queue.findIndex(function(obj) { return obj &&
        //    obj.player_id === socket.player_id && obj.eating_object_type_id === dirty.object_types[inventory_item_object_type_index].id });

        if(database_queue_index !== -1) {
            delete database_queue[database_queue_index];
        }

        if(eating_linker_index !== -1 && socket) {
            socket.emit('eating_linker_info', { 'eating_linker': dirty.eating_linkers[eating_linker_index]});
        }

        // see if the player or npc gets addicted
        // TODO support for npcs and addiction
        if(socket && dirty.race_eating_linkers[race_eating_linker_index].addiction_chance) {
            let rand_result = getRandomIntInclusive(1,100);

            if(rand_result <= dirty.race_eating_linkers[race_eating_linker_index].addiction_chance) {
                // PLAYER IS ADDICTED
                log(chalk.cyan("ADDICTION HAS HAPPENED!"));
                // see if there's an existing addiction linker
                let addiction_linker_index = dirty.addiction_linkers.findIndex(function(obj) { return obj &&
                    obj.addicted_body_id === dirty.objects[player_body_index].id &&
                    obj.addicted_to_object_type_id === dirty.object_types[inventory_item_object_type_index].id; })

                // Add it
                if(addiction_linker_index === -1) {
                    // we can create the faction
                    let sql = "INSERT INTO addiction_linkers(addicted_to_object_type_id, addicted_body_id, addiction_level) VALUES(?,?,?)";
                    let inserts = [dirty.object_types[inventory_item_object_type_index].id, dirty.objects[player_body_index].id, 1];

                    let [result] = await (pool.query(sql, inserts));

                    let new_id = result.insertId;

                    console.log("Inserted new addiction linker id: " + new_id);

                    let [rows, fields] = await (pool.query("SELECT * FROM addiction_linkers WHERE id = ?", [new_id]));
                    if(rows[0]) {

                        let new_addiction_linker_index = dirty.addiction_linkers.push(rows[0]) - 1;

                        socket.emit('addiction_linker_info', { 'addiction_linker': dirty.addiction_linkers[new_addiction_linker_index] });

                    }

                }
                // Increase it
                else {
                    console.log("Increasing addiction level");
                    dirty.addiction_linkers[addiction_linker_index].addiction_level++;
                    dirty.addiction_linkers[addiction_linker_index].has_change = true;
                }

                // let the player know they are addicted
                socket.emit('addiction_linker_info', { 'addiction_linker': dirty.addiction_linkers[addiction_linker_index] });
            }
        }



    } catch(error) {
        log(chalk.red("Error in global_functions.eat: " + error));
        console.error(error);
    }


}
module.exports.eat = eat;



//   (object_id   OR   object_index)   |   coord_index   |   planet_coord_index   |   ship_coord_index
async function placeObject(socket, dirty, data) {

    try {

        //log(chalk.cyan("In game.placeObject with data: "));
        //console.log(data);

        let object_index = -1;

        if(typeof data.object_index !== 'undefined') {
            object_index = data.object_index;
        } else if(data.object_id) {
            object_index = await getObjectIndex(data.object_id);
        }

        if(object_index === -1) {
            return false;
        }

        let object_type_index = getObjectTypeIndex(dirty.objects[object_index].object_type_id);

        // PORTAL
        if(dirty.objects[object_index].object_type_id === 47) {
            let add_portal_data = {};

            if(data.planet_coord_index) {

                add_portal_data = { 'planet_coord_index': data.planet_coord_index};
            } else if(data.ship_coord_index) {
                add_portal_data = { 'ship_coord_index': data.ship_coord_index};
            }

            await game.addPortal(socket, dirty, add_portal_data);

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

            // Also needs to be level 0 or higher
            if(dirty.planet_coords[data.planet_coord_index].level < 1) {
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

            let below_coord_index = await getPlanetCoordIndex(below_data);

            if(below_coord_index === -1) {
                console.log("Couldn't get coord below...");
                return false;
            }

            let already_have_stairs = false;
            // See if there are already stairs below, or if we can make stairs below
            if(dirty.planet_coords[below_coord_index].object_type_id) {
                let below_object_type_index = getObjectTypeIndex(dirty.planet_coords[below_coord_index].object_type_id);
                if(below_object_type_index !== -1 && dirty.object_types[below_object_type_index].is_stairs) {
                    already_have_stairs = true;
                }
            }

            // see if we can place an object on that below coord
            if(!already_have_stairs && !await canPlaceObject({'scope': 'planet', 'coord': dirty.planet_coords[below_coord_index],
                'object_type_id': dirty.objects[object_index].object_type_id })) {
                console.log("Something is blocking us from placing the stairs below");
                return false;
            }

            // Looks good. Add the hole
            await updateCoordGeneric(socket, { 'planet_coord_index': data.planet_coord_index, 'object_index': object_index });


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
                let new_object_index = await getObjectIndex(new_object_id);
                await updateCoordGeneric(socket, { 'planet_coord_index': below_coord_index, 'object_index': new_object_index });
            }




        }
        // STAIRS
        else if(dirty.object_types[object_type_index].is_stairs) {



            console.log("Player is placing stairs");

            if(dirty.object_types[object_type_index].id === 63) {
                log(chalk.red("Can't place the default un-attackable stairs"));
                return false;
            }



            // Also needs to be level 0 or higher
            if(dirty.planet_coords[data.planet_coord_index].level < 0) {
                console.log("Can't place stairs on levels < 0");
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

            let above_coord_index = await getPlanetCoordIndex(above_data);

            if(above_coord_index === -1) {
                console.log("Couldn't get coord above...");
                return false;
            }

            // See if there's already a hole there, or we are able to make one
            let already_have_hole = false;

            if(dirty.planet_coords[above_coord_index].object_type_id) {
                let above_object_type_index = getObjectTypeIndex(dirty.planet_coords[above_coord_index].object_type_id);
                if(above_object_type_index !== -1 && dirty.object_types[above_object_type_index].is_hole) {
                    already_have_hole = true;
                }
            }

            // see if we can place an object on that above coord
            if(!already_have_hole && !await canPlaceObject({'scope': 'planet', 'coord': dirty.planet_coords[above_coord_index],
                'object_type_id': dirty.objects[object_index].object_type_id })) {
                console.log("Something is blocking us from placing the hole above");
                socket.emit('chat', { 'message': 'Something is blocking the hole above from being created', 'scope': 'system' });
                return false;
            }

            // Looks like we are all good. Add the stairs
            await updateCoordGeneric(socket, { 'planet_coord_index': data.planet_coord_index, 'object_index': object_index });

            // Create and add the hole
            let inserting_object_type_data = {
                'object_type_id': dirty.object_types[object_type_index].linked_object_type_id };

            if(dirty.objects[object_index].player_id) {
                inserting_object_type_data.player_id = dirty.objects[object_index].player_id;
            } else if(dirty.objects[object_index].npc_id) {
                inserting_object_type_data.npc_id = dirty.objects[object_index].npc_id;
            }

            let new_object_id = await world.insertObjectType(socket, dirty, inserting_object_type_data);
            let new_object_index = await getObjectIndex(new_object_id);
            await updateCoordGeneric(socket, { 'planet_coord_index': above_coord_index, 'object_index': new_object_index });



        }
        // Default case - we can just update the coord
        else {


            // see if the object type has display linkers that aren't only visual (takes up space)
            let display_linkers = dirty.object_type_display_linkers.filter(linker =>
                linker.object_type_id === dirty.object_types[object_type_index].id && !linker.only_visual);

            // This object will take up multiple tiles of space
            if(display_linkers.length > 0) {

                let origin_coord;
                if(data.coord_index) {
                    origin_coord = dirty.coords[data.coord_index];
                } else if(data.planet_coord_index) {
                    origin_coord = dirty.planet_coords[data.planet_coord_index];
                } else if(data.ship_coord_index) {
                    origin_coord = dirty.ship_coords[data.ship_coord_index];
                }

                display_linkers.forEach(await async function(linker) {

                    // get the coord that the display linker is about
                    let tile_x = origin_coord.tile_x + linker.position_x;
                    let tile_y = origin_coord.tile_y + linker.position_y;

                    let placing_coord_index = -1;
                    if(data.coord_index) {
                        placing_coord_index = await getCoordIndex({ 'tile_x': tile_x, 'tile_y': tile_y });
                    } else if(data.planet_coord_index) {
                        placing_coord_index = await getPlanetCoordIndex({ 'planet_id': origin_coord.planet_id,
                            'planet_level': origin_coord.level, 'tile_x': tile_x, 'tile_y': tile_y });
                    } else if(data.ship_coord_index) {
                        placing_coord_index = await getShipCoordIndex({ 'ship_id': origin_coord.ship_id,
                            'tile_x': tile_x, 'tile_y': tile_y });
                    }

                    if(placing_coord_index !== -1) {
                        let update_data = {};

                        if(data.coord_index) {
                            update_data.coord_index = placing_coord_index;
                        } else if(data.planet_coord_index) {
                            update_data.planet_coord_index = placing_coord_index;
                        } else if(data.ship_coord_index) {
                            update_data.ship_coord_index = placing_coord_index;
                        }

                        if(tile_x === origin_coord.tile_x && tile_y === origin_coord.tile_y) {
                            update_data.object_index = object_index;
                        } else {
                            update_data.belongs_to_object_id = dirty.objects[object_index].id;
                        }

                        await updateCoordGeneric(socket, update_data);

                    }

                });

            } else {
                // simple way!

                if(data.coord_index) {
                    await updateCoordGeneric(socket, { 'coord_index': data.coord_index, 'object_index': object_index });
                } else if(data.planet_coord_index) {
                    await updateCoordGeneric(socket, { 'planet_coord_index': data.planet_coord_index, 'object_index': object_index });
                } else if(data.ship_coord_index) {

                    await updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
                }
            }



        }

        return true;

    } catch(error) {
        log(chalk.red("Error in global_functions.placeObject: " + error));
        console.error(error);
    }

}

module.exports.placeObject = placeObject;