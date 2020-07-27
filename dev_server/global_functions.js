// TODO THIS IS A STUPID WAY OF DOING THINGS!!! REMOVE EVERYTHING FROM HERE

// Functions in here use a variety of depedancies that conflict in the order they are loaded


//   (object_id   OR   object_index)   |   coord_index   |   planet_coord_index   |   ship_coord_index   |   reason (optional)
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
 * @returns {Promise<boolean>}
 */
async function placeObject(socket, dirty, data) {

    try {

        //log(chalk.cyan("In game.placeObject with data: "));
        //console.log(data);

        let object_index = -1;

        if(typeof data.object_index !== 'undefined') {
            object_index = data.object_index;
        } else if(data.object_id) {
            object_index = await game_object.getIndex(dirty, data.object_id);
        }

        if(object_index === -1) {
            return false;
        }

        let object_type_index = getObjectTypeIndex(dirty.objects[object_index].object_type_id);


        // We can't place things on stairs or a hole - I think in general I should have this in the various canPlace functions
        // But this is such a game breaking thing
        if(typeof data.planet_coord_index !== "undefined" && (dirty.planet_coords[data.planet_coord_index].object_type_id === 63 ||
            dirty.planet_coords[data.planet_coord_index].object_type_id === 62 )) {
            log(chalk.yellow("Can't place on hole or stairs! Why didn't canPlace catch this?!?"));
            console.trace("this!");
            return false;
        }

        // PORTAL
        if(dirty.objects[object_index].object_type_id === 47) {
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

                await updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
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
            if(!already_have_stairs && !await game_object.canPlace(dirty, 'planet', dirty.planet_coords[below_coord_index],
                { 'object_type_id': dirty.objects[object_index].object_type_id })) {
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
                let new_object_index = await game_object.getIndex(dirty, new_object_id);
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

            // No need for all these checks - it's part of the system! Just add it
            if(data.reason && data.reason === "generate_ship") {

                await updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
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

            let can_place_stairs_result = await game_object.canPlace(dirty, 'planet', dirty.planet_coords[above_coord_index],
            { 'object_type_id': dirty.object_types[object_type_index].linked_object_type_id, 'show_output': true });



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
            let new_object_index = await game_object.getIndex(dirty, new_object_id);
            await updateCoordGeneric(socket, { 'planet_coord_index': above_coord_index, 'object_index': new_object_index });



        }
        // ELEVATOR
        // It's actually all pretty standard with an elevator - we just need to make sure we mess with the elevator linkers afterwards
        else if(dirty.object_types[object_type_index].id === 269) {


            if(data.planet_coord_index) {
                await updateCoordGeneric(socket, { 'planet_coord_index': data.planet_coord_index, 'object_index': object_index });
                dirty.objects[object_index].planet_id = dirty.planet_coords[data.planet_coord_index].planet_id;
                dirty.objects[object_index].has_change = true;
            } else if(data.ship_coord_index) {

                await updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
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
                            'level': origin_coord.level,
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
                    dirty.objects[object_index].planet_id = dirty.planet_coords[data.planet_coord_index].planet_id;
                    dirty.objects[object_index].has_change = true;
                } else if(data.ship_coord_index) {

                    await updateCoordGeneric(socket, { 'ship_coord_index': data.ship_coord_index, 'object_index': object_index });
                    dirty.objects[object_index].ship_id = dirty.ship_coords[data.ship_coord_index].ship_id;
                    dirty.objects[object_index].has_change = true;
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