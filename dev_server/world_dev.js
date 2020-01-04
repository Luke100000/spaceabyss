module.exports = function(main, io, mysql, pool, chalk, log, uuid, PF) {

    var module = {};

    io.sockets.on('connection', function (socket) {

    });


    /*
     data:       attacking_id   |   attacking_type   |   ?attacking_socket_id?   |   being_attacked_id   |   being_attacked_type   |   ?being_attacked_socket_id?
     */

    // TODO this function is kind of a mess right now
    async function addBattleLinker(socket, dirty, data) {

        try {

            //console.log("In add battle linker");
            //console.log("Data passed into world.addBattleLinker: ");
            //console.log(data);

            if(data.attacking_id == null) {
                log(chalk.red("null attacking_id inputted. KILL ALL HUMANS"));
                return false;
            }


            let socket_id = false;
            let being_attacked_socket_id = false;
            let attacking_index = -1;
            let being_attacked_index = -1;

            if(socket !== false) {
                socket_id = socket.id;
            }

            if(data.being_attacked_socket_id) {
                being_attacked_socket_id = data.being_attacked_socket_id;
            }


            // see if we already have the battle linker
            let battle_linker_index = dirty.battle_linkers.findIndex(function(obj) {
                return obj && obj.attacking_id === data.attacking_id && obj.attacking_type === data.attacking_type &&
                    obj.being_attacked_id === data.being_attacked_id  && obj.being_attacked_type === data.being_attacked_type });

            if(battle_linker_index !== -1) {
                //log(chalk.yellow("Already have a matching battle linker"));
                return false;
            }

            // attach and get our socket ids if we are dealing with players
            if(data.attacking_type === 'player') {
                attacking_index = await main.getPlayerIndex({ 'player_id': data.attacking_id });
                if(attacking_index !== -1) {
                    // make sure the other player is connected
                    Object.keys(io.sockets.sockets).forEach(function(id) {

                        if(io.sockets.connected[id].player_id === data.attacking_id) {
                            socket_id = id;
                        }

                    });
                } else {
                    // Can't attack if we aren't a player
                    return false;
                }
            }

            if(data.being_attacked_type === 'player') {
                being_attacked_index = await main.getPlayerIndex({ 'player_id': data.being_attacked_id });
                if(being_attacked_index !== -1) {
                    // make sure the other player is connected
                    Object.keys(io.sockets.sockets).forEach(function(id) {

                        if(io.sockets.connected[id].player_id === data.being_attacked_id) {
                            being_attacked_socket_id = id;
                        }

                    });
                } else {
                    // Not gonna attack players we can't find
                    return false;
                }
            }


            // ATTACKER
            // Make sure the player attacking can attack. Can't attack if they are standing on a spaceport tile,
            //  or if they are in space and have a pod
            if(data.attacking_type === 'player') {

                // Spaceport tile check
                if(dirty.players[attacking_index].planet_coord_id) {
                    let attacking_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.players[attacking_index].planet_coord_id });

                    if(attacking_coord_index === -1) {
                        return false;
                    }

                    if(dirty.planet_coords[attacking_coord_index].floor_type_id === 11) {
                        console.log("No attacking when spaceport tiles are involved");

                        // Let the player know this reason
                        socket.emit('chat', { 'message': "You can't attack while on a spaceport", 'scope': 'system' });
                        return false;
                    }

                    // On azure planet check
                    // TODO I think I want to not code it this way. Rather have AIs on azure planets
                    // That are just really powerful
                    /*
                    let planet_index = await main.getPlanetIndex(dirty.players[attacking_index].planet_id);
                    if(planet_index !== -1 && dirty.planets[planet_index].planet_type_id === 16) {

                        console.log("Can't attack players on azure planets. attacking type: " + data.attacking_type +
                            " being_attacked_type: " + data.being_attacked_type);
                        // and attack the other player
                        socket.emit('chat', { 'message': "Epic Azure planet system defense activated!", 'scope': 'local' });
                        return false;
                    }
                    */

                }

            } else if(data.attacking_type === 'object') {
                // We can't attack anyone if we are a pod
                // Make sure the object isn't a pod
                console.log("Object is attacking. data.attacking_id: " + data.attacking_id);
                let attacking_object_index = await main.getObjectIndex(data.attacking_id);
                if(attacking_object_index === -1) {
                    return false;
                }

                // TODO right now we are getting a message from this when the abandoned pod tries to attack us back
                if(dirty.objects[attacking_object_index].object_type_id === 114) {

                    // Let the attacking player know you can't attack pods
                    socket.emit('chat', { 'message': "Pods are your default ship. You can't attack, or be attacked in them. " +
                            "You can build more advanced ships if you build a shipyard in the galaxy", 'scope': 'system'});
                    //console.log("Attacking object id: " + dirty.objects[attacking_object_index].id);
                    return false;

                }
            }

            // DEFENDER
            // Make sure this player can actually be attacked right now
            // Can't attack npcs in their pod in space
            if(data.being_attacked_type === 'npc') {
                being_attacked_index = await main.getNpcIndex(data.being_attacked_id);
                if(dirty.npcs[being_attacked_index].coord_id && !dirty.npcs[being_attacked_index].ship_id) {
                    console.log("No attacking npcs in pods");
                    return false;
                }
            }
            // Spaceport tile or a pod ship means they can't be attacked
            if(data.being_attacked_type === 'player') {

                // Spaceport tile check
                if(dirty.players[being_attacked_index].planet_coord_id) {
                    let being_attacked_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.players[being_attacked_index].planet_coord_id });

                    if(being_attacked_coord_index === -1) {
                        return false;
                    }

                    if(dirty.planet_coords[being_attacked_coord_index].floor_type_id === 11) {
                        console.log("No attacking when spaceport tiles are involved");
                        return false;
                    }


                }

            } else if(data.being_attacked_type === 'object') {
                // Make sure the object isn't a pod
                let being_attacked_object_index = await main.getObjectIndex(data.being_attacked_id);
                if(being_attacked_object_index === -1) {
                    return false;
                }

                if(dirty.objects[being_attacked_object_index].object_type_id === 114 && dirty.objects[being_attacked_object_index].player_id) {

                    // Let the attacking player know you can't attack pods
                    socket.emit('chat', { 'message': "Occupied pods cannot be attacked - only abandoned pods can be attacked", 'scope': 'system' });

                    return false;
                }

            }


            // EVERYTHING CHECKED OUT. LETS ADD IT

            let battle_linker = {
                'id': uuid(),
                'attacking_id': data.attacking_id, 'attacking_type': data.attacking_type, 'being_attacked_id': data.being_attacked_id,
                'being_attacked_type': data.being_attacked_type, 'socket_id': socket_id, 'being_attacked_socket_id': being_attacked_socket_id,
                'turn_count': 0
            };

            battle_linker_index = dirty.battle_linkers.push(battle_linker) - 1;

            //console.log("Added battle linker!");


            if(socket_id) {
                io.to(socket_id).emit('battle_linker_info', { 'something': 'yes', 'battle_linker': dirty.battle_linkers[battle_linker_index] });
            }

            if(being_attacked_socket_id) {
                io.to(being_attacked_socket_id).emit('battle_linker_info', { 'something': 'yes', 'battle_linker': dirty.battle_linkers[battle_linker_index] });
            }

            // If it's a player and they were attacking something else previously, we will stop that previous attack
            if(data.attacking_type === 'player') {
                let previous_battle_linker_index = dirty.battle_linkers.findIndex(function(obj) { return obj && obj.attacking_type === 'player' &&
                    obj.attacking_id === data.attacking_id && obj.id !== dirty.battle_linkers[battle_linker_index].id; });

                if(previous_battle_linker_index !== -1) {

                    console.log("Player had a previous battle linker. Lets remove it");

                    if(dirty.battle_linkers[previous_battle_linker_index].socket_id) {
                        io.to(dirty.battle_linkers[previous_battle_linker_index].socket_id).emit('battle_linker_info',
                            { 'remove': 'true', 'battle_linker': dirty.battle_linkers[previous_battle_linker_index] });
                    }

                    if(dirty.battle_linkers[previous_battle_linker_index].being_attacked_socket_id) {
                        io.to(dirty.battle_linkers[previous_battle_linker_index].being_attacked_socket_id).emit('battle_linker_info',
                            { 'remove': true, 'battle_linker': dirty.battle_linkers[previous_battle_linker_index] });
                    }

                    delete dirty.battle_linkers[previous_battle_linker_index];

                }
            }



        } catch(error) {
            log(chalk.red("Error in world.addBattleLinker: " + error));
            console.error(error);

        }


    }

    module.addBattleLinker = addBattleLinker;

    // Adding an object to a coord (galaxy)

    async function addObjectToCoord(dirty, object_index, coord_index) {

        try {
            log(chalk.red("CALLING OUTDATED FUNCTION"));
            return false;
            console.log("Adding info to the galaxy coord");
            dirty.coords[coord_index].object_id = dirty.objects[object_index].id;
            dirty.coords[coord_index].object_type_id = dirty.objects[object_index].object_type_id;
            dirty.coords[coord_index].object_amount = 1;
            dirty.coords[coord_index].has_change = true;


            console.log("Adding info to the object");
            dirty.objects[object_index].coord_id = dirty.coords[coord_index].id;
            dirty.objects[object_index].has_change = true;

            //let new_object_type_index = dirty.object_types.findIndex(function(obj) { return obj && obj.id === dirty.objects[object_index].object_type_id; });

        } catch(error) {
            log(chalk.red("Error in addObjectToCoord: " + error));
        }



    }
    module.addObjectToCoord = addObjectToCoord;

    async function addObjectToPlanetCoord(dirty, object_index, planet_coord_index) {

        try {
            log(chalk.red("OUTDATED FUNCTION"));
            return false;
            log(chalk.cyan("Was passed in object_index: " + object_index + " planet_coord_index: " + planet_coord_index));


            if(!dirty.objects[object_index]) {
                log(chalk.red("Could not find this object in dirty"));

                dirty.objects.forEach(function(object, i) {
                   console.log("Index: " + i + " Object id: " + object.id);
                });
                return false;
            }

            if(!dirty.planet_coords[planet_coord_index]) {
                log(chalk.red("Could not find this planet coord in dirty"));
                return false;
            }

            dirty.planet_coords[planet_coord_index].object_id = dirty.objects[object_index].id;
            dirty.planet_coords[planet_coord_index].object_type_id = dirty.objects[object_index].object_type_id;
            dirty.planet_coords[planet_coord_index].object_amount = 1;
            dirty.planet_coords[planet_coord_index].has_change = true;


            dirty.objects[object_index].planet_coord_id = dirty.planet_coords[planet_coord_index].id;
            dirty.objects[object_index].planet_id = dirty.planet_coords[planet_coord_index].planet_id;
            dirty.objects[object_index].has_change = true;

        } catch(error) {
            log(chalk.red("Error in world.addObjectToPlanetCoord: " + error));
        }



    }
    module.addObjectToPlanetCoord = addObjectToPlanetCoord;

    async function addObjectToShipCoord(dirty, object_index, ship_coord_index) {

        log(chalk.red("OUTDATED FUNCTION"));
        return false;

        dirty.ship_coords[ship_coord_index].object_id = dirty.objects[object_index].id;
        dirty.ship_coords[ship_coord_index].object_type_id = dirty.objects[object_index].object_type_id;
        dirty.ship_coords[ship_coord_index].object_amount = 1;
        dirty.ship_coords[ship_coord_index].has_change = true;


        dirty.objects[object_index].ship_coord_id = dirty.ship_coords[ship_coord_index].id;
        dirty.objects[object_index].ship_id = dirty.ship_coords[ship_coord_index].ship_id;
        dirty.objects[object_index].has_change = true;

    }
    module.addObjectToShipCoord = addObjectToShipCoord;




    // data:    player_index    |   message
    async function addPlayerLog(socket, dirty, data) {

        try {
            console.log("In world.addPlayerLog");

            let sql = "INSERT INTO player_logs(player_id,message,month,year) VALUES(?,?,?,?)";
            let inserts = [dirty.players[data.player_index].id, data.message, dirty.galaxies[0].month, dirty.galaxies[0].year];

            let [result] = await (pool.query(sql, inserts));

            console.log("Done in world.addPlayerLog");

        } catch(error) {
            log(chalk.red("Error in addPlayerLog: " + error));
            console.error(error);
        }
    }

    module.addPlayerLog = addPlayerLog;

    //  object_id   |   new_rule
    async function addRule(socket, dirty, data) {
        try {
            log(chalk.cyan("Got rule_data. Object id: " + data.object_id + " new rule: " + data.new_rule));

            // For now we are just going to have a master list
            let rule_values = ["attack_all_players", "attack_all_players_except_creator", "attack_all_players_except_creator_faction",
                "protect_all_players", "protect_creator", "protect_creator_property", "protect_self", "allow_all_players",
                "allow_faction_players", "allow_creator", "allow_monsters", "building_no_others", "floor_no_others",
                "protect_3", "protect_4"];

            // make sure the new rule is found in our array of rule values
            let in_array = false;
            for(let i = 0; i < rule_values.length; i++) {
                if(rule_values[i] === data.new_rule) {
                    in_array = true;
                }
            }

            if(!in_array) {
                log(chalk.yellow("Was sent rule that isn't in our rule_values array: " + data.new_rule));
                return false;

            }

            // Make sure the socket player and the object player match
            let object_index = await main.getObjectIndex(parseInt(data.object_id));

            if(object_index === -1) {
                log(chalk.yellow("Object index not found"));
                return false;

            }

            if(!socket.player_id || socket.player_id !== dirty.objects[object_index].player_id) {
                log(chalk.yellow("Not that player's object to add rules for"));
                return false;
            }

            let sql = "INSERT INTO rules(object_id, rule) VALUES(?,?)";
            let inserts = [parseInt(data.object_id), data.new_rule];

            let [result] = await (pool.query(sql, inserts));

            let new_id = result.insertId;

            console.log("Inserted new rule id: " + new_id);


            let [rows, fields] = await (pool.query("SELECT * FROM rules WHERE id = ?", [new_id]));
            if(rows[0]) {
                let added_rule = rows[0];
                added_rule.has_change = false;
                dirty.rules.push(added_rule);

                let object_index = await main.getObjectIndex(data.object_id);
                let object_info = await getObjectCoordAndRoom(dirty, object_index);

                sendRuleInfo(socket, object_info.room, dirty, added_rule.id);

                // Bit of extra work depending on the rule!

                // In the case of a protect_3_3 or protect_4_4 rule, we need to set that it is watching that area
                let split = data.new_rule.split("_");
                // For now, just protect in this
                if(split[0] !== "protect") {
                    console.log("Not protect rule");
                    return;
                }


                if(isNaN(split[1])) {
                    console.log("Not numbered protect rule");
                    return;
                }

                let protecting_radius = parseInt(split[1]);


                if(!object_info.room || object_info.room !== 'galaxy') {
                    log(chalk.yellow("Currently only supporting in galaxy"));
                }

                let starting_tile_x = object_info.coord.tile_x - protecting_radius;
                let ending_tile_x = object_info.coord.tile_x + protecting_radius;
                let starting_tile_y = object_info.coord.tile_y - protecting_radius;
                let ending_tile_y = object_info.coord.tile_y + protecting_radius;

                for(let x = starting_tile_x; x <= ending_tile_x; x++) {
                    for(let y = starting_tile_y; y <= ending_tile_y; y++) {
                        let coord_index = await main.getCoordIndex({ 'tile_x': x, 'tile_y': y });

                        if(coord_index !== -1 && !dirty.coords[coord_index].watched_by_object_id) {

                            main.updateCoordGeneric(socket, { 'coord_index': coord_index, 'watched_by_object_id': dirty.objects[object_index].id });
                        }
                    }
                }


            }


        } catch(error) {
            log(chalk.red("Error in world.addRule: " + error));
            console.error(error);
        }

    }

    module.addRule = addRule;

    //  data:   area_id   |   planet_coord_id   |   ship_coord_id
    async function addToArea(socket, dirty, data) {
        try {

            data.area_id = parseInt(data.area_id);
            data.planet_coord_id = parseInt(data.planet_coord_id);


            let area_index = await main.getAreaIndex({ 'area_id': data.area_id });

            if(area_index === -1) {
                return false;
            }
            // make sure the socket owns the area
            if(dirty.areas[area_index].owner_id !== socket.player_id) {
                return false;
            }

            if(data.planet_coord_id) {
                let planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': data.planet_coord_id });

                if(planet_coord_index === -1) {
                    return false;
                }

                dirty.planet_coords[planet_coord_index].area_id = dirty.areas[area_index].id;
                dirty.planet_coords[planet_coord_index].has_change = true;
            }

            if(data.ship_coord_id) {
                let ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': data.ship_coord_id });

                if(ship_coord_index === -1) {
                    return false;
                }

                dirty.ship_coords[ship_coord_index].area_id = dirty.areas[area_index].id;
                dirty.ship_coords[ship_coord_index].has_change = true;
            }




        } catch(error) {
            log(chalk.red("Error in world.addToArea: " + error));
            console.error(error);
        }
    }

    module.addToArea = addToArea;

    /*
    ai_id   |   atacking_type   |   attacking_id
    */
    async function aiAttack(dirty, data) {

        try {

            log(chalk.green("In battle.aiAttack. Having AI Attack type: " + data.attacking_type + " id: " + data.attacking_id));


            let ai_index = await main.getObjectIndex(data.ai_id);

            if(ai_index === -1) {
                return false;
            }

            if(dirty.objects[ai_index].energy < 100) {
                log(chalk.yellow("Not enough energy for any actions"));
                return false;
            }

            let energy_used = 100;
            let spawn_monster_data = { monster_type_id: 33 };

            console.log("Spawn monster data monster_type_id: " + spawn_monster_data.monster_type_id);

            // If we have AI Cores, and more energy, we can try and spawn an edifice
            if(data.attack_level === 2 && dirty.objects[ai_index].energy >= 500) {
                // lets see if there are enough AI Cores to spawn the higher level defense/attack
                let ai_core_count = 0;
                let ai_cores = dirty.objects.filter(object => object.object_type_id === 162 && object.planet_id === dirty.objects[ai_index].planet_id);

                for(let ai_core of ai_cores) {
                    ai_core_count++;
                }

                console.log("Got AI core count: " + ai_core_count);

                if(ai_core_count >= 1) {
                    spawn_monster_data.monster_type_id = 57;
                    energy_used = 500;
                    log(chalk.green("Set to spawn edifice"));

                } else {
                    log(chalk.yellow("Not enough cores for edifice"));
                }

            }

            let placing_planet_coord_index = -1;
            let placing_ship_coord_index = -1;
            let found_planet_coord = false;
            let found_ship_coord = false;
            let room = false;

            if(data.attacking_type === 'player') {

                console.log("AI spawning monster on player");

                spawn_monster_data.attack_on_spawn_type = 'player';
                spawn_monster_data.attack_on_spawn_id = data.attacking_id;

                let being_attacked_index = await main.getPlayerIndex({'player_id': data.attacking_id });

                if(dirty.objects[ai_index].planet_coord_id) {
                    let being_attacked_planet_coord_index = await main.getPlanetCoordIndex(
                        { 'planet_coord_id': dirty.players[being_attacked_index].planet_coord_id});

                    if(being_attacked_planet_coord_index === -1) {
                        log(chalk.yellow("Could not find planet coord of the thing we are attacking"));
                        return false;
                    }



                    // we need to try and find a cord around the thing being attacked where we can put the
                    // monster that the AI spawns.
                    for(let x = dirty.planet_coords[being_attacked_planet_coord_index].tile_x - 1;
                        x <= dirty.planet_coords[being_attacked_planet_coord_index].tile_x + 1; x++) {
                        for(let y = dirty.planet_coords[being_attacked_planet_coord_index].tile_y - 1;
                            y <= dirty.planet_coords[being_attacked_planet_coord_index].tile_y + 1; y++) {

                            console.log("Checking x,y: " + x + "," + y);

                            if(found_planet_coord === false) {
                                // (   planet_id   |   planet_level   |   tile_x   |   tile_y   )
                                let checking_data = { 'planet_id': dirty.planet_coords[being_attacked_planet_coord_index].planet_id,
                                    'planet_level': dirty.planet_coords[being_attacked_planet_coord_index].level,
                                    'tile_x': x, 'tile_y':y };
                                let checking_planet_coord_index = await main.getPlanetCoordIndex(checking_data);

                                if(checking_planet_coord_index !== -1) {
                                    let can_place_result = await main.canPlace('planet', dirty.planet_coords[checking_planet_coord_index],
                                        'monster', false, { 'monster_type_id': spawn_monster_data.monster_type_id });
                                    if(can_place_result) {
                                        placing_planet_coord_index = checking_planet_coord_index;
                                        spawn_monster_data.planet_coord_id = dirty.planet_coords[placing_planet_coord_index].id;
                                        room = "planet_" + dirty.objects[ai_index].planet_id;
                                        found_planet_coord = true;
                                    }

                                }
                            }


                        }
                    }

                } else if(dirty.objects[ai_index].ship_coord_id) {

                    let being_attacked_ship_coord_index = await main.getShipCoordIndex(
                        { 'ship_coord_id': dirty.players[being_attacked_index].ship_coord_id });

                    if(being_attacked_ship_coord_index === -1) {
                        log(chalk.yellow("Could not find ship coord of the thing we are attacking"));
                        return false;
                    }



                    // we need to try and find a cord around the thing being attacked where we can put the
                    // monster that the AI spawns.
                    for(let x = dirty.ship_coords[being_attacked_ship_coord_index].tile_x - 1;
                        x <= dirty.ship_coords[being_attacked_ship_coord_index].tile_x + 1; x++) {
                        for(let y = dirty.ship_coords[being_attacked_ship_coord_index].tile_y - 1;
                            y <= dirty.ship_coords[being_attacked_ship_coord_index].tile_y + 1; y++) {

                            console.log("Checking x,y: " + x + "," + y);

                            if(found_ship_coord === false) {
                                // (   ship_id   |   tile_x   |   tile_y   )
                                let checking_data = { 'ship_id': dirty.ship_coords[being_attacked_ship_coord_index].ship_id,
                                    'tile_x': x, 'tile_y':y };
                                let checking_ship_coord_index = await main.getShipCoordIndex(checking_data);

                                if(checking_ship_coord_index !== -1) {
                                    let can_place_result = await main.canPlace('ship', dirty.ship_coords[checking_ship_coord_index],
                                        'monster', false, { 'monster_type_id': spawn_monster_data.monster_type_id });
                                    if(can_place_result) {
                                        placing_ship_coord_index = checking_ship_coord_index;
                                        spawn_monster_data.ship_coord_id = dirty.ship_coords[placing_ship_coord_index].id;
                                        room = "ship_" + dirty.ship_coords[being_attacked_ship_coord_index].ship_id;
                                        found_ship_coord = true;
                                    }

                                }
                            }


                        }
                    }
                }


            }

            if(!found_planet_coord && !found_ship_coord) {
                log(chalk.yellow("Did not find a coord for the monsters to spawn on"));
                return false;
            }


            log(chalk.cyan("Before spawnMonster function spawning monster type id: " + spawn_monster_data.monster_type_id));

            spawnMonster(dirty, spawn_monster_data);



            dirty.objects[ai_index].energy -= energy_used;
            dirty.objects[ai_index].has_change = true;

            // send the updated ai (object) info to the room
            console.log("Sending updated ai info to room");
            world.sendObjectInfo(false, room, dirty, ai_index);

        } catch(error) {
            log(chalk.red("Error in battle.aiAttack: " + error));
            console.error(error);
        }

    }

    module.aiAttack = aiAttack;


    // Higher leve, more generic function than aiAttack. This is mean to see if we start retaliating against something
    async function aiRetaliate(dirty, ai_index, attacking_type, attacking_id) {

        // AI is going to hit back the thing that violated its rules
        // Make sure that the AI isn't already engaged with this person
        let existing_attack_linkers = dirty.battle_linkers.filter(filtered => filtered.being_attacked_type === attacking_type &&
            filtered.being_attacked_id === attacking_id && filtered.attacking_type === 'monster');
        let already_attacking = false;

        for(let linker of existing_attack_linkers) {
            let monster_index = await main.getMonsterIndex(linker.attacking_id);
            if(dirty.monsters[monster_index].monster_type_id === 33 || dirty.monsters[monster_index].monster_type_id === 57) {
                already_attacking = true;
            }
        }

        if(!already_attacking) {
            // and try and attack the attacking player
            let attack_data = {
                'ai_id': dirty.objects[ai_index].id,
                'attacking_type': attacking_type,
                'attacking_id': attacking_id
            };

            aiAttack(dirty, attack_data);
        } else {
            console.log("AI is already attacking.");
        }
    }

    module.aiRetaliate = aiRetaliate;


    // Used to associate the engine with the ship, so that we can easily add fuel, remove fuel from the engine objects
    // as the ship moves around
    async function attachShipEngines(dirty, ship_index) {

        try {

            // Go through all the ship coords in dirty, finding engines
            let engine_indexes = [];

            //console.time("attachShipEngines");

            for(let i = 0; i < dirty.ship_coords.length; i++) {
                if(dirty.ship_coords[i].ship_id === dirty.objects[ship_index].id && dirty.ship_coords[i].object_type_id === 265) {

                    let drive_index = await main.getObjectIndex(dirty.ship_coords[i].object_id);

                    if(drive_index !== -1) {

                        engine_indexes.push(drive_index);

                    } else {
                        console.log("Could not find ion drive to refuel");
                    }

                }
            }

            dirty.objects[ship_index].engine_indexes = engine_indexes;

            //console.timeEnd("attachShipEngines");

        } catch(error) {
            log(chalk.red("Error in world.attachShipEngines: " + error));
            console.error(error);
        }
    }

    module.attachShipEngines = attachShipEngines;

    async function changeArea(socket, dirty, data) {
        try {

            if(!data.area_id) {
                return false;
            }

            data.area_id = parseInt(data.area_id);

            if(isNaN(data.area_id)) {
                return false;
            }

            let area_index = await main.getAreaIndex({ 'area_id': data.area_id });

            if(area_index === -1) {
                return false;
            }

            // Only the area owner can change it
            if(socket.player_id !== dirty.areas[area_index].owner_id) {
                log(chalk.yellow("Hacking area attempt"));
                return false;
            }


            if(data.new_name) {

                if(socket.player_id !== dirty.areas[area_index].owner_id) {
                    return false;
                }

                console.log("Owner is renaming an area. New name: " + data.new_name);

                data.new_name = main.cleanStringInput(data.new_name);

                console.log("New name after we clean it: " + data.new_name);

                dirty.areas[area_index].name = data.new_name;
                dirty.areas[area_index].has_change = true;

                socket.emit('area_info', { 'area': dirty.areas[area_index] });


            }

            if(data.put_on_market) {

                // Can't already have a renting player id
                if(dirty.areas[area_index].renting_player_id) {
                    log(chalk.yellow("Can't put an area with a renting player on the market"));
                    // TODO send this info back to the socket
                    return false;
                }

                let in_a_week_timestamp = Date.now() + 7 * 24 * 60 * 60 * 1000;

                // Insert a market linker
                let [result] = await (pool.query("INSERT INTO market_linkers(area_id, planet_id, ship_id, ending_at)VALUES(?,?,?,?)",
                    [dirty.areas[area_index].id, dirty.areas[area_index].planet_id, dirty.areas[area_index].ship_id, in_a_week_timestamp.toISOString().slice(0, 19).replace('T', ' ')]));

                if(result) {
                    let new_market_linker_id = result.insertId;
                    console.log("Got new market linker id: " + new_market_linker_id);

                    let [rows, fields] = await (pool.query("SELECT * FROM market_linkers WHERE id = ?", [new_market_linker_id]));
                    if(rows[0]) {
                        let market_linker = rows[0];
                        market_linker.has_change = false;
                        let market_linker_index = dirty.market_linkers.push(market_linker) - 1;

                        socket.emit('market_linker_info', { 'market_linker': dirty.market_linkers[market_linker_index] });




                    }
                }


            }
        } catch(error) {
            log(chalk.red("Error in world.changeArea: " + error));
            console.error(error);
        }
    }

    module.changeArea = changeArea;

    async function changePlanetCoordFloor(dirty, coord_index, floor_type_id) {
        try {
            if(floor_type_id <= 0 || floor_type_id === false || typeof floor_type_id === "undefined" || isNaN(floor_type_id)) {
                log(chalk.yellow("Invalid floor_type_id value sent into changePlanetCoordFloor: " + floor_type_id));
            }

            //console.log("Changing floor type id to: " + floor_type_id);
            dirty.planet_coords[coord_index].floor_type_id = floor_type_id;
            dirty.planet_coords[coord_index].has_change = true;

            // send the new planet coord info to the room
            io.to("planet_" + dirty.planet_coords[coord_index].planet_id).emit('planet_coord_info', { 'planet_coord': dirty.planet_coords[coord_index] });
        } catch(error) {
            log(chalk.red("Error in world.changePlanetCoordFloor: " + error));
        }


    }

    module.changePlanetCoordFloor = changePlanetCoordFloor;


    // Right now this function is assuming that it's being called on things the monster is supposed
    // to potentially attack
    async function checkMonsterBattleConditions(dirty, monster_id, checking_type, checking_id, socket = false) {

        try {
            //log(chalk.green("Checking monster id: " + monster_id + " against " + checking_type + " id: " + checking_id));
            let monster_index = await main.getMonsterIndex(monster_id);

            if(monster_index === -1) {
                return false;
            }

            let monster_type_index = dirty.monster_types.findIndex(function(obj) { return obj && obj.id === dirty.monsters[monster_index].monster_type_id; });

            if(monster_type_index === -1 || !dirty.monster_types[monster_type_index].auto_attack) {
                return false;
            }


            //log(chalk.cyan("Monster auto attacks"));

            // see if the monster is already attacking something
            let battle_linker_index = dirty.battle_linkers.findIndex(function(obj) { return obj && obj.attacking_id === monster_id &&
                obj.attacking_type === 'monster'; });

            // Monster is already attacking something
            if(battle_linker_index !== -1) {
                return false;
            }


            //console.log("Monster is not attacking something yet");

            let can_attack = true;

            // If the monster is trying to attack a player, make sure the player isn't on a spaceport tile
            if(checking_type === 'player') {
                let player_index = await main.getPlayerIndex({ 'player_id': checking_id});
                if(player_index !== -1) {
                    let player_coord_index = await main.getPlanetCoordIndex(
                        { 'planet_coord_id': dirty.players[player_index].planet_coord_id });

                    if(player_coord_index !== -1) {
                        if(dirty.planet_coords[player_coord_index].floor_type_id === 11) {
                            can_attack = false;
                        }
                    }
                }
            }

            if(!can_attack) {
                return false;
            }


            //console.log("Monster is not yet attacking anything. Poor " + checking_type + " ;)");

            let battle_linker_data = {
                'id': uuid(),
                'attacking_id': monster_id, 'attacking_type': 'monster', 'being_attacked_id': checking_id,
                'being_attacked_type': checking_type
            };

            if(socket !== false) {
                battle_linker_data.being_attacked_socket_id = socket.id;
            }

            let new_battle_linker_index = dirty.battle_linkers.push(battle_linker_data) - 1;

            if(socket) {
                socket.emit('battle_linker_info', { 'battle_linker': dirty.battle_linkers[new_battle_linker_index] });
            }


        } catch(error) {
            log(chalk.red("Error in world.checkMonsterBattleConditions: " + error));
        }


    }

    module.checkMonsterBattleConditions = checkMonsterBattleConditions;

    async function checkObjectBattleConditions(socket, dirty, object_id, checking_type, checking_id) {
        try {

            let object_index = await main.getObjectIndex(object_id);

            if(object_index === -1) {
                return false;
            }

            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);

            if(object_type_index === -1) {
                return false;
            }

            if(!dirty.object_types[object_type_index].can_have_rules) {
                return false;
            }

            // see if the object is already attacking something
            let battle_linker_index = dirty.battle_linkers.findIndex(function(obj) { return obj &&
                obj.attacking_id === dirty.objects[object_index].id &&
                obj.attacking_type === 'object'; });

            // Object is already attacking something
            if(battle_linker_index !== -1) {
                return false;
            }




            let player_index = -1;
            let  player_info = false;
            if(checking_type === 'player') {
                player_index = await main.getPlayerIndex({ 'player_id': checking_id });

                if(player_index === -1) {
                    log(chalk.yellow("Could not find the player"));
                    return false;
                    player_info = await world.getPlayerCoordAndRoom(dirty, player_index);

                    // If the player is on a spaceport tile, we won't be able to attack the player
                    if(player_info.coord && player_info.coord.floor_type_id === 11) {
                        return false;
                    }
                }
            }

            // get any rules that the object has
            let object_rules = dirty.rules.filter(rule => rule.object_id === dirty.objects[object_index].id);

            // Go through the rules!
            let try_attacking = false;
            for(let rule of object_rules) {


                if(checking_type === 'player' && rule.rule === "attack_all_players") {
                    try_attacking = true;
                }

                if(checking_type === 'player' && rule.rule === "attack_all_players_except_creator") {
                    if(dirty.players[player_index].id !== dirty.objects[object_index].player_id) {
                        try_attacking = true;
                    }
                }

                // TODO FACTION CHECK
            }

            if(!try_attacking) {
                return false;
            }



            let battle_linker_data = {
                'id': uuid(),
                'attacking_id': object_id, 'attacking_type': 'object', 'being_attacked_id': checking_id,
                'being_attacked_type': checking_type
            };

            if(socket !== false) {
                battle_linker_data.being_attacked_socket_id = socket.id;
            }

            let new_battle_linker_index = dirty.battle_linkers.push(battle_linker_data) - 1;

            if(socket) {
                socket.emit('battle_linker_info', { 'battle_linker': dirty.battle_linkers[new_battle_linker_index] });
            }


        } catch(error) {
            log(chalk.red("Error in world.checkObjectBattleConditions: " + error));
        }
    }

    module.checkObjectBattleConditions = checkObjectBattleConditions;


    //  data:   object_type_id   |   planet_coord_id   |   amount
    async function checkPlanetImpact(dirty, data) {

        try {

            let planet_index = -1;


            if(data.planet_coord_id) {
                let planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': parseInt(data.planet_coord_id )});
                if(planet_coord_index !== -1) {
                    planet_index = await main.getPlanetIndex({ 'planet_id': dirty.planet_coords[planet_coord_index].planet_id });
                }
            }

            if(planet_index === -1) {
                log(chalk.yellow("Was unable to find the planet"));
                return false;
            }


            // try and find a matching linker
            let linker_index = dirty.planet_type_impact_linkers.findIndex(function(obj) { return obj &&
                obj.planet_type_id === dirty.planets[planet_index].planet_type_id && obj.object_type_id === parseInt(data.object_type_id); });

            if(linker_index === -1) {
                console.log("No impact linker");
                return false;
            }


            dirty.planets[planet_index].current_hp += dirty.planet_type_impact_linkers[linker_index].hp_change;

            if(dirty.planets[planet_index].current_hp < 0) {
                dirty.planets[planet_index].current_hp = 0;
            } else if(dirty.planets[planet_index].current_hp > dirty.planets[planet_index].max_hp) {
                dirty.planets[planet_index].current_hp = dirty.planets[planet_index].max_hp;
            }
            dirty.planets[planet_index].has_change = true;


        } catch(error) {
            log(chalk.red("Error in world.checkPlanetImpact: " + error));
            console.error(error);
        }
    }

    module.checkPlanetImpact = checkPlanetImpact;

    function complexityCheck(level, complexity) {

        // If the player's surgery level is high enough, it's just gonna work
        if(level >= complexity) {
            return true;
        } else {
            let failure_max = complexity - level;
            console.log("Difference in complexity and level is: " + failure_max + ". Need our 1,10 roll higher than that to succeed");
            let rand_result = main.getRandomIntInclusive(1,10);
            console.log("Rand roll (1-10): " + rand_result);

            if(rand_result <= failure_max) {
                console.log("Rolled a: " + rand_result + ". Failed");
            } else {
                console.log("Rolled a: " + rand_result + ". Succeeded");
                return true;
            }
        }

        return false;
    }

    module.complexityCheck = complexityCheck;


    //  data:   planet_index   |   planet_type_index   |   connecting_level
    async function connectLevel(socket, dirty, data) {

        try {

            console.log("In world.connectLevel");

            if(!socket.is_admin) {
                log(chalk.red("We think a socket with player id: " + socket.player_id + " is trying to be mr hacker WOman"));
                return false;
            }




            let grid = new PF.Grid(dirty.planets[data.planet_index].x_size, dirty.planets[data.planet_index].y_size);


            // First step is to find a non-walled coord

            // and then make sure it can go to any other non walled coord

            let base_coord_index = -1;
            for(let x = 0; x < dirty.planets[data.planet_index].x_size; x++) {
                for(let y = 0; y < dirty.planets[data.planet_index].y_size; y++) {

                    let planet_coord_index = await main.getPlanetCoordIndex({ 'planet_id': dirty.planets[data.planet_index].id,
                        'planet_level': data.connecting_level, 'tile_x': x, 'tile_y': y });

                    if(base_coord_index === -1) {

                        if(planet_coord_index !== -1 && dirty.planet_coords[planet_coord_index].object_type_id !== dirty.planet_types[data.planet_type_index].wall_object_type_id) {
                            base_coord_index = planet_coord_index;
                        }
                    }

                    //grid.setWalkableAt(x, y, true);

                    if(dirty.planet_coords[planet_coord_index].object_type_id === dirty.planet_types[data.planet_type_index].wall_object_type_id) {
                        grid.setWeightAt(x, y, 10);
                    }


                }
            }

            //console.log("Our base coord tile_x/y: " + dirty.planet_coords[base_coord_index].tile_x + "/" + dirty.planet_coords[base_coord_index].tile_y);


            let finder = new PF.AStarFinder();

            let grid_backup = grid;


            for(let x = 0; x < dirty.planets[data.planet_index].x_size; x++) {
                for(let y = 0; y < dirty.planets[data.planet_index].y_size; y++) {

                    let planet_coord_index = await main.getPlanetCoordIndex({ 'planet_id': dirty.planets[data.planet_index].id,
                        'planet_level': data.connecting_level, 'tile_x': x, 'tile_y': y });


                    // See how our base coord gets to this coord
                    if(dirty.planet_coords[planet_coord_index].object_type_id !== dirty.planet_types[data.planet_type_index].wall_object_type_id &&
                        planet_coord_index !== base_coord_index) {

                        //console.log("Need to find path to " + dirty.planet_coords[planet_coord_index].tile_x + ", " + dirty.planet_coords[planet_coord_index].tile_y);

                        let path = finder.findPath(dirty.planet_coords[base_coord_index].tile_x, dirty.planet_coords[base_coord_index].tile_y,
                            dirty.planet_coords[planet_coord_index].tile_x, dirty.planet_coords[planet_coord_index].tile_y, grid);

                        //console.log(path);



                        // For any walled off tiles we went through, we need to unwall them
                        for(let p = 0; p < path.length; p++) {
                            let path_x = path[p][0];
                            let path_y = path[p][1];

                            //console.log("We went through tile_x,tile_y: " + path_x + "," + path_y);

                            let path_coord_index = await main.getPlanetCoordIndex({ 'planet_id': dirty.planets[data.planet_index].id,
                                'planet_level': data.connecting_level, 'tile_x': path_x, 'tile_y': path_y });

                            if(dirty.planet_coords[path_coord_index].object_type_id === dirty.planet_types[data.planet_type_index].wall_object_type_id) {
                                //console.log("Removing wall at tile_x/y: " + path_x + "/" + path_y);
                                dirty.planet_coords[path_coord_index].object_type_id = false;
                                dirty.planet_coords[path_coord_index].has_change = true;

                                // and update the backup grid with the new weight
                                grid_backup.setWeightAt(path_x, path_y, 1);

                            }
                        }


                        // apparently the finder modifies the grid, so we have to reset it afterward
                        grid = grid_backup.clone();
                        //grid = grid_backup;
                    }


                }
            }

        } catch(error) {
            log(chalk.red("Error in world.connectLevel: " + error));
            console.error(error);
        }
    }

    module.connectLevel = connectLevel;

    async function createFaction(socket, dirty, data) {

        try {
            let name = data.name;
            console.log("Got faction name as: " + name);
            name = main.cleanStringInput(name);

            console.log("Sanitized version: " + name);

            let player_index = await main.getPlayerIndex({'player_id': socket.player_id });

            // see if there's a matching faction name already
            let faction_index = dirty.factions.findIndex(function(obj) { return obj && obj.name === name; });

            if(faction_index !== -1) {
                socket.emit('chat', { 'message': 'A faction with that name already exists. Please try a different name', 'scope': 'system'});
                return false;
            }

            // Make sure the player isn't already part of a faction
            if(dirty.players[player_index].faction_id) {
                socket.emit('chat', { 'message': 'You will need to leave your current faction before creating one', 'scope': 'system' });
                return false;
            }


            // we can create the faction
            let sql = "INSERT INTO factions(name, player_id) VALUES(?,?)";
            let inserts = [name, dirty.players[player_index].id];

            let [result] = await (pool.query(sql, inserts));

            let new_id = result.insertId;

            console.log("Inserted new faction id: " + new_id);


            let [rows, fields] = await (pool.query("SELECT * FROM factions WHERE id = ?", [new_id]));
            if(rows[0]) {

                let new_faction_index = dirty.factions.push(rows[0]) - 1;

                socket.emit('faction_info', { 'faction': dirty.factions[new_faction_index]});

                // and have the player join!
                dirty.players[player_index].faction_id = dirty.factions[new_faction_index].id;
                dirty.players[player_index].has_change = true;
            }


        } catch(error) {
            log(chalk.red("Error in world.createFaction"));
        }

    }

    //  data:   coord_floor_type_ids   |   coord_monster_type_ids   |   coord_object_type_ids   |   level   |   tile_x
    //          tile_y
    async function createPlanetCoord(socket, dirty, data) {
        try {

            if(!socket.is_admin) {
                log(chalk.red("We think a socket with player id: " + socket.player_id + " is trying to be mr hacker man"));
                return false;
            }


            // Lets do a basic insert, and add things once we have the planet coord
            let sql = " INSERT INTO planet_coords(planet_id, level, tile_x, tile_y)VALUES(?, ? ,? ,?)";
            let inserts = [data.planet_id, data.level, data.tile_x, data.tile_y];

            let [result] = await (pool.query(sql, inserts));

            let new_id = result.insertId;

            let new_planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': new_id });

            // get a random floor
            let floor_type_id = data.coord_floor_type_ids[Math.floor(Math.random()*data.coord_floor_type_ids.length)];
            //console.log("Chose floor type id: " + floor_type_id);

            dirty.planet_coords[new_planet_coord_index].floor_type_id = floor_type_id;

            // and get more info about the floor type
            let floor_type_index = main.getFloorTypeIndex(floor_type_id);


            // We are being forced into a specific object type id ( generally a wall )
            if(data.object_type_id) {
                dirty.planet_coords[new_planet_coord_index].object_type_id = data.object_type_id;
            }

            if(floor_type_index === -1) {
                log(chalk.yellow("Don't have a floor type. data.coord_floor_type_ids was: "));
                console.log(data.coord_floor_type_ids);
                return false;
            }


            if(dirty.floor_types[floor_type_index].can_build_on && !data.object_type_id) {

                // chance for an object/object_type
                if(main.getRandomIntInclusive(1,10) === 3) {
                    //console.log("Going to put an object on this coord");
                    // get a random object type
                    let object_type_id = data.coord_object_type_ids[Math.floor(Math.random()*data.coord_object_type_ids.length)];

                    let object_type_index = main.getObjectTypeIndex(object_type_id);

                    if(object_type_index === -1) {
                        log(chalk.yellow("Could not find object_type_index for object_type_id: " + object_type_id));
                    } else {
                        if(dirty.object_types[object_type_index].assembled_as_object) {

                            // Gotta spawn an object!
                            // We don't want to pass our socket to this. If we do, insertObjectType will set everything on
                            // the planet to belong to our admin
                            let new_object_id = await world.insertObjectType(false, dirty, { 'object_type_id': dirty.object_types[object_type_index].id });
                            let new_object_index = await main.getObjectIndex(new_object_id);


                            await main.placeObject(socket, dirty, { 'object_index': new_object_index, 'planet_coord_index': new_planet_coord_index });

                        } else {
                            dirty.planet_coords[new_planet_coord_index].object_type_id = dirty.object_types[object_type_index].id;

                        }
                    }


                } else if(main.getRandomIntInclusive(1,30) === 23) {
                    //console.log("Going to set this coord to spawn a monster type");
                    let monster_type_id = data.coord_monster_type_ids[Math.floor(Math.random()*data.coord_monster_type_ids.length)];
                    dirty.planet_coords[new_planet_coord_index].spawns_monster_type_id = monster_type_id;
                }

            }


            dirty.planet_coords[new_planet_coord_index].has_change = true;


        } catch(error) {
            log(chalk.red("Error in world.createPlanetCoord: " + error));
            console.error(error);
        }
    }



    // Returns an ai_index if the AI will protect the thing passed in
    async function getAIProtector(dirty, data) {

        let ai_index = -1;
        let is_protected = false;


        if(data.monster_index) {
            // TODO code in AI's being able to protect monsters
        }
        // Checking for an object
        else if(data.object_index) {

            // Something like a ship that will directly have an ai_id
            if(dirty.objects[data.object_index].ai_id) {
                ai_index = await main.getObjectIndex(dirty.objects[data.object_index].ai_id);
            } else {

                // Check the room we are in, and if there's one, see if the rules apply to us
                if(data.coord.planet_id) {
                    let planet_index = await main.getPlanetIndex({ 'planet_id': data.coord.planet_id, 'source': 'world.getAIProtector' });
                    if(planet_index !== -1 && dirty.planets[planet_index].ai_id) {
                        ai_index = await main.getObjectIndex(dirty.planets[planet_index].ai_id);
                    }
                } else if(data.coord.ship_id) {
                    let ship_index = await main.getObjectIndex(data.coord.ship_id);
                    if(ship_index !== -1 && dirty.objects[ship_index].ai_id) {
                        ai_index = await main.getObjectIndex(dirty.objects[ship_index].ai_id);
                    }
                }

            }

            // Didn't find an AI, no use in checking rules
            if(ai_index === -1) {
                return -1;
            }

            // Now we just need to make sure there's a rule that matches our relationship to the AI
            let rules = dirty.rules.filter(rule => rule.object_id === dirty.objects[ai_index].id);

            // Plain for since we want to await in here for the potential trues
            for(let i = 0; i < rules.length; i++) {

                if(rules[i].rule === 'protect_creator_property' && dirty.objects[data.object_index].player_id === dirty.objects[ai_index].player_id) {
                    is_protected = true;
                }


            }
        } else if(data.player_index) {

            // Check the room we are in, and if there's one, see if the rules apply to us
            if(data.coord.planet_id) {
                let planet_index = await main.getPlanetIndex({ 'planet_id': data.coord.planet_id, 'source': 'world.getAIProtector - data.player_index' });
                if(planet_index !== -1 && dirty.planets[planet_index].ai_id) {
                    ai_index = await main.getObjectIndex(dirty.planets[planet_index].ai_id);
                }
            } else if(data.coord.ship_id) {
                let ship_index = await main.getObjectIndex(data.coord.ship_id);
                if(ship_index !== -1 && dirty.objects[ship_index].ai_id) {
                    ai_index = await main.getObjectIndex(dirty.objects[ship_index].ai_id);
                }
            }

            // Didn't find an AI, no use in checking rules
            if(ai_index === -1) {
                return -1;
            }

            // Now we just need to make sure there's a rule that matches our relationship to the AI
            let rules = dirty.rules.filter(rule => rule.object_id === dirty.objects[ai_index].id);

            // Plain for since we want to await in here for the potential trues
            for(let i = 0; i < rules.length; i++) {

                if(rules[i].rule === 'protect_all_players') {
                    is_protected = true;
                } else if(rules[i].rule === 'protect_creator' && dirty.players[data.player_index].id === dirty.objects[ai_index].player_id) {
                    is_protected = true;
                }

                // TODO add in support for faction support


            }
        }


        if(!is_protected) {
            return -1;
        }

        // See if there's enough energy
        if(dirty.objects[ai_index].energy < data.damage_amount) {
            return -1;
        }

        return ai_index;

    }

    module.getAIProtector = getAIProtector;

    async function getMonsterCoordAndRoom(dirty, monster_index) {

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
            log(chalk.red("Error in world.getMonsterCoordAndRoom: " + error));
            console.error(error);
        }

    }

    module.getMonsterCoordAndRoom = getMonsterCoordAndRoom;

    async function getNpcCoordAndRoom(dirty, npc_index) {

        try {

            let room = false;
            let coord_index = -1;
            let scope = false;
            let coord = false;

            if(dirty.npcs[npc_index].coord_id) {
                coord_index = await main.getCoordIndex(
                    { 'coord_id': dirty.npcs[npc_index].coord_id });
                if(coord_index !== -1) {
                    room = "galaxy";
                    scope = "galaxy";
                    coord = dirty.coords[coord_index];
                }
            }

            if(dirty.npcs[npc_index].planet_coord_id) {
                coord_index = await main.getPlanetCoordIndex(
                    { 'planet_coord_id': dirty.npcs[npc_index].planet_coord_id });
                if(coord_index !== -1) {
                    room = "planet_" + dirty.planet_coords[coord_index].planet_id;
                    scope = "planet";
                    coord = dirty.planet_coords[coord_index];
                }

            } else if(dirty.npcs[npc_index].ship_coord_id) {
                coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.npcs[npc_index].ship_coord_id });
                if(coord_index !== -1) {
                    room = "ship_" + dirty.ship_coords[coord_index].ship_id;
                    scope = "ship";
                    coord = dirty.ship_coords[coord_index];
                }
            }

            return { 'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope };
        } catch(error) {
            log(chalk.red("Error in world.getNpcCoordAndRoom: " + error));
        }

    }

    module.getNpcCoordAndRoom = getNpcCoordAndRoom;

    async function getNpcLevel(dirty, npc_index, level_type) {

        try {
            let level = 1;


            // Go through each level type!

            // Generic attacking for npcs
            if(level_type === 'attacking') {
                level = 1 + Math.floor(level_modifier * Math.sqrt(dirty.npcs[npc_index].attacking_skill_points));

            } else if(level_type === 'cooking') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.npcs[npc_index].cooking_skill_points));

            } else if(level_type === 'defense') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.npcs[npc_index].defending_skill_points));


            } else if(level_type === 'farming') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.npcs[npc_index].farming_skill_points));
            } else if(level_type === 'manufacturing') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.npcs[npc_index].manufacturing_skill_points));

            } else if(level_type === 'mining') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.npcs[npc_index].mining_skill_points));
            } else if(level_type === 'repairing') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.npcs[npc_index].repairing_skill_points));
            } else if(level_type === 'researching') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.npcs[npc_index].researching_skill_points));
            } else if(level_type === 'salvaging') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.npcs[npc_index].salvaging_skill_points));
            }


            return level;
        } catch(error) {
            log(chalk.red("Error in world.getNpcLevel: " + error));
        }

    }

    module.getNpcLevel = getNpcLevel;

    async function getObjectCoordAndRoom(dirty, object_index) {

        try {

            let room = false;
            let coord_index = -1;
            let scope = false;
            let coord = false;

            if(!dirty.objects[object_index]) {
                log(chalk.yellow("Could not find the object we are deleting. Object index: " + object_index));
                return { 'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope };
            }

            if(dirty.objects[object_index].coord_id) {
                coord_index = await main.getCoordIndex(
                    { 'coord_id': dirty.objects[object_index].coord_id });
                if(coord_index !== -1) {
                    room = "galaxy";
                    scope = "galaxy";
                    coord = dirty.coords[coord_index];
                }
            }

            if(dirty.objects[object_index].planet_coord_id) {
                coord_index = await main.getPlanetCoordIndex(
                    { 'planet_coord_id': dirty.objects[object_index].planet_coord_id });
                if(coord_index !== -1) {
                    room = "planet_" + dirty.planet_coords[coord_index].planet_id;
                    scope = "planet";
                    coord = dirty.planet_coords[coord_index];
                }

            } else if(dirty.objects[object_index].ship_coord_id) {
                coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[object_index].ship_coord_id });
                if(coord_index !== -1) {
                    room = "ship_" + dirty.ship_coords[coord_index].ship_id;
                    scope = "ship";
                    coord = dirty.ship_coords[coord_index];
                }
            }

            return { 'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope };
        } catch(error) {
            log(chalk.red("Error in world.getObjectCoordAndRoom: " + error));
            console.error(error);
            return false;
        }

    }

    module.getObjectCoordAndRoom = getObjectCoordAndRoom;


    //  data:   planet_index
    async function destroyPlanet(socket, dirty, data) {

        try {

            console.time("destroyPlanet");

            if(!socket.is_admin) {
                log(chalk.red("We think a socket with player id: " + socket.player_id + " is trying to be mr hacker man desctructo"));
                return false;
            }


            // Gotta make sure all the planet coords from the planet are in memory
            await loadEntirePlanet(dirty, { 'planet_index': data.planet_index });


            for(let i = 0; i < dirty.planet_coords.length; i++) {
                if(dirty.planet_coords[i] && dirty.planet_coords[i].planet_id === dirty.planets[data.planet_index].id) {

                    // Npcs die
                    if(dirty.planet_coords[i].npc_id) {
                        await game.deleteNpc(dirty, dirty.planet_coords[i].npc_id);
                    }


                    // Monsters die
                    if(dirty.planet_coords[i].monster_id) {
                        let monster_index = await main.getMonsterIndex(dirty.planet_coords[i].monster_id);
                        if(monster_index !== -1) {
                            await game.deleteMonster(dirty, { 'monster_index': monster_index });
                        }

                    }

                    // Objects die
                    if(dirty.planet_coords[i].object_id) {
                        //console.log("Going to kill object id: " + dirty.planet_coords[i].object_id);
                        let object_index = await main.getObjectIndex(dirty.planet_coords[i].object_id);
                        if(object_index !== -1) {
                            await game.deleteObject(dirty, { 'object_index': object_index });
                        }

                    }

                    // Players head to space
                    if(dirty.planet_coords[i].player_id) {

                        let player_index = await main.getPlayerIndex({ 'player_id': dirty.planet_coords[i].player_id });
                        if(player_index !== -1) {
                            let player_socket = world.getPlayerSocket(dirty, player_index);

                            await movement.switchToGalaxy(player_socket, dirty);
                        }

                    }

                    // LEAVE OUR MEMORY!
                    delete dirty.planet_coords[i];

                }
            }


            await (pool.query("DELETE FROM planet_coords WHERE planet_id = ?", [dirty.planets[data.planet_index].id]));

            dirty.planets[data.planet_index].ai_id = false;
            dirty.planets[data.planet_index].player_id = false;
            dirty.planets[data.planet_index].has_change = true;

            console.timeEnd("destroyPlanet");

        } catch(error) {
            log(chalk.red("Error in world.destroyPlanet: " + error));
            console.error(error);
        }
    }

    module.destroyPlanet = destroyPlanet;

    // TODO make enslaving more complicated - general goal is to make it harder for more successful npcs

    //  data:   slaver_player_index   |   slaver_npc_index   |   being_enslaved_npc_index
    async function enslave(socket, dirty, data) {
        try {


            // Base chance of 25%
            let percent_chance = 25;

            // Which will increase if the npc doesn't have all of their HP
            if(dirty.npcs[data.being_enslaved_npc_index].current_hp / dirty.npcs[data.being_enslaved_npc_index].max_hp * 100 < 25) {
                percent_chance += 25;
            }

            if(percent_chance > 100) {
                percent_chance = 100;
            }

            // now lets do our rand roll
            let rand_roll = main.getRandomIntInclusive(1,100);

            // NPC IS ENSLAVED!
            if(rand_roll <= percent_chance) {
                log(chalk.cyan("NPC IS NOW ENSLAVED"));
                if(typeof data.slaver_player_index !== 'undefined') {
                    dirty.npcs[data.being_enslaved_npc_index].enslaved_to_player_id = dirty.players[data.slaver_player_index].id;
                } else if(typeof data.slaver_npc_index !== 'undefined') {
                    dirty.npcs[data.being_enslaved_npc_index].enslaved_to_npc_id = dirty.npcs[data.slaver_npc_index].id;
                }

                dirty.npcs[data.being_enslaved_npc_index].has_change = true;
            } else {
                console.log("Enslavement did not work");
            }


        } catch(error) {
            log(chalk.red("Error in world.enslave: " + error));
            console.error(error);
        }
    }

    module.enslave = enslave;

// data:    planet_index
    async function loadEntirePlanet(dirty, data) {
        try {

            let [rows, fields] = await (pool.query("SELECT * FROM planet_coords WHERE planet_id = ? ", [dirty.planets[data.planet_index].id]));


            if(rows[0]) {

                for(let i = 0; i < rows.length; i++) {

                    let adding_planet_coord = rows[i];

                    // lets make sure we weren't retarded and don't already have it
                    let final_check_index = dirty.planet_coords.findIndex(function(obj) { return obj && obj.id === adding_planet_coord.id; });
                    if(final_check_index === -1) {
                        adding_planet_coord.has_change = false;
                        dirty.planet_coords.push(adding_planet_coord) - 1;


                    }


                }



            }
        } catch(error) {
            log(chalk.red("Error in global_functions.loadEntirePlanet: " + error));
            console.error(error);
        }
    }


    module.loadEntirePlanet = loadEntirePlanet;


    //  data:   planet_index   |   planet_type_index
    async function generatePlanet(socket, dirty, data) {
        try {

            console.time("generatePlanet");
            data.planet_index = parseInt(data.planet_index);

            if(isNaN(data.planet_index) || data.planet_index === -1 || !dirty.planets[data.planet_index]) {
                log(chalk.yellow("Bad planet_index in world.setPlanetType"));
                return false;
            }

            if(!socket.is_admin) {
                log(chalk.red("We think a socket with player id: " + socket.player_id + " is trying to be mr hacker man"));
                return false;
            }

            if(dirty.planets[data.planet_index].planet_type_id === 26) {
                log(chalk.yellow("Forming planets can't be generated. Run /setplanettype PLANET_ID PLANET_TYPE_ID first"));
                return false;
            }

            log(chalk.green("Generating planet id: " + dirty.planets[data.planet_index].id));

            for(let i = 0; i > dirty.planets[data.planet_index].lowest_depth; i--) {
                console.log("Generating planet level: " + i);
                await generatePlanetLevel(socket, dirty, { 'planet_index': data.planet_index,
                    'generating_level': i, 'planet_type_index': data.planet_type_index });


                // If we are at level 0, we need to add a spaceport
                if(i === 0) {
                    console.log("Going to build spaceport!");
                    let spaceport_start_x = Math.floor(dirty.planets[data.planet_index].x_size / 2) - 3;
                    let spaceport_start_y = Math.floor(dirty.planets[data.planet_index].y_size / 2) - 3;

                    game.buildStructure(dirty, { 'structure_type_id': 4, 'starting_level': 0,
                        'starting_tile_x': spaceport_start_x, 'starting_tile_y': spaceport_start_y,
                        'planet_id': dirty.planets[data.planet_index].id, 'is_forced': true });
                }

                // For levels lower than 0, we need stairs/hole, and to connect up the caves
                if(i < 0) {

                    console.log("Generating hole/stairs. We are working on level: " + i);

                    let level_above = i + 1;

                    let possible_hole_coords = dirty.planet_coords.filter(planet_coord =>
                        planet_coord.planet_id === dirty.planets[data.planet_index].id &&
                        planet_coord.level === level_above && !planet_coord.npc_id && !planet_coord.spawns_monster_type_id &&
                        planet_coord.floor_type_id !== 26 && planet_coord.floor_type_id !== 11 && !planet_coord.object_id);

                    let hole_coord = possible_hole_coords[Math.floor(Math.random()*possible_hole_coords.length)];

                    let stairs_coord_index = await main.getPlanetCoordIndex({ 'planet_id': dirty.planets[data.planet_index].id,
                        'planet_level': i, 'tile_x': hole_coord.tile_x, 'tile_y': hole_coord.tile_y});

                    if(stairs_coord_index === -1) {
                        log(chalk.yellow("Could not find a coord for the stairs. planet_id: " + dirty.planets[data.planet_index].id +
                            " planet_level: " + i + " tile_x,y: " + hole_coord.tile_x + "," + hole_coord.tile_y));
                    } else {
                        dirty.planet_coords[stairs_coord_index].object_type_id = 63;
                        dirty.planet_coords[stairs_coord_index].has_change = true;


                        let hole_coord_index = await main.getPlanetCoordIndex({'planet_coord_id': hole_coord.id});
                        dirty.planet_coords[hole_coord_index].object_type_id = 62;
                        dirty.planet_coords[hole_coord_index].has_change = true;



                        // A very inefficient quick fix for holes not being connected, since we are connecting the level below them.
                        // I liked having the connect level here, but I think it's gonna make sense to do it after we have the holes/stairs setup
                        /*
                        if(i + 1 < 0) {
                            let level_above = i + 1;
                            connectLevel(socket, dirty, { 'planet_index': data.planet_index,
                                'planet_type_index': data.planet_type_index, 'connecting_level': level_above });
                        }
                        connectLevel(socket, dirty, { 'planet_index': data.planet_index,
                            'planet_type_index': data.planet_type_index, 'connecting_level': i });

                        */
                    }



                }

                // and finally, we want to make sure there are at least a couple of each monster type on the level
                // Once we are done with the level, we want to make sure that it has at least 2 of a monster type
                // That can spawn on this level
                // Make sure at least two of each monster type has spawned
                for(let m = 0; m < dirty.planet_monster_linkers.length; m++) {
                    if(dirty.planet_monster_linkers[m].planet_type_id === dirty.planets[data.planet_index].planet_type_id &&
                        (   i <= dirty.planet_monster_linkers[m].highest_planet_level &&
                            i >= dirty.planet_monster_linkers[m].lowest_planet_level) )  {

                        // See how many monsters are spawned on this level
                        let current_monster_count = 0;
                        for(let p = 0; p < dirty.planet_coords.length; p++) {
                            if(dirty.planet_coords[p]) {
                                if(dirty.planet_coords[p].planet_id === dirty.planets[data.planet_index].id && dirty.planet_coords[p].level === i &&
                                    dirty.planet_coords[p].spawns_monster_type_id === dirty.planet_monster_linkers[m].monster_type_id) {
                                    current_monster_count++;
                                }
                            }

                        }

                        if(current_monster_count < 2) {

                            console.log("Default spawning of monster type id: " + dirty.planet_monster_linkers[m].monster_type_id + " was only " + current_monster_count);

                            let tries = 0;
                            while(tries < 20 && current_monster_count < 2) {
                                tries++;

                                let possible_monster_coords = dirty.planet_coords.filter(planet_coord =>
                                    planet_coord.planet_id === dirty.planets[data.planet_index].id &&
                                    planet_coord.level === i && !planet_coord.npc_id && !planet_coord.spawns_monster_type_id &&
                                    planet_coord.floor_type_id !== 26 && planet_coord.floor_type_id !== 11 && !planet_coord.object_id &&
                                    !planet_coord.object_type_id);

                                if(possible_monster_coords.length > 0) {
                                    let new_monster_coord = possible_monster_coords[Math.floor(Math.random()*possible_monster_coords.length)];
                                    let new_monster_coord_index = await main.getPlanetCoordIndex({'planet_coord_id': new_monster_coord.id});
                                    if(new_monster_coord_index !== -1) {
                                        dirty.planet_coords[new_monster_coord_index].spawns_monster_type_id = dirty.planet_monster_linkers[m].monster_type_id;
                                        dirty.planet_coords[new_monster_coord_index].has_change = true;
                                        current_monster_count++;
                                    } else {
                                        log(chalk.yellow("Could not find the planet coord we are trying to set to spawn the monster type"));
                                    }

                                } else {
                                    log(chalk.yellow("Did not find any potential planet coords to put more of this monster on"));

                                    // get a random planet coord from this level and print it out

                                    // Just for debugging
                                    let level_coords = dirty.planet_coords.filter(planet_coord => planet_coord.planet_id === dirty.planets[data.planet_index].id &&
                                        planet_coord.level === i);

                                    let random_coord = level_coords[Math.floor(Math.random()*level_coords.length)];
                                    console.log("Printing random coord on this level: ");
                                    console.log(random_coord);
                                }



                            }
                        }

                    }
                }


            }

            // Connect up all the levels
            for(let i = -1; i > dirty.planets[data.planet_index].lowest_depth; i--) {
                connectLevel(socket, dirty, { 'planet_index': data.planet_index,
                    'planet_type_index': data.planet_type_index, 'connecting_level': i });
            }

            console.timeEnd("generatePlanet");



        } catch(error) {
            log(chalk.red("Error in world.generatePlanet: " + error));
            console.error(error);
        }
    }

    module.generatePlanet = generatePlanet;


    //  data:   planet_index   |   generating_level
    async function generatePlanetLevel(socket, dirty, data) {
        try {


            if(!socket.is_admin) {
                log(chalk.red("We think a socket with player id: " + socket.player_id + " is trying to be mr hacker man"));
                return false;
            }

            let stairs_x = -1;
            let stairs_y = -1;
            let entire_map = [[],[]];


            // For levels < 0 we need to generate a cave structure
            if(data.generating_level < 0) {


                let chance_to_start_alive = 45;

                for(let x = 0; x < dirty.planets[data.planet_index].x_size; x++) {
                    for(let y = 0; y < dirty.planets[data.planet_index].y_size; y++) {

                        if (!entire_map[x]) entire_map[x] = [];

                        let random_chance = main.getRandomIntInclusive(1,100);
                        if(random_chance < chance_to_start_alive) {
                            entire_map[x][y] = true;
                        } else {
                            entire_map[x][y] = false;
                        }
                    }
                }

                entire_map = cellSimulationStep(entire_map, dirty.planets[data.planet_index].x_size, dirty.planets[data.planet_index].y_size);
                entire_map = cellSimulationStep(entire_map, dirty.planets[data.planet_index].x_size, dirty.planets[data.planet_index].y_size);


            }

            for(let x = 0; x < dirty.planets[data.planet_index].x_size; x++) {
                for(let y = 0; y < dirty.planets[data.planet_index].y_size; y++) {
                    let floor_rarity = main.rarityRoll();
                    let object_rarity = main.rarityRoll();
                    let monster_rarity = main.rarityRoll();

                    let coord_floor_type_ids = [];
                    let coord_object_type_ids = [];
                    let coord_monster_type_ids = [];

                    // grab the applicable floors
                    for(let f = 0; f < dirty.planet_floor_linkers.length; f++) {
                        if(dirty.planet_floor_linkers[f].planet_type_id === dirty.planets[data.planet_index].planet_type_id &&
                            dirty.planet_floor_linkers[f].rarity <= floor_rarity &&
                            (   data.generating_level <= dirty.planet_floor_linkers[f].highest_planet_level &&
                                data.generating_level >= dirty.planet_floor_linkers[f].lowest_planet_level) )  {

                            coord_floor_type_ids.push(dirty.planet_floor_linkers[f].floor_type_id);

                        }
                    }

                    //console.log("Coord floor type ids: ");
                    //console.log(coord_floor_type_ids);

                    // grab the applicable monsters
                    for(let m = 0; m < dirty.planet_monster_linkers.length; m++) {
                        if(dirty.planet_monster_linkers[m].planet_type_id === dirty.planets[data.planet_index].planet_type_id &&
                            dirty.planet_monster_linkers[m].rarity <= monster_rarity &&
                            (   data.generating_level <= dirty.planet_monster_linkers[m].highest_planet_level &&
                                data.generating_level >= dirty.planet_monster_linkers[m].lowest_planet_level) )  {

                            coord_monster_type_ids.push(dirty.planet_monster_linkers[m].monster_type_id);

                        }
                    }

                    // grab the applicable objects
                    for(let o = 0; o < dirty.planet_object_linkers.length; o++) {
                        if(dirty.planet_object_linkers[o].planet_type_id === dirty.planets[data.planet_index].planet_type_id &&
                            dirty.planet_object_linkers[o].rarity <= object_rarity &&
                            (   data.generating_level <= dirty.planet_object_linkers[o].highest_planet_level &&
                                data.generating_level >= dirty.planet_object_linkers[o].lowest_planet_level) )  {

                            coord_object_type_ids.push(dirty.planet_object_linkers[o].object_type_id);

                        }
                    }

                    let coord_data = {};
                    coord_data.planet_id = dirty.planets[data.planet_index].id;
                    coord_data.level = data.generating_level;
                    coord_data.tile_x = x;
                    coord_data.tile_y = y;
                    coord_data.coord_floor_type_ids = coord_floor_type_ids;
                    coord_data.coord_monster_type_ids = coord_monster_type_ids;
                    coord_data.coord_object_type_ids = coord_object_type_ids;

                    // We are going to force a wall here
                    if(data.generating_level < 0 && entire_map[x][y] === true) {
                        coord_data.object_type_id = dirty.planet_types[data.planet_type_index].wall_object_type_id;
                    }

                    await createPlanetCoord(socket, dirty, coord_data);

                }
            }



        } catch(error) {
            log(chalk.red("Error in world.generatePlanetLevel: " + error));
            console.error(error);
        }
    }

    module.generatePlanetLevel = generatePlanetLevel;

    function cellCountNeighbors(entire_map, x, y , x_size, y_size) {
        try {

            let count = 0;

            for(let i = -1; i < 2; i++) {
                for(let j = -1; j < 2; j++) {
                    let near_x = x + i;
                    let near_y = y + j;

                    // our point
                    if(i === 0 && j === 0) {

                    }
                    // A point off the map
                    else if(near_x < 0 || near_y < 0 || near_x >= x_size || near_y >= y_size) {
                        count++;
                    } else if(entire_map[near_x][near_y] === true) {
                        count++;
                    }
                }
            }


            return count;

        } catch(error) {
            log(chalk.red("Error in world.cellCountNeighbors: " + error));
            console.error(error);
        }
    }

    function cellSimulationStep(old_map, x_size, y_size) {
        try {

            let birth_limit = 4;
            let death_limit = 3;

            let new_map = old_map;


            for(let x = 0; x < x_size; x++) {
                for(let y = 0; y < y_size; y++) {
                    let near_alive_count = cellCountNeighbors(old_map, x, y, x_size, y_size);

                    if(old_map[x][y] === true && near_alive_count < death_limit) {

                        new_map[x][y] = false;

                    } else if(near_alive_count > birth_limit) {
                        new_map[x][y] = true;
                    }
                }
            }

            return new_map;

        } catch(error) {
            log(chalk.red("Error in cellSimulationStep: " + error));
            console.error(error);
        }
    }

    async function generateShip(dirty, ship_index) {
        try {

            // lets get the ship linkers
            let ship_linkers = dirty.ship_linkers.filter(linker => linker.ship_type_id === dirty.objects[ship_index].object_type_id);

            for(let linker of ship_linkers) {

                let sql = "";
                let inserts = [];

                let linker_object_type_index = -1;
                if(linker.object_type_id) {
                    linker_object_type_index = main.getObjectTypeIndex(linker.object_type_id);

                }


                if(linker.spawns_monster_type_id) {
                    sql = "INSERT INTO ship_coords(ship_id, tile_x, tile_y, object_type_id, floor_type_id, spawns_monster_type_id) VALUES(?,?,?,?,?,?)";
                    inserts = [dirty.objects[ship_index].id, linker.position_x, linker.position_y, linker.object_type_id, linker.floor_type_id,
                        linker.spawns_monster_type_id];

                } else {

                    sql = "INSERT INTO ship_coords(ship_id, tile_x, tile_y, object_type_id, floor_type_id) VALUES(?,?,?,?,?)";
                    inserts = [dirty.objects[ship_index].id, linker.position_x, linker.position_y, linker.object_type_id, linker.floor_type_id];


                }


                let [result] = await (pool.query(sql, inserts));

                // Get the ID of the inserted ship coord
                let new_ship_coord_id = result.insertId;
                let new_ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': new_ship_coord_id });

                // We have a monster that we need to create, and add to the ship coord
                if(linker.spawns_monster_type_id || linker.monster_type_id) {
                    let spawn_data = {};
                    spawn_data.ship_coord_id = new_ship_coord_id;
                    if(linker.spawns_monster_type_id) {
                        spawn_data.monster_type_id = linker.spawns_monster_type_id;
                    } else if(linker.monster_type_id) {
                        spawn_data.monster_type_id = linker.monster_type_id;
                    }


                    world.spawnMonster(dirty, spawn_data);
                }

                if(linker_object_type_index !== -1 && dirty.object_types[linker_object_type_index].assembled_as_object) {

                    // Gotta spawn an object!
                    let new_object_id = await world.insertObjectType(socket, dirty, { 'object_type_id': dirty.object_types[linker_object_type_index].id });
                    let new_object_index = await main.getObjectIndex(new_object_id);


                    await main.placeObject(socket, dirty, { 'object_index': new_object_index, 'ship_coord_index': new_ship_coord_index });
                }


            }
        } catch(error) {
            log(chalk.red("Error in game.generateShip: " + error));
        }
    }

    module.generateShip = generateShip;

    async function getPlayerCoordAndRoom(dirty, player_index) {

        try {

            let room = false;
            let coord_index = -1;
            let scope = false;
            let coord = false;

            if(dirty.players[player_index].coord_id) {
                coord_index = await main.getCoordIndex(
                    { 'coord_id': dirty.players[player_index].coord_id });
                if(coord_index !== -1) {
                    room = "galaxy";
                    scope = "galaxy";
                    coord = dirty.coords[coord_index];
                }
            }

            if(dirty.players[player_index].planet_coord_id) {
                coord_index = await main.getPlanetCoordIndex(
                    { 'planet_coord_id': dirty.players[player_index].planet_coord_id });
                if(coord_index !== -1) {
                    room = "planet_" + dirty.planet_coords[coord_index].planet_id;
                    scope = "planet";
                    coord = dirty.planet_coords[coord_index];
                }

            } else if(dirty.players[player_index].ship_coord_id) {
                coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.players[player_index].ship_coord_id });
                if(coord_index !== -1) {
                    room = "ship_" + dirty.ship_coords[coord_index].ship_id;
                    scope = "ship";
                    coord = dirty.ship_coords[coord_index];
                }
            }

            return { 'room': room, 'coord_index': coord_index, 'coord': coord, 'scope': scope };
        } catch(error) {
            log(chalk.red("Error in world.getPlayerCoordAndRoom: " + error));
        }

    }

    module.getPlayerCoordAndRoom = getPlayerCoordAndRoom;

    // player_index   |   body_index   |   skill_type   |   scope
    async function getPlayerLevel(dirty, data) {

        try {
            let level = 1;

            let body_index = -1;
            let body_type_index = -1;

            let ship_index = -1;
            let ship_type_index = -1;

            if(!data.scope || data.scope !== 'galaxy') {

                if(data.body_index) {
                    body_index = data.body_index;
                } else {
                    body_index = await main.getObjectIndex(dirty.players[data.player_index].body_id);

                    if(body_index === -1) {
                        log(chalk.yellow("Could not get a body for the player"));
                        return false;
                    }
                }


                body_type_index = main.getObjectTypeIndex(dirty.objects[body_index].object_type_id);
            }

            if(!data.scope || data.scope === 'galaxy') {
                ship_index = await main.getObjectIndex(dirty.players[data.player_index].ship_id);

                if(ship_index === -1) {
                    log(chalk.yellow("Could not get a ship for the player"));
                    return false;
                }


                ship_type_index = main.getObjectTypeIndex(dirty.objects[ship_index].object_type_id);

            }

            // Go through each level type!
            if(data.skill_type === 'cooking') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.players[data.player_index].cooking_skill_points));



            } else if(data.skill_type === 'defense') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.players[data.player_index].defending_skill_points));

                if(body_type_index !== -1 && dirty.object_types[body_type_index].defense_modifier) {
                    level += dirty.object_types[body_type_index].defense_modifier;
                }

                if(ship_type_index !== -1 && dirty.object_types[ship_type_index].defense_modifier) {
                    level += dirty.object_types[ship_type_index].defense_modifier;
                }

            } else if(data.skill_type === 'farming') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.players[data.player_index].farming_skill_points));
            } else if(data.skill_type === 'hacking') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.players[data.player_index].hacking_skill_points));
            }
            else if(data.skill_type === 'manufacturing') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.players[data.player_index].manufacturing_skill_points));

                if(ship_type_index !== -1 && dirty.object_types[ship_type_index].manufacturing_modifier) {
                    level += dirty.object_types[ship_type_index].manufacturing_modifier;
                }

                if(body_type_index !== -1 && dirty.object_types[body_type_index].manufacturing_modifier) {
                    level += dirty.object_types[body_type_index].manufacturing_modifier;
                }

            } else if(data.skill_type === 'melee') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.players[data.player_index].melee_skill_points));
            } else if(data.skill_type === 'mining') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.players[data.player_index].mining_skill_points));


                if(ship_type_index !== -1 && dirty.object_types[ship_type_index].mining_modifier) {
                    level += dirty.object_types[ship_type_index].mining_modifier;
                }


                // Body could help too
                if(body_type_index !== -1 && dirty.object_types[body_type_index].mining_modifier) {
                    level += dirty.object_types[body_type_index].mining_modifier;
                }

            } else if(data.skill_type === 'repairing') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.players[data.player_index].repairing_skill_points));
            } else if(data.skill_type === 'researching') {
                level = 1 + Math.floor(global.difficult_level_modifier * Math.sqrt(dirty.players[data.player_index].researching_skill_points));
            } else if(data.skill_type === 'salvaging') {
                level = 1 + Math.floor(global.level_modifier * Math.sqrt(dirty.players[data.player_index].salvaging_skill_points));
            }


            return level;
        } catch(error) {
            log(chalk.red("Error in world.getPlayerLevel: " + error));
        }

    }

    module.getPlayerLevel = getPlayerLevel;

    function getPlayerSocket(dirty, player_index) {

        try {

            let returning_socket = false;

            for(let id of Object.keys(io.sockets.sockets)) {

                //socket = io.sockets.connected[id];
                if(io.sockets.connected[id].player_id === dirty.players[player_index].id) {
                    //console.log("Returning found socket");
                    returning_socket = io.sockets.connected[id];
                }
            }

            return returning_socket;
        } catch(error) {
            log(chalk.red("Error in world.getPlayerSocket: " + error));
        }



    }

    module.getPlayerSocket = getPlayerSocket;

    async function increaseNpcSkill(dirty, npc_index, skill_types) {


        try {


            for(let i = 0; i < skill_types.length; i++ ) {

                if(skill_types[i]) {

                    if(skill_types[i] === 'control') {
                        dirty.npcs[npc_index].control_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    } else if(skill_types[i] === 'cooking') {
                        dirty.npcs[npc_index].cooking_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    } else if(skill_types[i] === 'defending') {
                        dirty.npcs[npc_index].defending_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    } else if(skill_types[i] === 'farming') {
                        dirty.npcs[npc_index].farming_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    } else if(skill_types[i] === 'hacking') {
                        dirty.npcs[npc_index].hacking_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    } else if(skill_types[i] === 'manufacturing') {
                        dirty.npcs[npc_index].manufacturing_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    } else if(skill_types[i] === 'melee') {
                        dirty.npcs[npc_index].melee_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    } else if(skill_types[i] === 'researching') {
                        dirty.npcs[npc_index].researching_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    } else if(skill_types[i] === 'surgery') {
                        dirty.npcs[npc_index].surgery_skill_points++;
                        dirty.npcs[npc_index].has_change = true;
                    }
                }
            }


        } catch(error) {
            log(chalk.red("Error in increaseNpcSkill: " + error));
            console.error(error);
        }



    }
    module.increaseNpcSkill = increaseNpcSkill;


    async function increasePlayerSkill(socket, dirty, player_index, skill_types) {


        try {

            //console.log("In world.increasePlayerSkill. Skill types: ");
            //console.log(skill_types);

            for(let i = 0; i < skill_types.length; i++ ) {

                if(skill_types[i]) {

                    if(skill_types[i] === 'control') {
                        dirty.players[player_index].control_skill_points++;
                        dirty.players[player_index].has_change = true;
                    } else if(skill_types[i] === 'cooking') {
                        dirty.players[player_index].cooking_skill_points++;
                        dirty.players[player_index].has_change = true;
                    } else if(skill_types[i] === 'defending') {
                        dirty.players[player_index].defending_skill_points++;
                        dirty.players[player_index].has_change = true;
                    } else if(skill_types[i] === 'farming') {
                        dirty.players[player_index].farming_skill_points++;
                        dirty.players[player_index].has_change = true;
                    } else if(skill_types[i] === 'hacking') {
                        dirty.players[player_index].hacking_skill_points++;
                        dirty.players[player_index].has_change = true;
                    } else if(skill_types[i] === 'manufacturing') {
                        dirty.players[player_index].manufacturing_skill_points++;
                        dirty.players[player_index].has_change = true;
                    } else if(skill_types[i] === 'melee') {
                        dirty.players[player_index].melee_skill_points++;
                        dirty.players[player_index].has_change = true;
                    } else if(skill_types[i] === 'researching') {
                        dirty.players[player_index].researching_skill_points++;
                        dirty.players[player_index].has_change = true;
                    } else if(skill_types[i] === 'surgery') {
                        dirty.players[player_index].surgery_skill_points++;
                        dirty.players[player_index].has_change = true;
                    }
                }
            }




            /*
            if(skill_type === 'attacking') {
                //console.log("Increasing skill related to player attacking at a distance of: " + calculating_range);

                // TODO     eventually we need some sort of system that limits someone equipping all different types of
                // TODO     systems. Well, I guess we should.
                let laser_skill_increases = false;
                let plasma_skill_increases = false;
                let melee_skill_increases = false;

                if(calculating_range === 1) {
                    melee_skill_increases = true;
                }

                // lets get the equipment that could have attacked
                // find the player attack at this range
                dirty.equipment_linkers.forEach(function(equipment_linker, i) {
                    if(equipment_linker.player_id === dirty.players[player_index].id) {
                        let object_type_index = dirty.object_types.findIndex(function(obj) { return obj && obj.id === equipment_linker.object_type_id; });
                        if(object_type_index !== -1) {
                            // see if the object attack is in this range
                            if(dirty.object_types[object_type_index].min_attack_range <= calculating_range && dirty.object_types[object_type_index].max_attack_range >= calculating_range) {


                                if(dirty.object_types[object_type_index].equip_skill === 'laser') {
                                    laser_skill_increases = true;
                                }

                                if(dirty.object_types[object_type_index].equip_skill === 'plasma') {
                                    plasma_skill_increases = true;

                                } else if(dirty.object_types[object_type_index].equip_skill === 'melee') {
                                    dirty.players[player_index].melee_skill_points++;
                                    dirty.players[player_index].has_change = true;
                                }

                            }
                        }
                    }
                });

                if(laser_skill_increases) {
                    dirty.players[player_index].laser_skill_points++;
                    dirty.players[player_index].has_change = true;
                }

                if(plasma_skill_increases) {
                    dirty.players[player_index].plasma_skill_points++;
                    dirty.players[player_index].has_change = true;
                }

                if(melee_skill_increases) {
                    dirty.players[player_index].melee_skill_points++;
                    dirty.players[player_index].has_change = true;
                }

            } else if(skill_type === 'defending') {
                //console.log("Increasing skill related to player defending ");
                dirty.players[player_index].defending_skill_points++;
                dirty.players[player_index].has_change = true;

            } else if(skill_type === 'cooking') {
                dirty.players[player_index].cooking_skill_points++;
                dirty.players[player_index].has_change = true;

            } else if(skill_type === 'farming') {
                dirty.players[player_index].farming_skill_points++;
                dirty.players[player_index].has_change = true;

            } else if(skill_type === 'manufacturing') {
                dirty.players[player_index].manufacturing_skill_points++;
                dirty.players[player_index].has_change = true;
            } else if(skill_type === 'researching') {
                dirty.players[player_index].researching_skill_points++;
                dirty.players[player_index].has_change = true;
            } else if(skill_type === 'surgery') {
                dirty.players[player_index].surgery_skill_points++;
                dirty.players[player_index].has_change = true;
            }


            */

            socket.emit('player_info', { 'player': dirty.players[player_index] });


        } catch(error) {
            log(chalk.red("Error in increasePlayerSkill: " + error));
            console.error(error);
        }



    }
    module.increasePlayerSkill = increasePlayerSkill;

    // object_type_id   |   player_id   |   npc_id   |   spawned_event_id
    // in an effort to specialize this function we only take in the object_type_id, insert it, and return the new object.
    // associating with coords is done elsewhere
    async function insertObjectType(socket, dirty, data) {
        try {

            if(!data.object_type_id) {
                log(chalk.yellow("No object_type_id passed into world.insertObjectType"));
                if(data.source) {
                    log(chalk.yellow("Source: " + data.source));
                }
                return false;
            }

            //console.log("in insertObjectType. Going to insert object_type_id: " + data.object_type_id);

            let object_type_index = dirty.object_types.findIndex(function (obj) { return obj && obj.id === data.object_type_id; });

            if(object_type_index === -1) {
                log(chalk.yellow("Could not find object type"));
                return false;
            }




            // we need to create an object
            let sql;
            let inserts;

            //
            let npc_id = false;
            let player_id = false;
            if(socket !== false) {
                player_id = socket.player_id;
            } else if(data.player_id) {
                player_id = data.player_id;
            }

            if(data.npc_id) {
                npc_id = data.npc_id;
            }

            let spawned_event_id = false;
            if(data.spawned_event_id) {
                spawned_event_id = data.spawned_event_id;
            }

            //console.log("In insert object type. spawned_event_id: " + spawned_event_id);


            // lets have a base object type insert - and add/change things based on unique attributes of that object type

            sql = "INSERT INTO objects(object_type_id,current_hp,spawned_event_id)VALUES(?,?,?)";
            inserts = [dirty.object_types[object_type_index].id, dirty.object_types[object_type_index].hp,
                 spawned_event_id];


            let [result] = await (pool.query(sql, inserts));


            if(!result) {
                log(chalk.yellow("Seems like we failed the object insert"));
                return false;
            }


            let object_id = result.insertId;
            //console.log("Did object insert. Got object_id: " + object_id);

            // we really should make sure that we add the object into dirty here I think
            let object_index = await main.getObjectIndex(object_id);

            if(npc_id !== false) {
                dirty.objects[object_index].npc_id = npc_id;
                dirty.objects[object_index].has_change = true;
            }

            if(player_id !== false) {
                dirty.objects[object_index].player_id = player_id;
                dirty.objects[object_index].has_change = true;
            }

            if(dirty.object_types[object_type_index].spawns_object_type_id) {

                dirty.objects[object_index].spawns_object = true;
                dirty.objects[object_index].has_change = true;

                if(dirty.object_types[object_type_index].spawns_object_type_on_create) {
                    dirty.objects[object_index].has_spawned_object = true;
                    dirty.objects[object_index].spawned_object_type_amount = dirty.object_types[object_type_index].spawns_object_type_amount;
                    dirty.objects[object_index].has_change = true;
                }
            }

            if(dirty.object_types[object_type_index].is_ship) {
                await generateShip(dirty, object_index);

                if(dirty.object_types[object_type_index].needs_engines) {
                    await attachShipEngines(dirty, object_index);
                }

                //await main.getShipCoords(object_id);
            }

            if(dirty.object_types[object_type_index].max_energy_storage && dirty.object_types[object_type_index].max_energy_storage > 1) {
                dirty.objects[object_index].energy = dirty.object_types[object_type_index].max_energy_storage;
                dirty.objects[object_index].has_change = true;
            }



            return object_id;


        } catch(error) {
            log(chalk.red("Error in world.insertObjectType: " + error));
            console.error(error);
        }
    }
    module.insertObjectType = insertObjectType;



    // When pulling from MySQL, nodejs doesn't like seeing numbers as ints sometimes
    function processInventoryItem(dirty, index) {
        dirty.inventory_items[index].id = parseInt(dirty.inventory_items[index].id);

        if(dirty.inventory_items[index].player_id) {
            dirty.inventory_items[index].player_id = parseInt(dirty.inventory_items[index].player_id);
        }

        if(dirty.inventory_items[index].npc_id) {
            dirty.inventory_items[index].npc_id = parseInt(dirty.inventory_items[index].npc_id);
        }

        if(dirty.inventory_items[index].owned_by_object_id) {
            dirty.inventory_items[index].owned_by_object_id = parseInt(dirty.inventory_items[index].owned_by_object_id);
        }
    }

    module.processInventoryItem = processInventoryItem;

    async function objectFindTarget(dirty, object_index) {
        try {
            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);

            // Only do all this for object types with attack strength
            // TODO we need a better colum in our database for this. Something like object_types.auto_attack or something. Or
            // TODO attack_on_creation. SOMETHING

            if(!dirty.object_types[object_type_index].attack_strength) {
                return;
            }

            let coord_index = -1;
            let starting_x = false;
            let starting_y = false;

            // object could be on a planet coord, or a ship coord
            if(dirty.objects[object_index].planet_coord_id) {
                coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.objects[object_index].planet_coord_id });

                if(coord_index === -1) {
                    return false;
                }

                starting_x = dirty.planet_coords[coord_index].tile_x - 4;
                starting_y = dirty.planet_coords[coord_index].tile_y - 3;

            } else if(dirty.objects[object_index].ship_coord_id) {
                coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[object_index].ship_coord_id });

                if(coord_index === -1) {
                    return false;
                }

                starting_x = dirty.ship_coords[coord_index].tile_x - 4;
                starting_y = dirty.ship_coords[coord_index].tile_y - 3;
            }


            let sent_battle_target = false;

            for(let i = starting_x; i <= starting_x + 8; i++) {
                for(let j = starting_y; j <= starting_y + 6; j++) {

                    if(sent_battle_target) {
                        return;
                    }

                    let checking_coord_index = -1;
                    let temp_coord = false;

                    if(dirty.objects[object_index].planet_coord_id) {
                        let planet_coord_data = { 'planet_id': dirty.planet_coords[coord_index].planet_id, 'planet_level': dirty.planet_coords[coord_index].level,
                            'tile_x': i, 'tile_y': j };
                        checking_coord_index = await main.getPlanetCoordIndex(planet_coord_data);

                        if(checking_coord_index !== -1) {
                            temp_coord = dirty.planet_coords[checking_coord_index];
                        }
                    } else if(dirty.objects[object_index].ship_coord_id) {
                        let ship_coord_data = { 'ship_id': dirty.ship_coords[coord_index].planet_id,
                            'tile_x': i, 'tile_y': j };
                        checking_coord_index = await main.getShipCoordIndex(ship_coord_data);

                        if(checking_coord_index !== -1) {
                            temp_coord = dirty.ship_coords[checking_coord_index];
                        }
                    }

                    if(temp_coord) {

                        // There's an object! See if we attack it!
                        // Currently we attack objects that are owned by a player, but not part of our faction, or us
                        if(temp_coord.object_id) {
                            let checking_object_index = await main.getObjectIndex(temp_coord.object_id);

                            if(checking_object_index !== -1) {

                                if(dirty.objects[checking_object_index].faction_id &&
                                    dirty.objects[checking_object_index].faction_id !== dirty.objects[object_index].faction_id) {

                                    let battle_linker_data = {
                                        'attacking_id': dirty.objects[object_index].id, 'attacking_type': 'object',
                                        'being_attacked_id': dirty.objects[checking_object_index].id, 'being_attacked_type': 'object' };

                                    world.addBattleLinker(false, dirty, battle_linker_data);

                                    sent_battle_target = true;

                                } else if(dirty.objects[checking_object_index].player_id &&
                                    dirty.objects[checking_object_index].player_id !== dirty.objects[object_index].player_id) {

                                    let battle_linker_data = {
                                        'attacking_id': dirty.objects[object_index].id, 'attacking_type': 'object',
                                        'being_attacked_id': dirty.objects[checking_object_index].id, 'being_attacked_type': 'object' };

                                    world.addBattleLinker(false, dirty, battle_linker_data);

                                    sent_battle_target = true;
                                }
                            }
                        }

                        // There's a player! See if we attack it
                        if(temp_coord.player_id) {
                            let checking_player_index = await main.getPlayerIndex({ 'player_id': dirty.objects[object_index].player_id });

                            if(checking_player_index !== -1) {
                                if(dirty.players[checking_player_index].faction_id &&
                                    dirty.players[checking_player_index].faction_id !== dirty.objects[object_index].faction_id) {

                                    let battle_linker_data = {
                                        'attacking_id': dirty.objects[object_index].id, 'attacking_type': 'object',
                                        'being_attacked_id': dirty.players[checking_player_index].id, 'being_attacked_type': 'player' };

                                    world.addBattleLinker(false, dirty, battle_linker_data);

                                    sent_battle_target = true;

                                } else if(dirty.players[checking_player_index].player_id &&
                                    dirty.players[checking_player_index].player_id !== dirty.objects[object_index].player_id) {

                                    let battle_linker_data = {
                                        'attacking_id': dirty.objects[object_index].id, 'attacking_type': 'object',
                                        'being_attacked_id': dirty.players[checking_player_index].id, 'being_attacked_type': 'player' };

                                    world.addBattleLinker(false, dirty, battle_linker_data);

                                    sent_battle_target = true;
                                }
                            }
                        }

                    }

                }
            }

        } catch(error) {
            log(chalk.red("Error in game.objectFindTarget: " + error));
        }
    }
    module.objectFindTarget = objectFindTarget;


    //  battle_linker_id   |   monster_id   |   npc_id   |   object_id   |   player_id
    function removeBattleLinkers(dirty, data) {

        try {
            // Just removing one battle linker
            if(data.battle_linker_id) {
                let battle_linker_index = main.getBattleLinkerIndex(data.battle_linker_id);

                if(battle_linker_index === -1) {
                    return false;
                }

                //console.log("Sending remove battle linker id: " + dirty.battle_linkers[battle_linker_index].id);

                if(dirty.battle_linkers[battle_linker_index].socket_id) {
                    io.to(dirty.battle_linkers[battle_linker_index].socket_id).emit('battle_linker_info',
                        { 'remove': true, 'battle_linker': dirty.battle_linkers[battle_linker_index] });
                }

                if(dirty.battle_linkers[battle_linker_index].being_attacked_socket_id) {
                    io.to(dirty.battle_linkers[battle_linker_index].being_attacked_socket_id).emit('battle_linker_info',
                        { 'remove': true, 'battle_linker': dirty.battle_linkers[battle_linker_index] });
                }


                delete dirty.battle_linkers[battle_linker_index];
            }
            // Removing all of one type
            else {

                // Sent in a monster, npc, object, or player id. So we remove all of that type
                dirty.battle_linkers.forEach(function(battle_linker, i) {

                    let remove_battle_linker = false;

                    if(data.monster_id) {
                        //console.log("In removeBattleLinkers for monster id: " + data.monster_id);
                        if(
                            (battle_linker.attacking_type === 'monster' && battle_linker.attacking_id === data.monster_id) ||
                            (battle_linker.being_attacked_type === 'monster' && battle_linker.being_attacked_id === data.monster_id)
                        ) {
                            //log(chalk.cyan("Removing battle linker with monster"));
                            remove_battle_linker = true;

                        }
                    }

                    if(data.npc_id) {
                        if(
                            (battle_linker.attacking_type === 'npc' && battle_linker.attacking_id === data.npc_id) ||
                            (battle_linker.being_attacked_type === 'npc' && battle_linker.being_attacked_id === data.npc_id)
                        ) {
                            //log(chalk.cyan("Removing battle linker with npc"));
                            remove_battle_linker = true;

                        }
                    }

                    if(data.object_id) {
                        if(
                            (battle_linker.attacking_type === 'object' && battle_linker.attacking_id === data.object_id) ||
                            (battle_linker.being_attacked_type === 'object' && battle_linker.being_attacked_id === data.object_id)
                        ) {
                            //log(chalk.cyan("Removing battle linker with object"));
                            remove_battle_linker = true;

                        }
                    }

                    if(data.player_id) {
                        //console.log("In removeBattleLinkers for player id: " + data.player_id);

                        if(
                            (battle_linker.attacking_type === 'player' && battle_linker.attacking_id === data.player_id) ||
                            (battle_linker.being_attacked_type === 'player' && battle_linker.being_attacked_id === data.player_id)
                        ) {
                            //log(chalk.cyan("Removing battle linker with player"));
                            remove_battle_linker = true;
                        }
                    }


                    if(remove_battle_linker) {

                        if(battle_linker.socket_id) {
                            //console.log("Sending to socket_id");
                            io.to(battle_linker.socket_id).emit('battle_linker_info', { 'remove': true, 'battle_linker': battle_linker });
                        }

                        if(battle_linker.being_attacked_socket_id) {
                            //console.log("Sending to being_attacked_socket_id");
                            io.to(battle_linker.being_attacked_socket_id).emit('battle_linker_info', { 'remove': true, 'battle_linker': battle_linker });
                        }

                        delete dirty.battle_linkers[i];
                    }

                });
            }

        } catch(error) {
            log(chalk.red("Error in world.removeBattleLinkers: " + error));
        }

    }

    module.removeBattleLinkers = removeBattleLinkers;

    // data:    planet_coord_id     |   ship_coord_id
    async function sendAreas(socket, room, dirty, data) {

        try {

            let planet_coord_index = -1;
            let ship_coord_index = -1;

            if(data.planet_coord_id) {
                let planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': parseInt(data.planet_coord_id) });
                if(planet_coord_index === -1) {
                    return false;
                }

            }

            if(data.ship_coord_id) {
                let ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': parseInt(data.ship_coord_id) });
                if(ship_coord_index === -1) {
                    return false;
                }
            }

            for(let i = 0; i < dirty.areas.length; i++) {
                if(dirty.areas[i]) {
                    if( (planet_coord_index !== -1 && dirty.planet_coords[planet_coord_index].planet_id === dirty.areas[i].planet_id) ||
                        (ship_coord_index !== -1 && dirty.ship_coords[ship_coord_index].ship_id === dirty.areas[i].ship_id)
                    ) {
                        if(socket) {
                            socket.emit('area_info', { 'area': dirty.areas[i] });
                        }

                        if(room) {
                            socket.emit('area_info', { 'area': dirty.areas[i] });
                        }
                    }
                }

            }

        } catch(error) {
            log(chalk.red("Error in world.sendAreas: " + error));
            console.error(error);
        }
    }

    module.sendAreas = sendAreas;

    function sendActiveSalvaging(socket, room, dirty, active_salvaging_index, remove = false) {
        try {

            // remove the index stuff before we send it
            let temp_salvaging = { 'id': dirty.active_salvagings[active_salvaging_index].id,
                'player_id': dirty.active_salvagings[active_salvaging_index].player_id,
                'object_id': dirty.active_salvagings[active_salvaging_index].object_id,
                'hp_left': dirty.active_salvagings[active_salvaging_index].hp_left };



            if(socket) {
                if(remove === true) {
                    socket.emit('salvaging_linker_info', { 'salvaging_linker': temp_salvaging,
                        'remove': true });
                } else {
                    socket.emit('salvaging_linker_info', { 'salvaging_linker': temp_salvaging });
                }

            }

            if(room) {
                if(remove === true) {
                    io.to(room).emit('salvaging_linker_info', { 'salvaging_linker': temp_salvaging, 'remove': true });
                } else {
                    io.to(room).emit('salvaging_linker_info', { 'salvaging_linker': temp_salvaging });
                }
            }

        } catch(error) {
            log(chalk.red("Error in world.sendActiveSalvaging: " + error));
        }
    }

    module.sendActiveSalvaging = sendActiveSalvaging;


    // ship_coord_index   OR   ship_coord_id
    async function sendCoordInfo(socket, room, dirty, data) {

        try {
            let coord_index = -1;

            if(data.coord_index) {
                coord_index = data.coord_index;
            } else if(data.coord_id) {
                coord_index = await main.getCoordIndex({ 'coord_id': data.coord_id });
            }

            if(coord_index === -1) {
                return false;
            }

            if(socket) {
                socket.emit('coord_info', { 'coord': dirty.coords[coord_index] });
            }

            if(room) {
                io.to(room).emit('coord_info', { 'coord': dirty.coords[coord_index] });
            }

        } catch(error) {
            log(chalk.red("Error in world.sendCoordInfo: " + error));
        }

    }

    module.sendCoordInfo = sendCoordInfo;



    async function sendMarketData(socket, dirty) {

        try {

            console.log("Socket is requesting market data");
            let planet_coord_index = -1;
            let ship_coord_index = -1;

            if(dirty.players[socket.player_index].planet_coord_id) {
                planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.players[socket.player_index].planet_coord_id });

                if(planet_coord_index === -1) {
                    return false;
                }


            } else if(dirty.players[socket.player_index].ship_coord_id) {
                ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.players[socket.player_index].ship_coord_id });

                if(ship_coord_index === -1) {
                    return false;
                }

            }

            for(let i = 0; i < dirty.market_linkers.length; i++) {
                if(dirty.market_linkers[i] &&
                    (planet_coord_index !== -1 && ( dirty.market_linkers[i].planet_id === dirty.planet_coords[planet_coord_index].planet_id ) ||
                    (ship_coord_index !== -1 && dirty.market_linkers[i].ship_id === dirty.planet_coords[planet_coord_index].ship_id ) ) ) {

                    console.log("Sending information for market linker id: " + dirty.market_linkers[i].id);

                    // Gotta send area info, bid linkers, and then the market linker info
                    let area_index = await main.getAreaIndex({ 'area_id': dirty.market_linkers[i].area_id });

                    if(area_index !== -1) {
                        socket.emit('area_info', { 'area': dirty.areas[area_index] });

                        for(let b = 0; b < dirty.bid_linkers.length; b++) {
                            if(dirty.bid_linkers[b] && dirty.bid_linkers[b].area_id === dirty.areas[area_index].id) {
                                socket.emit('bid_linker_info', { 'bid_linker': dirty.bid_linkers[b] });
                            }
                        }
                    }


                    socket.emit('market_linker_info', {'market_linker': dirty.market_linkers[i]});
                }
            }

        } catch(error) {
            log(chalk.red("Error in world.sendMarketData: " + error));
            console.error(error);
        }
    }

    module.sendMarketData = sendMarketData;

    // monster_index   OR   monster_id
    async function sendMonsterInfo(socket, room, dirty, data) {

        try {
            let monster_index = -1;

            if(data.monster_index) {
                monster_index = data.monster_index;
            } else if(data.monster_id) {
                monster_index = await main.getMonsterIndex(data.monster_id);
            }

            if(monster_index !== -1) {
                if(socket) {
                    socket.emit('monster_info', { 'monster': dirty.monsters[monster_index] });
                }

                if(room) {
                    io.to(room).emit('monster_info', { 'monster': dirty.monsters[monster_index] });
                }

            }
            // No monster there - let the client know to remove it. We can only do that if we were
            // sent in an ID rather than an index
            else if(data.monster_id) {

                if(socket) {
                    socket.emit('monster_info', { 'remove': true, 'monster': { 'id': data.monster_id } });
                }

                if(room) {
                    io.to(room).emit('monster_info', { 'remove': true, 'monster': { 'id': data.monster_id } });
                }

                // since the monster doesn't exist anymore, we want to make sure that no coords have this monster
                let planet_coord_index = dirty.planet_coords.findIndex(function(obj) { return obj && obj.monster_id === data.monster_id; });
                if(planet_coord_index !== -1) {
                    log(chalk.yellow("Planet coord had a monster id: " + data.monster_id + " that no longer exists"));
                    main.updateCoordGeneric(false, { 'planet_coord_index': planet_coord_index, 'monster_id': false });
                }

                let ship_coord_index = dirty.ship_coords.findIndex(function(obj) { return obj && obj.monster_id === data.monster_id; });
                if(ship_coord_index !== -1) {
                    log(chalk.yellow("Ship coord had a monster id: " + data.monster_id + " that no longer exists"));
                    main.updateCoordGeneric(false, { 'ship_coord_index': ship_coord_index, 'monster_id': false });
                }

            }
        } catch(error) {
            log(chalk.red("Error in world.sendMonsterInfo: " + error));
        }


    }

    module.sendMonsterInfo = sendMonsterInfo;


    /* Just want to make sure we aren't missing something from this function in the new one
    async function sendMonsterInfo(socket, dirty, monster_id) {

        try {
            let monster_index = await main.getMonsterIndex(monster_id);

            if(monster_index !== -1) {
                socket.emit('monster_info', { 'monster': dirty.monsters[monster_index] });
            } else {
                console.log("Sending remove monster " + monster_id + " to player");
                socket.emit('monster_info', {'monster_id': monster_id, 'remove': true});

                // if a planet coord still has this monster id, lets remove that as well
                let planet_coord_index = dirty.planet_coords.findIndex(function (obj) { return obj && obj.monster_id === monster_id; });
                if(planet_coord_index !== -1) {
                    dirty.planet_coords[planet_coord_index].monster_id = false;
                    dirty.planet_coords[planet_coord_index].has_change = true;
                }
            }

        } catch(error) {
            log(chalk.red("Error in game.sendMonsterInfo:" + error));
        }



    }

    module.sendMonsterInfo = sendMonsterInfo;
    */

    async function sendNpcInfo(socket, room, dirty, npc_id) {

        try {
            let npc_index = await main.getNpcIndex(npc_id);

            if(npc_index === -1) {
                console.log("Sending remove npc " + npc_id + " to player");
                socket.emit('npc_info', { 'npc_id':npc_id, 'action':'remove' });

                // if a coord still has this npc id, lets remove that as well
                let planet_coord_index = dirty.planet_coords.findIndex(function (obj) { return obj && obj.npc_id === npc_id; });
                if(planet_coord_index !== -1) {
                    dirty.planet_coords[planet_coord_index].npc_id = false;
                    dirty.planet_coords[planet_coord_index].has_change = true;
                }

                let ship_coord_index = dirty.ship_coords.findIndex(function (obj) { return obj && obj.npc_id === npc_id; });
                if(ship_coord_index !== -1) {
                    dirty.ship_coords[ship_coord_index].npc_id = false;
                    dirty.ship_coords[ship_coord_index].has_change = true;
                }

                let coord_index = dirty.coords.findIndex(function (obj) { return obj && obj.npc_id === npc_id; });
                if(coord_index !== -1) {
                    dirty.coords[coord_index].npc_id = false;
                    dirty.coords[coord_index].has_change = true;
                }


                return;
            }


            if(socket !== false) {
                socket.emit('npc_info', { 'npc': dirty.npcs[npc_index] });
            }

            if(room !== false) {
                io.to(room).emit('npc_info', { 'npc': dirty.npcs[npc_index] });
            }

            // Send any inventory items that have a price
            if(dirty.npcs[npc_index].has_inventory) {
                //console.log("npc id: " + dirty.npcs[npc_index].id + " has inventory. Sending items with a price");

                dirty.inventory_items.forEach(function(inventory_item, i) {
                    if(inventory_item.npc_id === dirty.npcs[npc_index].id && inventory_item.price) {
                        if(socket !== false) {
                            socket.emit('inventory_item_info', { 'inventory_item': dirty.inventory_items[i] });
                        }

                        if(room !== false) {
                            io.to(room).emit('inventory_item_info', { 'inventory_item': dirty.inventory_items[i] });
                        }
                    }
                });
            }


            if(dirty.npcs[npc_index].ship_id) {
                let ship_index = await main.getObjectIndex(dirty.npcs[npc_index].ship_id);
                if(ship_index !== -1) {
                    world.sendObjectInfo(socket, room, dirty, ship_index, 'world.sendNpcInfo');
                }

            }


        } catch(error) {
            log(chalk.red("Error in game.sendNpcInfo: " + error));
        }



    }

    module.sendNpcInfo = sendNpcInfo;


    async function sendObjectInfo(socket, room, dirty, object_index, source = false) {

        try {


            if(typeof object_index === "undefined" || object_index === -1) {
                log(chalk.yellow("Invalid object_index sent into world.sendObjectInfo: " + object_index));
                return false;
            }

            if(!dirty.objects[object_index]) {
                log(chalk.yellow("Did not find object in dirty. source: " + source));

                console.trace("Lets find you");
                return false;
            }

            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);


            if(socket !== false) {
                socket.emit('object_info', { 'object': dirty.objects[object_index] });
            } else if(room !== false) {
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
                        if(socket !== false) {
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
                        if(socket !== false) {
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

                    sendPlanetInfo(socket, false, dirty, { 'planet_id': dirty.objects[object_index].planet_id });
                } else if(dirty.objects[object_index].ship_coord_id) {
                    sendObjectInfo(socket, false, dirty, { 'object_id': dirty.objects[object_index].ship_coord_id });
                }
            }


        } catch(error) {
            log(chalk.red("Error in world.sendObjectInfo: " + error + " source: " + source));
            console.error(error);
        }

    }
    module.sendObjectInfo = sendObjectInfo;

    // data:    planet_id
    async function sendPlanetInfo(socket, room, dirty, data) {

        try {
            let planet_id = parseInt(data.planet_id);

            if(!data.source) {
                data.source = false;
            }

            if(isNaN(planet_id)) {
                log(chalk.red("NaN planet_id sent into sendPlanetInfo. Source: " + data.source));
                return false;
            }

            let planet_index = await main.getPlanetIndex({ 'planet_id': planet_id, 'source': 'world.sendPlanetInfo' });

            if(planet_index === -1) {
                log(chalk.red("Could not send planet info for planet we do not have: " + planet_id));
                return false;
            }


            if(socket !== false) {
                socket.emit('planet_info', { 'planet': dirty.planets[planet_index] });
            }

            if(room !== false) {
                io.to(room).emit('planet_info', { 'planet': dirty.planets[planet_index] });
            }


            // we need to send things related to the planet. If there's a player, AI, AI rules
            if(dirty.planets[planet_index].player_id) {
                await sendPlayerInfo(socket, room, dirty, dirty.planets[planet_index].player_id);
            }

            // see if there is an AI on this planet
            if(dirty.planets[planet_index].ai_id) {
                //console.log("Calling sendObjectInfo from world.sendPlanetInfo");
                let ai_index = await main.getObjectIndex(dirty.planets[planet_index].ai_id);

                if(ai_index !== -1) {
                    await sendObjectInfo(socket, room, dirty, ai_index);
                }
                // AI is gone for some reason
                else {
                    dirty.planets[planet_index].ai_id = false;
                    dirty.lpanets[planet_index].has_change = true;
                }

            }

        } catch(error) {
            log(chalk.red("Error in world.sendPlanetInfo: " + error + " source: " + data.source));
        }



    }

    module.sendPlanetInfo = sendPlanetInfo;


    // planet_coord_index   OR   planet_coord_id
    async function sendPlanetCoordInfo(socket, room, dirty, data) {

        try {
            let coord_index = -1;

            if(data.planet_coord_index) {
                coord_index = data.planet_coord_index;
            } else if(data.planet_coord_id) {
                coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': data.planet_coord_id });
            }

            if(coord_index === -1) {
                return false;
            }

            if(socket) {
                socket.emit('planet_coord_info', { 'planet_coord': dirty.planet_coords[coord_index] });
            }

            if(room) {
                io.to(room).emit('planet_coord_info', { 'planet_coord': dirty.planet_coords[coord_index] });
            }

        } catch(error) {
            log(chalk.red("Error in world.sendPlanetCoordInfo: " + error));
        }

    }

    module.sendPlanetCoordInfo = sendPlanetCoordInfo;

    async function sendPlayerAIs(socket, room, dirty, player_id) {
        try {

            player_id = parseInt(player_id);

            for(let a = 0; a < dirty.objects.length; a++) {
                if(dirty.objects[a] && dirty.objects[a].player_id === player_id && dirty.objects[a].object_type_id === 72) {
                    log(chalk.cyan("Player has an ai. Sending that object"));


                    world.sendObjectInfo(socket, room, dirty, a);



                    // see if there are any ai_rules attached to this AI
                    let rules = dirty.rules.filter(rule => rule.object_id === dirty.objects[a].id);
                    if(rules) {
                        rules.forEach(function(rule) {

                            world.sendRuleInfo(socket, room, dirty, rule.id);
                        });
                    }

                    // We also send any areas that the player created on the planet/ship the AI is on
                    if(dirty.objects[a].planet_coord_id) {

                        let planet_coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.objects[a].planet_coord_id });

                        if(planet_coord_index !== -1) {
                            sendPlanetInfo(socket, room, dirty, { 'planet_id': dirty.planet_coords[planet_coord_index].planet_id });
                            sendAreas(socket, room, dirty, { 'planet_id': dirty.planet_coords[planet_coord_index].planet_id });
                        }

                    } else if(dirty.objects[a].ship_coord_id) {
                        let ship_coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[a].ship_coord_id });
                        if(ship_coord_index !== -1) {
                            let ship_index = await main.getObjectIndex(dirty.ship_coords[ship_coord_index].ship_id);
                            sendObjectInfo(socket, room, dirty, ship_index, 'world.sendPlayerAIs');
                            sendAreas(socket, room, dirty, { 'ship_id': dirty.ship_coords[ship_coord_index].ship_id });
                        }
                    }
                }
            }
        } catch(error) {
            log(chalk.red("Error in world.sendPlayerAIs: " + error));
        }
    }

    module.sendPlayerAIs = sendPlayerAIs;

    async function sendPlayerAreas(socket, dirty, player_index) {
        try {

            for(let i = 0; i < dirty.areas.length; i++ ) {
                if(dirty.areas[i].owner_id === socket.player_id || dirty.areas[i].renting_player_id === socket.player_id) {
                    socket.emit('area_info', { 'area': dirty.areas[i] });
                }
            }

        } catch(error) {
            log(chalk.red("Error in world.sendPlayerAreas: " + error));
            console.error(error);
        }
    }

    module.sendPlayerAreas = sendPlayerAreas;

    function sendPlayerCount(socket) {
        try {

            //console.log("In sendPlayerCount");
            socket.emit('player_count_info', { 'player_count':  Object.keys(io.sockets.sockets).length });


        } catch(error) {
            log(chalk.red("Error in world.sendPlayerCount: " + error));
        }
    }

    module.sendPlayerCount = sendPlayerCount;

    async function sendPlayerInfo(socket, room, dirty, player_id) {

        try {
            player_id = parseInt(player_id);
            //console.log("In sendPlayerInfo with player_id " + player_id);

            let player_index = await main.getPlayerIndex({'player_id':player_id});

            if(player_index === -1) {
                log(chalk.red("Unable to find player"));
                return false;
            }


            if(socket !== false) {
                socket.emit('player_info', { 'player': dirty.players[player_index] });
            }

            if(room !== false) {
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
        } catch(error) {
            log(chalk.red("Error in world.sendPlayerInfo: " + error));
        }

    }

    module.sendPlayerInfo = sendPlayerInfo;

    async function sendPlayerShips(socket, dirty, player_index) {

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

                    await sendObjectInfo(socket, false, dirty, s);
                }
            }

        } catch(error) {
            log(chalk.red("Error in sendPlayerShips: " + error));
        }


    }

    module.sendPlayerShips = sendPlayerShips;

    async function sendRuleInfo(socket, room, dirty, rule_id) {
        try {
            let rule_index = await main.getRuleIndex(rule_id);

            if(rule_index !== -1) {
                if(socket !== false) {
                    socket.emit('rule_info', { 'rule': dirty.rules[rule_index] });
                } else if(room !== false) {
                    io.to(room).emit('rule_info', { 'rule': dirty.rules[rule_index] });
                }
            }
        } catch(error) {
            log(chalk.red("Error in world.sendRuleInfo: " + error));
        }
    }

    module.sendRuleInfo = sendRuleInfo;

    // ship_coord_index   OR   ship_coord_id
    async function sendShipCoordInfo(socket, room, dirty, data) {

        try {
            let coord_index = -1;

            if(data.ship_coord_index) {
                coord_index = data.ship_coord_index;
            } else if(data.ship_coord_id) {
                coord_index = await main.getShipCoordIndex({ 'ship_coord_id': data.ship_coord_id });
            }

            if(coord_index === -1) {
                return false;
            }

            if(socket) {
                socket.emit('ship_coord_info', { 'ship_coord': dirty.ship_coords[coord_index] });
            }

            if(room) {
                io.to(room).emit('ship_coord_info', { 'ship_coord': dirty.ship_coords[coord_index] });
            }

        } catch(error) {
            log(chalk.red("Error in world.sendShipCoordInfo: " + error));
        }

    }

    module.sendShipCoordInfo = sendShipCoordInfo;


    // Sets the planet_type_id of a planet
    // data:    planet_index   |   planet_type_index
    async function setPlanetType(socket, dirty, data) {

        try {

            console.log("In world.setPlanetType");

            data.planet_index = parseInt(data.planet_index);
            data.planet_type_index = parseInt(data.planet_type_index);


            if(isNaN(data.planet_index) || data.planet_index === -1 || !dirty.planets[data.planet_index]) {
                log(chalk.yellow("Bad planet_index in world.setPlanetType"));
                return false;
            }

            if(isNaN(data.planet_type_index) || data.planet_type_index === -1 || !dirty.planet_types[data.planet_type_index]) {
                log(chalk.yellow("Bad planet_type_index in world.setPlanetType"));
                return false;
            }

            if(!socket.is_admin) {
                log(chalk.red("We think a socket with player id: " + socket.player_id + " is trying to be mr hacker man"));
                return false;

            }

            let coord_index = await main.getCoordIndex({ 'coord_id': dirty.planets[data.planet_index].coord_id });


            let can_place_all_tiles = true;
            let planet_type_has_display_linkers = false;
            for(let i = 0; i < dirty.planet_type_display_linkers.length; i++) {
                if(dirty.planet_type_display_linkers[i].planet_type_id === dirty.planet_types[data.planet_type_index].id) {
                    planet_type_has_display_linkers = true;
                    if(dirty.planet_type_display_linkers[i].position_x === 0 && dirty.planet_type_display_linkers[i].position_y === 0) {

                    } else {
                        let checking_tile_x = dirty.coords[coord_index].tile_x + dirty.planet_type_display_linkers[i].position_x;
                        let checking_tile_y = dirty.coords[coord_index].tile_y + dirty.planet_type_display_linkers[i].position_y;

                        let checking_coord_index = await main.getCoordIndex({ 'tile_x': checking_tile_x, 'tile_y': checking_tile_y });

                        if(checking_coord_index === -1 || dirty.coords[checking_coord_index].player_id || dirty.coords[checking_coord_index].object_id ||
                            dirty.coords[checking_coord_index].planet_id || dirty.coords[checking_coord_index].belongs_to_planet_id ||
                            dirty.coords[checking_coord_index].npc_id) {
                            can_place_all_tiles = false;
                        }
                    }
                }
            }

            if(can_place_all_tiles && planet_type_has_display_linkers) {
                console.log("Can place all tiles");
                for(let i = 0; i < dirty.planet_type_display_linkers.length; i++) {
                    if(dirty.planet_type_display_linkers[i].planet_type_id === dirty.planet_types[data.planet_type_index].id) {

                        if(dirty.planet_type_display_linkers[i].position_x === 0 && dirty.planet_type_display_linkers[i].position_y === 0) {

                        } else {
                            let checking_tile_x = dirty.coords[coord_index].tile_x + dirty.planet_type_display_linkers[i].position_x;
                            let checking_tile_y = dirty.coords[coord_index].tile_y + dirty.planet_type_display_linkers[i].position_y;

                            let checking_coord_index = await main.getCoordIndex({ 'tile_x': checking_tile_x, 'tile_y': checking_tile_y });

                            if(checking_coord_index !== -1 ) {
                                console.log("Set belongs_to_planet_id");
                                dirty.coords[checking_coord_index].belongs_to_planet_id = dirty.planets[data.planet_index].id;
                                dirty.coords[checking_coord_index].has_change = true;
                            } else {
                                console.log("Couldn't find coord at " + checking_tile_x + "," + checking_tile_y);
                            }
                        }
                    }
                }
            } else {
                log(chalk.yellow("Can't place all tiles"));
            }


            dirty.planets[data.planet_index].type = dirty.planet_types[data.planet_type_index].name;
            dirty.planets[data.planet_index].planet_type_id = dirty.planet_types[data.planet_type_index].id;
            dirty.planets[data.planet_index].current_hp = 1000000;
            dirty.planets[data.planet_index].max_hp = 1000000;
            dirty.planets[data.planet_index].x_size = dirty.planet_types[data.planet_type_index].size;
            dirty.planets[data.planet_index].y_size = dirty.planet_types[data.planet_type_index].size;

            dirty.planets[data.planet_index].lowest_depth = -1 * main.getRandomIntInclusive(dirty.planet_types[data.planet_type_index].min_depth,
                dirty.planet_types[data.planet_type_index].max_depth);

            dirty.planets[data.planet_index].has_change = true;


        } catch(error) {
            log(chalk.red("Error in world.setPlanetType: " + error));
            console.error(error);
        }
    }

    module.setPlanetType = setPlanetType;


    async function setPlayerBody(dirty, player_index) {
        try {
            console.log("Player doesn't have a body. Inserting one. Default to human body");
            // let get the basic human body type
            let body_object_type_index = main.getObjectTypeIndex(110);
            let body_object_id = await world.insertObjectType(socket, dirty,
                { 'object_type_id': dirty.object_types[body_object_type_index].id, 'player_id': dirty.players[player_index].id });
            if(body_object_id !== false) {
                dirty.players[player_index].body_id = body_object_id;
                dirty.players[player_index].current_hp = dirty.object_types[body_object_type_index].hp;
                dirty.players[player_index].has_change = true;
            } else {
                log(chalk.red("Unable to give player a body"));
            }

            console.log("Done with body");
        } catch(error) {
            log(chalk.red("Error in world.setPlayerBody: " + error));
        }

    }

    module.setPlayerBody = setPlayerBody;

    async function setPlayerMoveDelay(socket, dirty, player_index) {

        try {

            console.log("In setPlayerMoveDelay");

            if(dirty.players[player_index].planet_coord_id || dirty.players[player_index].ship_coord_id) {
                console.log("Player is on planet or ship");

                let body_index = await main.getObjectIndex(dirty.players[player_index].body_id);

                if(body_index !== -1) {
                    let body_type_index = main.getObjectTypeIndex(dirty.objects[body_index].object_type_id);

                    if(body_type_index === -1) {
                        log(chalk.yellow("Did not find object type of body id: " + dirty.objects[body_index].id));
                    } else if(!dirty.object_types[body_type_index].move_delay) {
                        socket.move_delay = 500
                    } else {
                        socket.move_delay = dirty.object_types[body_type_index].move_delay;
                    }

                } else {
                    log(chalk.yellow("Did not find body in objects"));
                }


            } else if(dirty.players[player_index].coord_id) {
                console.log("Player is in galaxy");
                let ship_index = await main.getObjectIndex(dirty.players[player_index].ship_id);

                if(ship_index !== -1) {
                    let ship_type_index = main.getObjectTypeIndex(dirty.objects[ship_index].object_type_id);
                    if(ship_type_index !== -1) {
                        if(dirty.object_types[ship_type_index].move_delay) {
                            socket.move_delay = dirty.object_types[ship_type_index].move_delay;
                        }
                    }
                }
            } else {
                console.log("Apparently we are calling this before we place the player");
            }



            // Just incase we failed to set it - set it to the default
            if(!socket.move_delay) {
                socket.move_delay = 500;
                console.log("Defaulted to 500 move delay");
            }

            // With any move_delay change, the old average isn't going to apply.
            socket.move_totals = 0;
            socket.move_count = 0;
            log(chalk.magenta("Set client move_delay to: " + socket.move_delay));

        } catch(error) {
            log(chalk.red("Error in world.setPlayerMoveDelay: " + error));
            console.error(error);
        }
    }

    module.setPlayerMoveDelay = setPlayerMoveDelay;



    /*
             data       monster_type_id   |   planet_coord_id   |  ship_coord_id   |   attack_on_spawn_type   |   | attack_on_spawn_id  |   ai_id
                        spawned_event_id

             */

    async function spawnMonster(dirty, data) {

        try {

            let coord_index = -1;
            let scope = 'planet';

            // Get setup based on what was passed in
            if(data.planet_coord_id) {
                coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': data.planet_coord_id });
            } else if(data.planet_coord_index) {
                coord_index = data.planet_coord_index;
            } else if(data.ship_coord_id) {
                coord_index = await main.getShipCoordIndex({ 'ship_coord_id': data.ship_coord_id });
                scope = 'ship';
            } else if(data.ship_coord_index) {
                coord_index = data.ship_coord_index;
                scope = 'ship';
            }

            let monster_type_index = main.getMonsterTypeIndex(data.monster_type_id);

            if(coord_index === -1 || monster_type_index === -1) {
                log(chalk.yellow("Could not spawn  monster. "));
                return false;
            }

            let spawned_event_id = false;
            if(data.spawned_event_id) {
                spawned_event_id = data.spawned_event_id;
            }

            let sql = "";
            let inserts = [];
            let room = "";

            if(scope === 'planet') {
                if(!await main.canPlace('planet', dirty.planet_coords[coord_index], 'monster', false,
                    { 'monster_type_id': dirty.monster_types[monster_type_index].id})) {
                    return false;
                }

                sql = "INSERT INTO monsters(monster_type_id, type, exp, current_hp, max_hp, attack_strength, planet_id, planet_level, planet_coord_id, spawned_event_id) VALUES(?,?,?,?,?,?,?,?,?,?)";
                inserts = [dirty.monster_types[monster_type_index].id, dirty.monster_types[monster_type_index].name, dirty.monster_types[monster_type_index].exp,
                    dirty.monster_types[monster_type_index].hp, dirty.monster_types[monster_type_index].hp, dirty.monster_types[monster_type_index].attack_strength,
                    dirty.planet_coords[coord_index].planet_id, dirty.planet_coords[coord_index].level, dirty.planet_coords[coord_index].id, spawned_event_id];



                room = "planet_" + dirty.planet_coords[coord_index].planet_id;


            } else if(scope === 'ship') {
                if(!await main.canPlace('ship', dirty.ship_coords[coord_index], 'monster', false,
                    { 'monster_type_id': dirty.monster_types[monster_type_index].id })) {
                    return false;
                }

                sql = "INSERT INTO monsters(monster_type_id, type, exp, current_hp, max_hp, attack_strength, ship_id, ship_coord_id, spawned_event_id) VALUES(?,?,?,?,?,?,?,?,?)";
                inserts = [dirty.monster_types[monster_type_index].id, dirty.monster_types[monster_type_index].name, dirty.monster_types[monster_type_index].exp,
                    dirty.monster_types[monster_type_index].hp, dirty.monster_types[monster_type_index].hp, dirty.monster_types[monster_type_index].attack_strength,
                    dirty.ship_coords[coord_index].ship_id, dirty.ship_coords[coord_index].id, spawned_event_id];

                room = "ship_" + dirty.ship_coords[coord_index].ship_id;
            }





            let [result] = await (pool.query(sql, inserts));
            //pool.query(monster_sql, monster_inserts, function(err, result) {


            //console.log("Inserted monster");

            let new_monster_id = result.insertId;
            //console.log("Got new monster id: " + new_monster_id);

            if(scope === 'planet') {
                await main.updateCoordGeneric(false, { 'planet_coord_index': coord_index, 'monster_id': new_monster_id,
                    'spawned_monster_id': new_monster_id });
            } else if(scope === 'ship') {
                await main.updateCoordGeneric(false, { 'ship_coord_index': coord_index, 'monster_id': new_monster_id });

            }

            world.sendMonsterInfo(false, room, dirty, { 'monster_id': new_monster_id });

            // and if the monster has a larger width/height, add in the belongs to stuff
            if(dirty.monster_types[monster_type_index].movement_tile_width > 1 ||
                dirty.monster_types[monster_type_index].movement_tile_height > 1) {
                console.log("This is a large monster. Adding the belongs_to_monster_id stuff");
            }


            // Sometimes monsters are spawned to automatically attack a player
            if(data.attack_on_spawn_id && data.attack_on_spawn_type) {
                console.log("Monster was spawned to attack " + data.attack_on_spawn_type + " id " + data.attack_on_spawn_id);

                let battle_linker_data = {
                    'attacking_id': new_monster_id, 'attacking_type': 'monster',
                    'being_attacked_id':data.attack_on_spawn_id, 'being_attacked_type': data.attack_on_spawn_type
                };
                world.addBattleLinker(false, dirty, battle_linker_data);

                // I THINK this is where the ai daemon stuff will always show up
                if(data.attack_on_spawn_type === 'player' &&
                    (dirty.monster_types[monster_type_index].id === 33 || dirty.monster_types[monster_type_index].id === 57) ) {
                    log(chalk.yellow("AI THING SPAWNED CHECK"));

                    // get the player socket
                    let being_attacked_player_index = await main.getPlayerIndex({'player_id': data.attack_on_spawn_id });
                    if(being_attacked_player_index !== -1) {
                        let being_attacked_player_socket = getPlayerSocket(dirty, being_attacked_player_index);
                        if(being_attacked_player_socket) {
                            being_attacked_player_socket.emit('chat', { 'message': "You have violated the rules of the ruling AI.", 'scope': 'local', 'is_important': true });
                        }
                    }


                }
            }

        } catch(error) {
            log(chalk.red("Error in world.spawnMonster: " + error));
            console.error(error);
        }

    }

    module.spawnMonster = spawnMonster;



    async function shielded(dirty, damage_amount, object_index) {

        try {
            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);

            if(!dirty.object_types[object_type_index].is_ship) {
                return false;
            }

            console.log("Seeing if ship is shielded");

            // see if we have energy storage with energy
            let energy_storage_ship_coords = dirty.ship_coords.filter(ship_coord => ship_coord.ship_id === dirty.objects[object_index].id &&
                ship_coord.object_type_id === 160);

            if(energy_storage_ship_coords.length > 0) {
                for(let energy_ship_coord of energy_storage_ship_coords) {

                    let coord_object_index = await main.getObjectIndex(energy_ship_coord.object_id);

                    if(coord_object_index !== -1 && dirty.objects[coord_object_index].energy >= damage_amount) {

                        // now just see if we have a shield to process this!
                        let shield_generator_ship_coords = dirty.ship_coords.filter(ship_coord => ship_coord.ship_id === dirty.objects[object_index].id &&
                            ship_coord.object_type_id === 48);

                        if(shield_generator_ship_coords.length > 0) {

                            dirty.objects[coord_object_index].energy -= damage_amount;
                            dirty.objects[coord_object_index].has_change = true;

                            return true;

                            for(let shield_ship_coord of shield_generator_ship_coords) {

                                // TODO - make it so shields take a while to process/absorb incoming damage. This would require separating an attack out into its parts

                            }
                        }
                    }

                }
            }


            return false;

        } catch(error) {
            log(chalk.red("Error in world.shielded: " + error));
        }

    }

    module.shielded = shielded;


    // data: area_id   |   price
    async function submitBid(socket, dirty, data) {

        try {

            console.log("Player is submitting a bid!");

            let sql = "INSERT INTO bid_linkers(player_id, area_id, price) VALUES(?,?,?)";
            let inserts = [socket.player_id, data.area_id, data.price];

            let [result] = await (pool.query(sql, inserts));

            let new_bid_linker_id = result.insertId;

            console.log("Got new bid linker id: " + new_bid_linker_id);

            let [rows, fields] = await (pool.query("SELECT * FROM bid_linkers WHERE id = ?", [new_bid_linker_id]));
            if(rows[0]) {
                let bid_linker = rows[0];
                bid_linker.has_change = false;
                let bid_linker_index = dirty.bid_linkers.push(bid_linker) - 1;

                // Gotta send the bid to everyone on the ship/planet
                let area_index = await main.getAreaIndex({'area_id': data.area_id });

                if(area_index !== -1) {
                    if(dirty.areas[area_index].planet_id) {
                        io.to("planet_" + dirty.areas[area_index].planet_id).emit('bid_linker_info', { 'bid_linker': dirty.bid_linkers[bid_linker_index] });
                    } else if(dirty.areas[area_index].ship_id) {
                        io.to("ship_" + dirty.areas[area_index].ship_id).emit('bid_linker_info', { 'bid_linker': dirty.bid_linkers[bid_linker_index] });
                    }
                }






            }


        } catch(error) {
            log(chalk.red("Error in world.submitBid: " + error));
            console.error(error);
        }
    }

    module.submitBid = submitBid;


    // type   |   type_index   |   change
    async function updatePlayerRelationship(socket, dirty, player_index, data) {
        try {

            let relationship_linker_index = await main.getPlayerRelationshipLinkerIndex(player_index, data.type, data.type_index);

            if(relationship_linker_index === -1) {
                log(chalk.yellow("Wasn't able to get the player's relationship linker for some reason...."));
                return false;
            }

            // lets update it
            dirty.player_relationship_linkers[relationship_linker_index].score += data.change;
            dirty.player_relationship_linkers[relationship_linker_index].has_change = true;




        } catch(error) {
            log(chalk.red("Error in world.updatePlayerRelationship: " + error));
        }
    }

    module.updatePlayerRelationship = updatePlayerRelationship;

    return module;


}