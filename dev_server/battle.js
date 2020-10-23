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
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const monster = require('./monster.js');
const npc = require('./npc.js');
const planet = require('./planet.js');
const player = require('./player.js');
const world = require('./world.js');




    //  data:   monster_id   |   npc_id   |   object_id   |   player_id   |   planet_id
    async function attackStop(socket, dirty, data) {

        try {
            //console.log("In battle.attackStop");

            let battle_linker_index = -1;

            if(data.monster_id) {
                //console.log("Was sent in monster id: " + data.monster_id);
                battle_linker_index = dirty.battle_linkers.findIndex(function(obj) {
                    return obj && obj.attacking_type === 'player' && obj.attacking_id === socket.player_id
                        && obj.being_attacked_type === 'monster' && obj.being_attacked_id === parseInt(data.monster_id); });


            } else if(data.npc_id) {
                battle_linker_index = dirty.battle_linkers.findIndex(function(obj) { return obj &&
                    obj.attacking_type === 'player' && obj.attacking_id === socket.player_id
                    && obj.being_attacked_type === 'npc' && obj.being_attacked_id === parseInt(data.npc_id); });

            } else if(data.object_id) {
                console.log("Was sent in object id: " + data.object_id);

                // It could be player v object, or object v object if we are in the galaxy
                let player_index = await player.getIndex(dirty, { 'player_id': socket.player_id });

                if(player_index === -1) {
                    return false;
                }

                if(dirty.players[player_index].coord_id && ! dirty.players[player_index].ship_coord_id) {
                    console.log("In galaxy");
                    battle_linker_index = dirty.battle_linkers.findIndex(function(obj) {
                        return obj && obj.attacking_type === 'object' && obj.attacking_id === dirty.players[player_index].ship_id
                            && obj.being_attacked_type === 'object' && obj.being_attacked_id === parseInt(data.object_id); });
                } else {
                    battle_linker_index = dirty.battle_linkers.findIndex(function(obj) {
                        return obj && obj.attacking_type === 'player' && obj.attacking_id === socket.player_id
                            && obj.being_attacked_type === 'object' && obj.being_attacked_id === parseInt(data.object_id); });
                }

            }
            else if(data.planet_id) {
                console.log("Was sent in planet id: " + data.planet_id);

                battle_linker_index = dirty.battle_linkers.findIndex(function(obj) {
                    return obj && obj.attacking_type === 'object' && obj.attacking_id === dirty.players[socket.player_index].ship_id
                        && obj.being_attacked_type === 'planet' && obj.being_attacked_id === parseInt(data.planet_id); });

            }
            else if(data.player_id) {
                battle_linker_index = dirty.battle_linkers.findIndex(function(obj) {
                    return obj && obj.attacking_type === 'player' && obj.attacking_id === socket.player_id
                        && obj.being_attacked_type === 'player' && obj.being_attacked_id === parseInt(data.player_id); });
            }


            if(battle_linker_index === -1) {
                console.log("Did not find a matching battle linker");
                return false;
            }


            socket.emit('battle_linker_info', { 'remove': true, 'battle_linker': dirty.battle_linkers[battle_linker_index] });

            if(dirty.battle_linkers[battle_linker_index].being_attacked_socket_id) {
                if(io.sockets.connected[dirty.battle_linkers[battle_linker_index].being_attacked_socket_id]) {

                    io.to(dirty.battle_linkers[battle_linker_index].being_attacked_socket_id).emit('battle_linker_info',
                        { 'remove': true, 'battle_linker': dirty.battle_linkers[battle_linker_index] });
                }
            }

            delete dirty.battle_linkers[battle_linker_index];

            //console.log("Removed battle linker");
        } catch(error) {
            log(chalk.red("Error in battle.attackStop: " + error));
            console.error(error);
        }



    }

    exports.attackStop = attackStop;

    async function getMonsterAttack(dirty, monster_index, calculating_range) {
        try {
            //console.log("In getMonsterAttack with range: " + calculating_range);

            let monster_type_index = main.getMonsterTypeIndex(dirty.monsters[monster_index].monster_type_id);

            if(monster_type_index === -1) {
                log(chalk.yellow("Could not find monster type index for monster id: " + dirty.monsters[monster_index].id));
                return 1;
            }

            let rarity = helper.rarityRoll();

            let hp_percent = dirty.monsters[monster_index].current_hp / dirty.monster_types[monster_type_index].hp * 100;


            let potential_attacks = dirty.monster_type_attacks.filter(attack =>
                attack.monster_type_id === dirty.monster_types[monster_type_index].id && attack.rarity <= rarity &&
                calculating_range >= attack.minimum_attack_range && calculating_range <= attack.maximum_attack_range &&
                hp_percent >= attack.minimum_hp_percent && hp_percent <= attack.maximum_hp_percent);

            if(potential_attacks.length > 0) {

                return potential_attacks[Math.floor(Math.random()*potential_attacks.length)];

            }

            // Didn't find an attack to return. Returning false
            return false;

        } catch(error) {
            log(chalk.red("Error in battle.getMonsterAttack: " + error));
        }
    }

    exports.getMonsterAttack = getMonsterAttack;


    async function calculateNpcAttack(dirty, npc_index, calculating_range) {
        try {

            let attack_level = await world.getNpcLevel(dirty, npc_index, 'attack');

            return 2 + attack_level;
        } catch(error) {
            log(chalk.red("Error in battle.calculateNpcAttack: " + error));
        }
    }

    async function calculateNpcDefense(dirty, npc_index) {

        try {
            let defense_level = await world.getNpcLevel(dirty, npc_index, 'defense');

            return 1 + defense_level;
        } catch(error) {
            log(chalk.red("Error in battle.calculateNpcDefense: " + error));
        }
    }


    // For ships - the attacks use up things like energy and steel. We only add to the attack if
    async function calculateObjectAttack(dirty, object_index) {

        try {

            console.time("calculateObjectAttack");

            // TODO RANGE
            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);

            if(object_type_index === -1) {
                log(chalk.red("Could not get object type in calculateObjectAttack"));
                return false;
            }

            let damage_amount = 0;
            let damage_types = [];


            if(dirty.object_types[object_type_index].attack_strength) {
                damage_amount += dirty.object_types[object_type_index].attack_strength;
            }


            // bah. Stupid 0 check
            if(dirty.object_types[object_type_index].equip_skill && dirty.object_types[object_type_index].equip_skill !== 0 &&
                dirty.object_types[object_type_index].equip_skill !== "0") {
                console.log("Object type itself has an equip skill: " + dirty.object_types[object_type_index].equip_skill);
                damage_types.push(dirty.object_types[object_type_index].equip_skill);
            }


            // Lots more to do if it's a ship
            if(dirty.object_types[object_type_index].is_ship) {
                // Find ship coords with attacking objects
                let attacking_ship_coords = dirty.ship_coords.filter(ship_coord => ship_coord.ship_id === dirty.objects[object_index].id &&
                    (ship_coord.object_type_id === 170 || ship_coord.object_type_id === 221) );

                if(attacking_ship_coords.length > 0) {
                    for(let attacking_ship_coord of attacking_ship_coords) {

                        // Ship Laser - see if we have energy for it
                        if(attacking_ship_coord.object_type_id === 221) {

                            let attacking_object_index = await game_object.getIndex(dirty, attacking_ship_coord.object_id);

                            let found_energy_source = false;

                            let storage_ship_coords = dirty.ship_coords.filter(ship_coord => ship_coord.ship_id === dirty.objects[object_index].id &&
                                ship_coord.object_type_id === 160);

                            if(storage_ship_coords.length > 0) {
                                for(let ship_coord of storage_ship_coords) {

                                    if(!found_energy_source) {
                                        let coord_object_index = await game_object.getIndex(dirty, ship_coord.object_id);
                                        if(coord_object_index !== -1 && dirty.objects[coord_object_index].energy > 2 ) {

                                            console.log("Found energy source for ship laser attack");
                                            found_energy_source = true;
                                            damage_amount += 5;

                                            dirty.objects[coord_object_index].energy -= 10;
                                            dirty.objects[coord_object_index].has_change = true;

                                            // and add in that damage type
                                            let attacking_object_type_index = main.getObjectTypeIndex(dirty.objects[attacking_object_index].object_type_id);
                                            if(dirty.object_types[attacking_object_type_index].equip_skill && dirty.object_types[attacking_object_type_index].equip_skill !== '0' &&
                                                dirty.object_types[attacking_object_type_index].equip_skill !== 0) {
                                                console.log("Object on ship has equip_skill: " + dirty.object_types[attacking_object_type_index].equip_skill);
                                                damage_types.push(dirty.object_types[attacking_object_type_index].equip_skill);
                                            }
                                        }
                                    }

                                }
                            }

                        }

                        // Ship Railgun
                        else if(attacking_ship_coord.object_type_id === 170) {

                        }

                    }
                }
            }


            console.timeEnd("calculateObjectAttack");

            return { 'damage_amount': damage_amount, 'damage_types': damage_types };
        } catch(error) {
            log(chalk.red("Error in battle.calculateObjectAttack: " + error));
            console.error(error);
        }



    }


    async function calculatePlayerAttack(dirty, player_index, player_body_index, calculating_range) {

        try {

            if(player_index === -1) {
                log(chalk.yellow("Player index sent do calculatePlayerAttack was -1"));
                return false;
            }

            if(player_body_index === -1) {
                log(chalk.yellow("Player body index sent to do calculatePlayerAttack was -1"));
                return false;
            }

            let damage_amount = 0;
            let damage_types = [];
            let radius_damage_amounts = [];
            let decrement_equipment_linker_ids = [];

            let player_body_type_index = main.getObjectTypeIndex(dirty.objects[player_body_index].object_type_id);

            // default 5 attack at one range ( hands )
            if(calculating_range === 1) {
                damage_amount = 5;
            }

            // If the player's body type has an attack modifier, we change the attack by that amount
            if(dirty.object_types[player_body_type_index].attack_modifier) {
                damage_amount += dirty.object_types[player_body_type_index].attack_modifier;
            }

            //console.time("controlTime");
            let control_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'skill_type': 'control' });
            //console.timeEnd("controlTime");

            let corrosive_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet', 'skill_type': 'corrosive' });
            let electric_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type': 'electric' });
            let explosion_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type': 'explosion' });
            let freezing_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type': 'freezing' });
            let hacking_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type': 'hacking' });
            let heat_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type': 'heat' });
            let gravity_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type': 'gravity' });
            let laser_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type': 'laser' });
            let melee_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type':'melee' } );
            let piercing_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet',  'skill_type': 'piercing' });
            let plasma_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet', 'skill_type': 'plasma' });
            let poison_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet', 'skill_type': 'poison' });
            let radiation_level = await world.getPlayerLevel(dirty, { 'player_index': player_index,
                'body_index': player_body_index, 'scope': 'planet', 'skill_type': 'radiation' });


            let total_attacking_equipment_count = 0;
            let control_equipment_count = 0;
            let corrosive_equipment_count = 0;
            let electric_equipment_count = 0;
            let explosion_equipment_count = 0;
            let freezing_equipment_count = 0;
            let gravity_equipment_count = 0;
            let hacking_equipment_count = 0;
            let heat_equipment_count = 0;
            let laser_equipment_count = 0
            let melee_equipment_count = 0;
            let piercing_equipment_count = 0;
            let plasma_equipment_count = 0;
            let poison_equipment_count = 0;
            let radiation_equipment_count = 0;
            


            for(let equipment_linker of dirty.equipment_linkers) {
                if(equipment_linker && equipment_linker.body_id === dirty.players[player_index].body_id) {


                    let object_type_index = dirty.object_types.findIndex(function(obj) { return obj && obj.id === equipment_linker.object_type_id; });
                    if(object_type_index !== -1) {

                        // see if the object attack is in this range
                        if(dirty.object_types[object_type_index].min_attack_range <= calculating_range && dirty.object_types[object_type_index].max_attack_range >= calculating_range) {
                            //log(chalk.cyan("Have equipped item in range. Adding: " + dirty.object_types[object_type_index].attack_strength));
                            damage_amount += dirty.object_types[object_type_index].attack_strength;


                            // TODO flesh out all the damage types
                            if(dirty.object_types[object_type_index].equip_skill === 'control') {
                                control_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'corrosive') {
                                corrosive_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'electric') {
                                electric_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'explosion') {
                                explosion_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'freezing') {
                                freezing_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'gravity') {
                                gravity_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'hacking') {
                                hacking_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'heat') {
                                heat_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'laser') {
                                laser_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'melee') {
                                melee_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'piercing') {
                                piercing_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'poison') {
                                poison_equipment_count++;
                            } else if(dirty.object_types[object_type_index].equip_skill === 'radiation') {
                                radiation_equipment_count++;
                            }

                            // If the equip skill/(damage type) isn't in our damage types array yet, add it
                            let need_to_add_type = true;
                            for(let t = 0; t < damage_types.length; t++) {
                                if(damage_types[t] === dirty.object_types[object_type_index].equip_skill) {
                                    need_to_add_type = false;
                                }
                            }

                            if(need_to_add_type) {
                                //console.log("Pushing damage type: " + dirty.object_types[object_type_index].equip_skill);
                                damage_types.push(dirty.object_types[object_type_index].equip_skill);
                            }

                            total_attacking_equipment_count++;

                            if(dirty.object_types[object_type_index].attack_radius) {
                                radius_damage_amounts.push({ 'radius': dirty.object_types[object_type_index].attack_radius,
                                    'damage_amount': dirty.object_types[object_type_index].attack_strength,
                                    'damage_type': dirty.object_types[object_type_index].equip_skill });
                            }

                            if(dirty.object_types[object_type_index].is_consumed_on_attack) {
                                log(chalk.cyan("Consuming attack item"));
                                decrement_equipment_linker_ids.push(equipment_linker.id);
                            }

                        }
                    }
                }
            }

            // Control
            if(control_equipment_count > 0) {
                let control_equipment_percent = control_equipment_count / total_attacking_equipment_count;
                let control_bonus = Math.floor(control_level * control_equipment_percent);

                if(control_bonus > 1) {
                    damage_amount += control_bonus - 1;
                }
            }

            // Corrosive
            if(corrosive_equipment_count > 0) {
                let corrosive_equipment_percent = corrosive_equipment_count / total_attacking_equipment_count;
                let corrosive_bonus = Math.floor(corrosive_level * corrosive_equipment_percent);

                if(corrosive_bonus > 1) {
                    damage_amount += corrosive_bonus - 1;
                }
            }

            // Electric
            if(electric_equipment_count > 0) {
                let electric_equipment_percent = electric_equipment_count / total_attacking_equipment_count;
                let electric_bonus = Math.floor(electric_level * electric_equipment_percent);

                if(electric_bonus > 1) {
                    damage_amount += electric_bonus - 1;
                }
            }
            

            // Explosion
            if(explosion_equipment_count > 0) {
                let explosion_equipment_percent = explosion_equipment_count / total_attacking_equipment_count;
                let explosion_bonus = Math.floor(explosion_level * explosion_equipment_percent);

                if(explosion_bonus > 1) {
                    damage_amount += explosion_bonus - 1;
                }
            }

            // Freezing
            if(freezing_equipment_count > 0) {
                let freezing_equipment_percent = freezing_equipment_count / total_attacking_equipment_count;
                let freezing_bonus = Math.floor(freezing_level * freezing_equipment_percent);

                if(freezing_bonus > 1) {
                    damage_amount += freezing_bonus - 1;
                }
            }

            // Gravity
            if(gravity_equipment_count > 0) {
                let gravity_equipment_percent = gravity_equipment_count / total_attacking_equipment_count;
                let gravity_bonus = Math.floor(gravity_level * gravity_equipment_percent);

                if(gravity_bonus > 1) {
                    damage_amount += gravity_bonus - 1;
                }
            }

            // Hacking
            if(hacking_equipment_count > 0) {
                let hacking_equipment_percent = hacking_equipment_count / total_attacking_equipment_count;
                let hacking_bonus = Math.floor(hacking_level * hacking_equipment_percent);

                if(hacking_bonus > 1) {
                    damage_amount += hacking_bonus - 1;
                }
            }

            // Heat
            if(heat_equipment_count > 0) {
                let heat_equipment_percent = heat_equipment_count / total_attacking_equipment_count;
                let heat_bonus = Math.floor(heat_level * heat_equipment_percent);

                if(heat_bonus > 1) {
                    damage_amount += heat_bonus - 1;
                }
            }

        
            // Laser percent
            if(laser_equipment_count > 0) {
                let laser_equipment_percent = laser_equipment_count / total_attacking_equipment_count;
                let laser_bonus = Math.floor(laser_level * laser_equipment_percent);

                if(laser_bonus > 1) {
                    damage_amount += laser_bonus - 1;
                }
            }

            // Melee percent
            if(melee_equipment_count > 0) {
                let melee_equipment_percent = melee_equipment_count / total_attacking_equipment_count;
                let melee_bonus = Math.floor(melee_level * melee_equipment_percent);

                if(melee_bonus > 1) {
                    damage_amount += melee_bonus - 1;
                }
            }

            // Piercing
            if(piercing_equipment_count > 0) {
                let piercing_equipment_percent = piercing_equipment_count / total_attacking_equipment_count;
                let piercing_bonus = Math.floor(piercing_level * piercing_equipment_percent);

                if(piercing_bonus > 1) {
                    damage_amount += piercing_bonus - 1;
                }
            }

            // Plasma
            if(plasma_equipment_count > 0) {
                let plasma_equipment_percent = plasma_equipment_count / total_attacking_equipment_count;
                let plasma_bonus = Math.floor(plasma_level * plasma_equipment_percent);

                if(plasma_bonus > 1) {
                    damage_amount += plasma_bonus - 1;
                }
            }

            // Poison
            if(poison_equipment_count > 0) {
                let poison_equipment_percent = poison_equipment_count / total_attacking_equipment_count;
                let poison_bonus = Math.floor(poison_level * poison_equipment_percent);

                if(poison_bonus > 1) {
                    damage_amount += poison_bonus - 1;
                }
            }

            // Radiation
            if(radiation_equipment_count > 0) {
                let radiation_equipment_percent = radiation_equipment_count / total_attacking_equipment_count;
                let radiation_bonus = Math.floor(radiation_level * radiation_equipment_percent);

                if(radiation_bonus > 1) {
                    damage_amount += radiation_bonus - 1;
                }
            }

            // There's also a situation where there is nothing equipped, and we are attacking at range one
            if(total_attacking_equipment_count === 0 && calculating_range === 1 && melee_level > 1) {
                damage_amount += melee_level - 1;
            }

            let body_eating_linkers = dirty.eating_linkers.filter(linker => linker.body_id === dirty.players[player_index].body_id);



            // and bonuses for eating linkers
            for(let eating_linker of body_eating_linkers) {
                if(eating_linker && eating_linker.body_id === dirty.players[player_index].body_id) {


                    let race_linker_index = main.getRaceEatingLinkerIndex({
                        'race_id': dirty.object_types[player_body_type_index].race_id, 'object_type_id': eating_linker.eating_object_type_id
                    });

                    if(dirty.race_eating_linkers[race_linker_index].attack) {
                        //console.log("Eating increased player attack by: " + dirty.race_eating_linkers[race_linker_index].attack);
                        damage_amount += dirty.race_eating_linkers[race_linker_index].attack;
                    }
                }
            }

            // and minuses for each addiction without a matching eating linker (addictions are held off while the player is still consuming them)
            let body_addiction_linkers = dirty.addiction_linkers.filter(linker => linker.body_id === dirty.players[player_index].body_id);
            for(let addiction_linker of body_addiction_linkers) {

                let still_eating = false;
                for(let eating_linker of body_eating_linkers) {
                    if(eating_linker.eating_object_type_id === addiction_linker.addicted_to_object_type_id) {
                        still_eating = true;
                    }
                }

                if(!still_eating) {

                    let race_linker_index = main.getRaceEatingLinkerIndex({
                        'race_id': dirty.object_types[player_body_type_index].race_id, 'object_type_id': addiction_linker.addicted_to_object_type_id
                    });

                    if(dirty.race_eating_linkers[race_linker_index].attack) {
                        console.log("Reduced player attacked due to addiction linker");
                        damage_amount -= addiction_linker.addiction_level * dirty.race_eating_linkers[race_linker_index].attack;
                    }

                }

            }

            // No equipment, range 1, no damage types present. The player is hitting with their hands
            if(damage_types.length === 0 && calculating_range === 1) {
                damage_types.push('melee');
            }


            return { 'damage_amount': damage_amount, 'damage_types': damage_types,
                'radius_damage_amounts': radius_damage_amounts,
                'decrement_equipment_linker_ids': decrement_equipment_linker_ids,
                'control_equipment_count': control_equipment_count,
                'corrosive_equipment_count': corrosive_equipment_count,
                'electric_equipment_count': electric_equipment_count,
                'explosion_equipment_count': explosion_equipment_count,
                'freezing_equipment_count': freezing_equipment_count,
                'gravity_equipment_count': gravity_equipment_count,
                'hacking_equipment_count': hacking_equipment_count,
                'heat_equipment_count': heat_equipment_count,
                'laser_equipment_count': laser_equipment_count,
                'melee_equipment_count': melee_equipment_count,
                'piercing_equipment_count': piercing_equipment_count,
                'plasma_equipment_count': plasma_equipment_count,
                'poison_equipment_count': poison_equipment_count,
                'radiation_equipment_count': radiation_equipment_count

            
            };
        } catch(error) {
            log(chalk.red("Error in battle.calculatePlayerAttack: " + error));
        }

    }

    exports.caclulatePlayerAttack = calculatePlayerAttack;


    async function calculateRange(first_coord_x, first_coord_y, second_coord_x, second_coord_y) {
        try {
            // see if the x and y are close enough for the attack to hit
            let x_difference = Math.abs(first_coord_x - second_coord_x);
            let y_difference = Math.abs(first_coord_y - second_coord_y);

            // we will base things off of the higher of the two
            let calculating_range = x_difference;
            if(y_difference > calculating_range) {
                calculating_range = y_difference;
            }

            return calculating_range;
        } catch(error) {
            log(chalk.red("Error in battle.calculatePlayeRange: " + error));
        }



    }

    exports.caclulatePlayerRange = calculateRange;

    async function calcualteShipAttack(object_id) {

    }

    async function calculateShipDefense(object_id) {
        try {
            let object_index = await game_object.getIndex(dirty, object_id);

            if(object_index === -1) {
                return 1;
            }

            return 1;
        } catch(error) {
            log(chalk.red("Error in battle.calculateShipDefense: " + error));
        }


    }


    // TODO code in npc/object/object-type

    //      data:   planet_coord_index   |   ship_coord_index   |   battle_linker   |   damage_amount   |   damage_type
    //              damage_source_type   |   damage_source_id
    async function damageTile(dirty, data) {
        try {

            //console.log("In damageTile");
            let being_damaged_monster_index = -1;
            let being_damaged_npc_index = -1;
            let being_damaged_object_index = -1;
            let being_damaged_player_index = -1;
            let room = false;
            let nothing_is_damaged = true;

            if(data.planet_coord_index) {

                room = "planet_" + dirty.planet_coords[data.planet_coord_index].planet_id;

                if(dirty.planet_coords[data.planet_coord_index].player_id) {
                    being_damaged_player_index = await player.getIndex(dirty, { 'player_id': dirty.planet_coords[data.planet_coord_index].player_id });
                }

                if(dirty.planet_coords[data.planet_coord_index].monster_id) {
                    being_damaged_monster_index = await main.getMonsterIndex(dirty.planet_coords[data.planet_coord_index].monster_id);
                }

            } else if(data.ship_coord_index) {

                room = "ship_" + dirty.ship_coords[data.ship_coord_index].ship_id;

                if(dirty.ship_coords[data.ship_coord_index].player_id) {
                    being_damaged_player_index = await player.getIndex(dirty, { 'player_id': dirty.ship_coords[data.ship_coord_index].player_id });
                }

                if(dirty.ship_coords[data.ship_coord_index].monster_id) {
                    being_damaged_monster_index = await main.getMonsterIndex(dirty.ship_coords[data.ship_coord_index].monster_id);
                }
            }

            if(being_damaged_monster_index !== -1) {
                nothing_is_damaged = false;

                //console.log("Found monster to damage");

                let ai_index = -1;
                let ai_data = {};
                
                if(data.planet_coord_index) {
                    ai_index = await world.getAIProtector(dirty, data.damage_amount, dirty.planet_coords[data.planet_coord_index], 
                        data.damage_source_id, { 'monster_index': being_damaged_monster_index });
                } else if(data.ship_coord_index) {
                    ai_index = await world.getAIProtector(dirty, data.damage_amount, dirty.ship_coords[data.ship_coord_index], 
                        data.damage_source_id, { 'monster_index': being_damaged_monster_index });
                }

                


                if(ai_index !== -1) {
                    dirty.objects[ai_index].energy -= data.damage_amount;
                    dirty.objects[ai_index].has_change = true;


                    io.to(room).emit('hp_change_data',
                        {'monster_id': dirty.monsters[being_damaged_monster_index].id, 'damage_amount': data.damage_amount, 'was_damaged_type': 'energy',
                            'damage_source_type':'player', 'damage_source_id': data.battle_linker.attacking_id });

                    await world.aiRetaliate(dirty, ai_index, data.battle_linker.attacking_type, data.battle_linker.attacking_id);
                    return;
                }

                let damage_monster_data = {};
                if(data.battle_linker) {

                    damage_monster_data.battle_linker = data.battle_linker;
                } else if(data.damage_source_type) {
                    damage_monster_data.damage_source_type = data.damage_source_type;
                    damage_monster_data.damage_types = [data.damage_type];
                    //console.log("Radius damage damaged monster. Damage type: " + data.damage_type);
                    //console.log(damage_monster_data.damage_types);
                    damage_monster_data.damage_source_id = data.damage_source_id;

                }
                await monster.damage(dirty, being_damaged_monster_index, data.damage_amount, damage_monster_data);
            }


            if(being_damaged_player_index !== -1) {

                nothing_is_damaged = false;

                console.log("Found player to damage");

                let ai_data = {};
                let ai_index = -1;
                if(data.planet_coord_index) {
                    ai_index = await world.getAIProtector(dirty, data.damage_amount, dirty.planet_coords[data.planet_coord_index],
                        data.damage_source_type, { 'player_index': being_damaged_player_index });

                } else if(data.ship_coord_index) {
                    ai_index = await world.getAIProtector(dirty, data.damage_amount, dirty.ship_coords[data.ship_coord_index],
                        data.damage_source_type, { 'player_index': being_damaged_player_index });

                }


                if(ai_index !== -1) {
                    dirty.objects[ai_index].energy -= data.damage_amount;
                    dirty.objects[ai_index].has_change = true;

                    io.to(room).emit('hp_change_data',
                        {'player_id': dirty.players[being_damaged_player_index].id, 'damage_amount': data.damage_amount, 'was_damaged_type': 'energy',
                            'damage_source_type':'player', 'damage_source_id': data.battle_linker.attacking_id });

                    await world.aiRetaliate(dirty, ai_index, data.battle_linker.attacking_type, data.battle_linker.attacking_id);
                    return;
                }

                await player.damage(dirty, { 'player_index': being_damaged_player_index,
                    'damage_amount': data.damage_amount, 'damage_types': [ data.damage_type ] });
            }


            // We still want an explosion effect there because IT IS COOL BEANS
            if(nothing_is_damaged) {
                console.log("Trying to add explosion effect to tile even with no damage!! FUN!");
                if(data.planet_coord_index) {
                    io.to(room).emit('damaged_data', {
                        'planet_coord_id': dirty.planet_coords[data.planet_coord_index].id, 'damage_amount': 0, 'damage_types': [data.damage_type]
                    });
                } else if(data.ship_coord_index) {
                    io.to(room).emit('damaged_data', {
                        'ship_coord_id': dirty.ship_coords[data.ship_coord_index].id, 'damage_amount': 0, 'damage_types': [data.damage_type]
                    });
                }

            }



        } catch(error) {
            log(chalk.red("Error in battle.damageTile: " + error));
            console.error(error);
        }
    }

    async function decrementEquipmentLinkers(dirty, player_attack_profile, player_socket_id) {
        try {
            if(player_attack_profile.decrement_equipment_linker_ids.length > 0) {
                //console.log("Some equips are consumed on use");
                for(let i = 0; i < player_attack_profile.decrement_equipment_linker_ids.length; i++) {

                    let equipment_linker_index = await main.getEquipmentLinkerIndex({ 'equipment_linker_id': player_attack_profile.decrement_equipment_linker_ids[i] });
                    if(equipment_linker_index !== -1) {

                        removeFromEquipmentLinker(dirty, io.sockets.connected[player_socket_id],{ 'equipment_linker_index': equipment_linker_index,
                            'amount': 1 });

                    }
                }
            }
        } catch(error) {
            log(chalk.red("Error in battle.decrementEquipmentLinkers: " + error));
            console.error(error);
        }
    }

    exports.decrementEquipmentLinkers = decrementEquipmentLinkers;



    async function doLinkers(dirty) {
        try {
            //console.log("In doLinkers");

            // filter our empties
            let battle_linkers = dirty.battle_linkers.filter(n => n);

            for(let battle_linker of battle_linkers) {

                if(battle_linker.attacking_type === 'monster' && battle_linker.being_attacked_type === 'object') {
                    await monsterAttackObject(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'monster' && battle_linker.being_attacked_type === 'player') {
                    await monsterAttackPlayer(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'npc' && battle_linker.being_attacked_type === 'monster') {
                    await npcAttackMonster(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'npc' && battle_linker.being_attacked_type === 'object') {
                    await npcAttackObject(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'npc' && battle_linker.being_attacked_type === 'player') {
                    await npcAttackPlayer(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'object' && battle_linker.being_attacked_type === 'object') {
                    await objectAttackObject(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'object' && battle_linker.being_attacked_type === 'planet') {
                    await objectAttackPlanet(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'object' && battle_linker.being_attacked_type === 'player') {
                    await objectAttackPlayer(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'player' && battle_linker.being_attacked_type === 'monster') {
                    await playerAttackMonster(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'player' && battle_linker.being_attacked_type === 'npc') {
                    await playerAttackNpc(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'player' && battle_linker.being_attacked_type === 'object') {
                    await playerAttackObject(dirty, battle_linker);
                } else if(battle_linker.attacking_type === 'player' && battle_linker.being_attacked_type === 'player') {
                    await playerAttackPlayer(dirty, battle_linker);
                }  
                
                else {
                    console.log("Unknown battle linker type. " + battle_linker.attacking_type + " is attacking a " + battle_linker.being_attacked_type);
                }
            }

        } catch(error) {
            log(chalk.red("Error in battle.doLinkers: " + error));
        }

    }

    exports.doLinkers = doLinkers;

    async function monsterAttackObject(dirty, battle_linker) {

        try {
            log(chalk.green("Monster " + battle_linker.attacking_id + " is attacking object " + battle_linker.being_attacked_id));

            battle_linker.turn_count += 1;


            let monster_index = await main.getMonsterIndex(battle_linker.attacking_id);
            let object_index = await game_object.getIndex(dirty, battle_linker.being_attacked_id);

            if(monster_index === -1) {
                log(chalk.yellow("Could not find monster id: " + battle_linker.attacking_id + ". monster_index: " + monster_index));
                world.removeBattleLinkers(dirty, { 'monster_id': battle_linker.attacking_id });
                return;
            }

            if(object_index === -1) {
                log(chalk.yellow("Could not find object id: " + battle_linker.being_attacked_id));
                world.removeBattleLinkers(dirty, { 'object_id': battle_linker.being_attacked_id });
                return;
            }

            let monster_type_index = main.getMonsterTypeIndex(dirty.monsters[monster_index].monster_type_id);

            let monster_info = await monster.getCoordAndRoom(dirty, monster_index);
            let object_info = await game_object.getCoordAndRoom(dirty, object_index);

            if(monster_info.coord === false) {
                log(chalk.yellow("Could not get the attacking monster coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(object_info.coord === false) {
                log(chalk.yellow("Could not get the object coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(monster_info.room !== object_info.room) {
                log(chalk.yellow("Monster and object don't share the same room"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            // we also remove the battle linker if they are on a planet but not on the same level
            if(monster_info.coord.planet_id && object_info.coord.planet_id && monster_info.coord.level !== object_info.coord.level) {
                log(chalk.yellow("Monster and object don't share the same planet level"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }


            let calculating_range = await calculateRange(
                monster_info.coord.tile_x, monster_info.coord.tile_y,
                object_info.coord.tile_x, object_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Monster and object are too far apart. Removing battle linker id: " + battle_linker.id));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }


            let monster_attack = await getMonsterAttack(dirty, monster_index, calculating_range);

            if(monster_attack === false) {
                return false;
            }

            let attack = monster_attack.damage_amount;

            let flavor_text = false;
            if(monster_attack.flavor_text) {
                flavor_text = monster_attack.flavor_text;
                //console.log("Setting flavor text to: " + flavor_text);
            }


            // TODO add
            let defense = await game_object.calculateDefense(dirty, object_index, monster_attack.damage_type);

            if(attack <= defense) {
                return false;
            }

            let damage_amount = monster_attack.damage_amount - defense;

            await game_object.damage(dirty, object_index, damage_amount, {
            'damage_types': [monster_attack.damage_type],
            'battle_linker': battle_linker, 'object_info': object_info, 'calculating_range': calculating_range });

        } catch(error) {
            log(chalk.red("Error in battle.monsterAttackObject: " + error));
            console.error(error);
        }



    }


    async function monsterAttackPlayer(dirty, battle_linker) {

        try {
            //log(chalk.green("Monster " + battle_linker.attacking_id + " is attacking player " + battle_linker.being_attacked_id));

            battle_linker.turn_count += 1;

            if(!io.sockets.connected[battle_linker.being_attacked_socket_id]) {
                log(chalk.yellow("Player with being_attacked_socket_id: " + battle_linker.being_attacked_socket_id + " is no longer connected. Removing"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return;
            }

            let monster_index = await main.getMonsterIndex(battle_linker.attacking_id);
            let player_index = await player.getIndex(dirty, { 'player_id': battle_linker.being_attacked_id });

            if(monster_index === -1) {
                log(chalk.yellow("Could not find monster id: " + battle_linker.attacking_id + ". monster_index: " + monster_index));
                world.removeBattleLinkers(dirty, { 'monster_id': battle_linker.attacking_id });
                return;
            }

            if(player_index === -1) {
                log(chalk.yellow("Could not find player id: " + battle_linker.being_attacked_id + ". player_index: " + player_index));
                world.removeBattleLinkers(dirty, { 'player_id': battle_linker.being_attacked_id });
                return;
            }

            let monster_type_index = main.getMonsterTypeIndex(dirty.monsters[monster_index].monster_type_id);

            let monster_info = await monster.getCoordAndRoom(dirty, monster_index);
            let player_info = await world.getPlayerCoordAndRoom(dirty, player_index);

            if(monster_info.coord === false) {
                log(chalk.yellow("Could not get the attacking monster coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(player_info.coord === false) {
                log(chalk.yellow("Could not get the defending player coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(monster_info.room !== player_info.room) {
                log(chalk.yellow("Monster and player don't share the same room"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            // we also remove the battle linker if they are on a planet but not on the same level
            if(monster_info.coord.planet_id && player_info.coord.planet_id && monster_info.coord.level !== player_info.coord.level) {
                log(chalk.yellow("Monster and player don't share the same planet level"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }


            let calculating_range = await calculateRange(
                monster_info.coord.tile_x, monster_info.coord.tile_y,
                player_info.coord.tile_x, player_info.coord.tile_y);

            if(calculating_range > 8) {
                //log(chalk.yellow("Monster and player are too far apart. Removing battle linker id: " + battle_linker.id));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }


            let monster_attack = await getMonsterAttack(dirty, monster_index, calculating_range);

            let flavor_text = false;
            if(monster_attack.flavor_text) {
                flavor_text = monster_attack.flavor_text;
                //console.log("Setting flavor text to: " + flavor_text);
            }

            if(monster_attack === false) {
                //console.log("monster did not have an attack");
                //console.log(dirty.monsters[monster_index].path);
                return false;
            }

            let defense = await player.calculateDefense(dirty, player_index, monster_attack.damage_type);


            dirty.players[player_index].attacks_defended++;
            //console.log("Increasing player's attacks defended to: " + dirty.players[player_index].attacks_defended);


            if(monster_attack.damage_amount <= defense) {
                //console.log("attack was less than defense: " + monster_attack.damage_amount + " < " + defense);
                io.to(player_info.room).emit('damaged_data',
                    {'player_id': dirty.players[player_index].id, 'damage_amount': 0, 'was_damaged_type': 'hp',
                        'damage_source_type':'monster', 'damage_source_id': dirty.monsters[monster_index].id,
                        'damage_types': [monster_attack.damage_type],
                        'calculating_range': calculating_range, 'flavor_text': flavor_text, 'additional_effect': monster_attack.additional_effect });
                return false;
            }

            // See if there's an AI that comes into play
            let damage_amount = monster_attack.damage_amount - defense;

            let ai_index = -1;

            // We skip the ai protection step if it's an AI attacking someone

            if(dirty.monsters[monster_index].monster_type_id === 33 || dirty.monsters[monster_index].monster_type_id === 57) {

            } else {
                ai_index = await world.getAIProtector(dirty, damage_amount, player_info.coord, 'monster', { 'player_index': player_index });
            }




            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(player_info.room).emit('damaged_data',
                    {'player_id': dirty.players[player_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'monster', 'damage_source_id': dirty.monsters[monster_index].id,
                        'damage_types': [monster_attack.damage_type],
                        'calculating_range': calculating_range, 'flavor_text': flavor_text });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);

                // If we are an AI Daemon, and the turn count is > 10, we attempt to spawn the next level of AI helper, the AI....
                if(dirty.monster_types[monster_type_index].id === 33 && battle_linker.turn_count === 10) {
                    log(chalk.cyan("AI is trying to advance attack/defense to the next level"));

                    let attack_data = {
                        'ai_id': ai_id,
                        'attacking_type': battle_linker.being_attacked_type,
                        'attacking_id': battle_linker.being_attacked_id,
                        'attack_level': 2
                    };

                    world.aiAttack(dirty, attack_data);

                }

                return;
            }


            await player.damage(dirty, { 'player_index': player_index, 'damage_amount': damage_amount,
                'battle_linker': battle_linker, 'damage_types': [monster_attack.damage_type],
                'calculating_range': calculating_range, 'flavor_text': flavor_text });



        } catch(error) {
            log(chalk.red("Error in battle.monsterAttackPlayer: " + error));
            console.error(error);
        }

    }

    exports.monsterAttackPlayer = monsterAttackPlayer;


    async function moveMonsters(dirty) {

        try {
            // increment battle_time by 100
            global.battle_time += 100;
            // Get monsters that are attacking something
            let monster_battle_linkers = dirty.battle_linkers.filter(battle_linker => battle_linker.attacking_type === 'monster');

            for(let battle_linker of monster_battle_linkers) {

                let monster_index = await main.getMonsterIndex(battle_linker.attacking_id);
                let monster_type_index = main.getMonsterTypeIndex(dirty.monsters[monster_index].monster_type_id);

                let attack_movement_delay = 2000;
                if(dirty.monster_types[monster_type_index].attack_movement_delay) {
                    attack_movemet_delay = dirty.monster_types[monster_type_index].attack_movement_delay;
                }

                // If it's evenly divisible - we're on!
                if(global.battle_time % dirty.monster_types[monster_type_index].attack_movement_delay === 0) {
                    await monster.move(dirty, monster_index, { 'reason': 'battle', 'battle_linker': battle_linker,
                        'monster_type_index': monster_type_index });
                }

            }

            if(global.battle_time > 100000) {
                global.battle_time = 100;
            }

        } catch(error) {
            log(chalk.red("Error in battle.moveMonsters: " + error));
            console.error(error);
        }

        //log(chalk.green("Finished moveMonsters"));

    }

    exports.moveMonsters = moveMonsters;



    async function npcAttackMonster(dirty, battle_linker) {
        try {

            let npc_index = await npc.getIndex(dirty, battle_linker.attacking_id);
            let monster_index = await main.getMonsterIndex(battle_linker.being_attacked_id);

            if(npc_index === -1) {
                log(chalk.yellow("Could not find npc id: " + battle_linker.attacking_id));
                world.removeBattleLinkers(dirty, { 'npc_id': battle_linker.attacking_id });
                return false;
            }

            if(monster_index === -1) {
                log(chalk.yellow("Could not find monster id: " + battle_linker.being_attacked_id));
                world.removeBattleLinkers(dirty, { 'monster_id': battle_linker.being_attacked_id });
                return;
            }

            let npc_info = await world.getNpcCoordAndRoom(dirty, npc_index);
            let monster_info = await monster.getCoordAndRoom(dirty, monster_index);

            if(npc_info.coord === false) {
                log(chalk.yellow("Could not get the npc coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(monster_info.coord === false) {
                log(chalk.yellow("Could not get the monster coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let calculating_range = await calculateRange(
                npc_info.coord.tile_x, npc_info.coord.tile_y,
                monster_info.coord.tile_x, monster_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Npc and monster are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let attack = await calculateNpcAttack(dirty, npc_index, calculating_range);
            let defense = await monster.calculateDefense(dirty, monster_index);

            dirty.npcs[npc_index].attacking_skill_points++;
            dirty.npcs[npc_index].has_change = true;

            if(attack <= defense) {
                return false;
            }

            // See if there's an AI that comes into play
            let damage_amount = attack - defense;


            let ai_index = await world.getAIProtector(dirty, damage_amount, monster_info.coord, 'npc', { 'monster_index': monster_index });
        


            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(monster_info.room).emit('damaged_data',
                    {'monster_id': dirty.monsters[monster_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'npc', 'damage_source_id': dirty.npcs[npc_index].id,
                        'calculating_range': calculating_range });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }

            //console.log("Damage amount: " + damage_amount);

            await monster.damage(dirty, monster_index, damage_amount, {
                'battle_linker': battle_linker, 'monster_info': monster_info, 'calculating_range': calculating_range });


            // TODO increase npc skill
            //await world.increasePlayerSkill(io.sockets.connected[battle_linker.socket_id], dirty, player_index, 'attacking', calculating_range);

        } catch(error) {
            log(chalk.red("Error in battle.npcAttackMonster: " + error));
        }
    }


    async function npcAttackObject(dirty, battle_linker) {
        try {

            let npc_index = await npc.getIndex(dirty, battle_linker.attacking_id);
            if(npc_index === -1) {
                log(chalk.yellow("Could not find npc id: " + battle_linker.attacking_id));
                world.removeBattleLinkers(dirty, { 'npc_id': battle_linker.attacking_id });
                return false;
            }

            let object_index = await game_object.getIndex(dirty, battle_linker.being_attacked_id);

            if(object_index === -1) {
                log(chalk.yellow("Could not find object id: " + battle_linker.being_attacked_id));
                world.removeBattleLinkers(dirty, { 'object_id': battle_linker.being_attacked_id });
                return;
            }

            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);
            let object_info = await game_object.getCoordAndRoom(dirty, object_index);
            let npc_info = await world.getNpcCoordAndRoom(dirty, npc_index);

            if(object_info.coord === false) {
                log(chalk.yellow("Could not get the attacking object coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(npc_info.coord === false) {
                log(chalk.yellow("Could not get the npc coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let calculating_range = await calculateRange(
                npc_info.coord.tile_x, npc_info.coord.tile_y,
                object_info.coord.tile_x, object_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Npc and object are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let attack = await calculateNpcAttack(dirty, npc_index);
            let defense = await game_object.calculateDefense(dirty, object_index);


            dirty.npcs[npc_index].attacking_skill_points++;
            dirty.npcs[npc_index].has_change = true;

            // For whatever reason, the object has no more attacking power (ships, batteries, etc). Remove the battle linker
            if(attack === 0) {



                await world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });

                return false;
            }

            if(attack <= defense) {
                return false;
            }


            let damage_amount = attack - defense;

            let shielded = await world.shielded(dirty, damage_amount, object_index);

            if(shielded) {
                io.to(object_info.room).emit('damaged_data',
                    {'object_id': dirty.objects[object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'npc', 'damage_source_id': dirty.npcs[npc_index].id,
                        'calculating_range': calculating_range });

                return;
            }

            // See if there's an AI that comes into play
            let ai_index = await world.getAIProtected(dirty, damage_amount, object_info.coord, 'npc', { 'object_index': object_index });
        

            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(object_info.room).emit('damaged_data',
                    {'object_id': dirty.objects[object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'npc', 'damage_source_id': dirty.npcs[npc_index].id,
                        'calculating_range': calculating_range });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }

            // No AI - Do the attack/defense normally
            await game_object.damage(dirty, object_index, damage_amount, {
                'battle_linker': battle_linker, 'object_info': object_info, 'calculating_range': calculating_range });


        } catch(error) {
            log(chalk.red("Error in battle.npcAttackObject: " + error));
        }


    }

    exports.npcAttackObject = npcAttackObject;

    async function npcAttackPlayer(dirty, battle_linker) {

        try {

            if(!io.sockets.connected[battle_linker.being_attacked_socket_id]) {
                log(chalk.yellow("Player with being_attacked_socket_id: " + battle_linker.being_attacked_socket_id + " is no longer connected. Removing"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return;
            }

            let npc_index = await npc.getIndex(dirty, battle_linker.attacking_id);
            let player_index = await player.getIndex(dirty, { 'player_id': battle_linker.being_attacked_id });

            if(npc_index === -1) {
                log(chalk.yellow("Could not find npc id: " + battle_linker.attacking_id));
                world.removeBattleLinkers(dirty, { 'npc_id': battle_linker.attacking_id });
                npc.deleteNpc(dirty, battle_linker.attacking_id);
                return;
            }

            if(player_index === -1) {
                log(chalk.yellow("Could not find player id: " + battle_linker.being_attacked_id + ". player_index: " + player_index));
                world.removeBattleLinkers(dirty, { 'player_id': battle_linker.being_attacked_id });
                return;
            }

            let npc_info = await world.getNpcCoordAndRoom(dirty, npc_index);
            let player_info = await world.getPlayerCoordAndRoom(dirty, player_index);

            if(npc_info.coord === false) {
                log(chalk.yellow("Could not get the attacking npc coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(player_info.coord === false) {
                log(chalk.yellow("Could not get the defending player coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(npc_info.room !== player_info.room) {
                log(chalk.yellow("Npc and player don't share the same room"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let calculating_range = await calculateRange(
                npc_info.coord.tile_x, npc_info.coord.tile_y,
                player_info.coord.tile_x, player_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Npc and player are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            dirty.npcs[npc_index].attacking_skill_points++;
            dirty.npcs[npc_index].has_change = true;

            let damage_amount = 0;
            if(dirty.npcs[npc_index].attack_strength > dirty.players[player_index].defense) {
                damage_amount = dirty.npcs[npc_index].attack_strength - dirty.players[player_index].defense;
            }


            let new_player_hp = dirty.players[player_index].current_hp - damage_amount;

            if(new_player_hp <= 0) {
                await player.kill(dirty, player_index);

            } else {

                // update the current hp for the player and the player's socket
                dirty.players[player_index].current_hp = new_player_hp;
                dirty.players[player_index].has_change = true;

                await world.increasePlayerSkill(io.sockets.connected[battle_linker.being_attacked_socket_id], dirty, player_index, ['defending']);

                io.sockets.connected[battle_linker.being_attacked_socket_id].player_current_hp = dirty.players[player_index].current_hp;

                io.sockets.connected[battle_linker.being_attacked_socket_id].emit('damaged_data', {
                    'player_id': dirty.players[player_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'hp',
                    'damage_source_type':'npc','damage_source_id': dirty.npcs[npc_index].id
                });
            }


        } catch(error) {
            log(chalk.red("Error in battle.npcAttackPlayer: " + error));
        }
    }

    exports.npcAttackPlayer = npcAttackPlayer;

    //  data:   attacking_object_index, defending_object_index
    async function objectAttackObject(dirty, battle_linker, data = false) {
        try {

            let attacking_object_index = -1;
            let defending_object_index = -1;

            if(battle_linker) {
                attacking_object_index = await game_object.getIndex(dirty, battle_linker.attacking_id);
                defending_object_index = await game_object.getIndex(dirty, battle_linker.being_attacked_id);
            } else if(typeof data.attacking_object_index !== 'undefined' && typeof data.defending_object_index !== 'undefined') {
                attacking_object_index = data.attacking_object_index;
                defending_object_index = data.defending_object_index;
            }



            if(attacking_object_index === -1) {
                log(chalk.yellow("Could not get the attacking object"));
                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }

            if(defending_object_index === -1) {
                log(chalk.yellow("Could not get the defending object"));

                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }

            let attacking_object_info = await game_object.getCoordAndRoom(dirty, attacking_object_index);
            let defending_object_info = await game_object.getCoordAndRoom(dirty, defending_object_index);

            if(attacking_object_info.coord === false) {
                log(chalk.yellow("Could not get the attacking object coord"));
                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }

            if(defending_object_info.coord === false) {
                log(chalk.yellow("Could not get the defending object coord"));
                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }

            if(attacking_object_info.room !== defending_object_info.room) {
                log(chalk.yellow("Objects don't share the same room"));
                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }


            let attacking_object_type_index = main.getObjectTypeIndex(dirty.objects[attacking_object_index].object_type_id);


            let calculating_range = await calculateRange(
                attacking_object_info.coord.tile_x, attacking_object_info.coord.tile_y,
                defending_object_info.coord.tile_x, defending_object_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Objects are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            //console.log("Attacking object index: " + attacking_object_index + " id: " + dirty.objects[attacking_object_index].id);

            let object_attack_profile = await calculateObjectAttack(dirty, attacking_object_index);
            let attack = object_attack_profile.damage_amount;
            //console.log("Got attack object damage types as: ");
            //console.log(object_attack_profile.damage_types);
            let defense = await game_object.calculateDefense(dirty, defending_object_index);

            // For whatever reason, the object has no more attacking power (ships, batteries, etc). Remove the battle linker
            if(attack === 0) {
                console.log("No attack value. Removing battle linker");


                if(battle_linker.socket_id) {
                    io.to(battle_linker.socket_id).emit('result_info', {'status': 'failure', 'text': 'No attack power. Do your weapons have energy/material?'});
                }


                await world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                

                return false;
            }

            if(attack <= defense) {
                io.to(defending_object_info.room).emit('damaged_data',
                    {'object_id': dirty.objects[defending_object_index].id, 'damage_amount': 0, 'was_damaged_type': 'hp',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                        'damage_types': object_attack_profile.damage_types,
                        'calculating_range': calculating_range });
                return false;

            }


            let damage_amount = attack - defense;

            let shielded = await world.shielded(dirty, damage_amount, defending_object_index);

            if(shielded) {
                io.to(defending_object_info.room).emit('damaged_data',
                    {'object_id': dirty.objects[defending_object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                        'calculating_range': calculating_range, 'damage_types': object_attack_profile.damage_types });

                return;
            }

            // See if there's an AI that comes into play
            let ai_index = await world.getAIProtector(dirty, damage_amount, defending_object_info.coord, 'object', { 'object_index': defending_object_index });

            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(defending_object_info.room).emit('damaged_data',
                    {'object_id': dirty.objects[defending_object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                        'calculating_range': calculating_range, 'damage_types': object_attack_profile.damage_types });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }
            // Adding in code for a spacelane beacon to help out
            else if(defending_object_info.room === 'galaxy' && defending_object_info.coord.watched_by_object_id &&
                dirty.objects[attacking_object_index].id !== defending_object_info.coord.watched_by_object_id) {
                console.log("Coord is watched");

                let watching_object_index = await game_object.getIndex(dirty, defending_object_info.coord.watched_by_object_id);
                if(watching_object_index !== -1 && dirty.objects[watching_object_index].energy > damage_amount) {
                    log(chalk.green("Watcher is helping out!"));
                    dirty.objects[watching_object_index].energy -= damage_amount;
                    dirty.objects[watching_object_index].has_change = true;

                    let watching_object_type_index = main.getObjectTypeIndex(dirty.objects[watching_object_index].object_type_id);

                    io.to(defending_object_info.room).emit('damaged_data',
                        {'object_id': dirty.objects[defending_object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                            'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                            'calculating_range': calculating_range, 'damage_types': object_attack_profile.damage_types });
                    objectAttackObject(dirty, false, { 'attacking_object_index': watching_object_index, 'defending_object_index': attacking_object_index });
                }

                return;
            }

            // No AI - Do the attack/defense normally
            await game_object.damage(dirty, defending_object_index, damage_amount, {
                'battle_linker': battle_linker, 'object_info': defending_object_info, 'calculating_range': calculating_range,
                'damage_types': object_attack_profile.damage_types,
                'damage_source_type': 'object', 'damage_source_id': dirty.objects[attacking_object_index].id });


        } catch(error) {
            log(chalk.red("Error in battle.objectAttackObject: " + error));
            console.error(error);
        }
    }


    //  data:   attacking_object_index   |   defending_planet_index
    async function objectAttackPlanet(dirty, battle_linker, data = false) {
        try {

            let attacking_object_index = -1;
            let defending_planet_index = -1;

            if(battle_linker) {
                attacking_object_index = await game_object.getIndex(dirty, battle_linker.attacking_id);
                defending_planet_index = await planet.getIndex(dirty, { 'planet_id': battle_linker.being_attacked_id });
            } else if(typeof data.attacking_object_index !== 'undefined' && typeof data.defending_object_index !== 'undefined') {
                console.log("In objectAttackPlanet without a battle linker");
                attacking_object_index = data.attacking_object_index;
                defending_planet_index = data.defending_planet_index;
            }



            if(attacking_object_index === -1) {
                log(chalk.yellow("Could not get the attacking object"));
                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }

            if(defending_planet_index === -1) {
                log(chalk.yellow("Could not get the defending planet."));

                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }

            let attacking_object_info = await game_object.getCoordAndRoom(dirty, attacking_object_index);
            let defending_planet_info = await planet.getCoordAndRoom(dirty, defending_planet_index);

            if(attacking_object_info.coord === false) {
                log(chalk.yellow("Could not get the attacking object coord"));
                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }

            if(defending_planet_info.coord === false) {
                log(chalk.yellow("Could not get the defending planet coord"));
                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }

            if(attacking_object_info.room !== 'galaxy') {
                log(chalk.yellow("Can't attack a planet if you aren't in the galaxy"));
                if(battle_linker) {
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                }

                return false;
            }


            let attacking_object_type_index = main.getObjectTypeIndex(dirty.objects[attacking_object_index].object_type_id);


            let calculating_range = await calculateRange(
                attacking_object_info.coord.tile_x, attacking_object_info.coord.tile_y,
                defending_planet_info.coord.tile_x, defending_planet_info.coord.tile_y);

            if(calculating_range > 10) {
                log(chalk.yellow("Object and planet are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            //console.log("Attacking object index: " + attacking_object_index + " id: " + dirty.objects[attacking_object_index].id);

            let object_attack_profile = await calculateObjectAttack(dirty, attacking_object_index);
            let attack = object_attack_profile.damage_amount;
            //console.log("Got attack object damage types as: ");
            //console.log(object_attack_profile.damage_types);

            // Woo complex planet defense calculation!
            let defense = 1;

            // For whatever reason, the object has no more attacking power (ships, batteries, etc). Remove the battle linker
            if(attack === 0) {
                console.log("No attack value. Removing battle linker");

                if(battle_linker.socket_id) {
                    io.to(battle_linker.socket_id).emit('result_info', {'status': 'failure', 'text': 'No attack power. Do your weapons have energy/material?'});
                }

                await world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });

                return false;
            }

            if(attack <= defense) {
                io.to(defending_object_info.room).emit('damaged_data',
                    {'planet_id': dirty.planets[defending_planet_index].id, 'damage_amount': 0, 'was_damaged_type': 'hp',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                        'damage_types': object_attack_profile.damage_types,
                        'calculating_range': calculating_range });
                return false;

            }


            let damage_amount = attack - defense;


            /* Not sure that this shielded stuff applies to planets
            let shielded = await world.shielded(dirty, damage_amount, defending_object_index);

            if(shielded) {
                io.to(defending_object_info.room).emit('damaged_data',
                    {'object_id': dirty.objects[defending_object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                        'calculating_range': calculating_range, 'damage_types': object_attack_profile.damage_types });

                return;
            }
            */

            // See if there's an AI that comes into play
            let ai_index = await world.getAIProtector(dirty, damage_amount, defending_planet_info.coord, 'object', { 'planet_index': defending_planet_index });

            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(defending_planet_info.room).emit('damaged_data',
                    {'planet_id': dirty.planets[defending_planet_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                        'calculating_range': calculating_range, 'damage_types': object_attack_profile.damage_types });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }

            /*
            let ai_index = await world.getAIProtector(dirty, { 'damage_amount': damage_amount,
                'object_index': defending_object_index, 'coord': defending_object_info.coord });

            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(defending_object_info.room).emit('damaged_data',
                    {'object_id': dirty.objects[defending_object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                        'calculating_range': calculating_range, 'damage_types': object_attack_profile.damage_types });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }
            // Adding in code for a spacelane beacon to help out
            else if(defending_object_info.room === 'galaxy' && defending_object_info.coord.watched_by_object_id &&
                dirty.objects[attacking_object_index].id !== defending_object_info.coord.watched_by_object_id) {
                console.log("Coord is watched");

                let watching_object_index = await game_object.getIndex(dirty, defending_object_info.coord.watched_by_object_id);
                if(watching_object_index !== -1 && dirty.objects[watching_object_index].energy > damage_amount) {
                    log(chalk.green("Watcher is helping out!"));
                    dirty.objects[watching_object_index].energy -= damage_amount;
                    dirty.objects[watching_object_index].has_change = true;

                    let watching_object_type_index = main.getObjectTypeIndex(dirty.objects[watching_object_index].object_type_id);

                    io.to(defending_object_info.room).emit('damaged_data',
                        {'object_id': dirty.objects[defending_object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                            'damage_source_type':'object', 'damage_source_id': dirty.objects[attacking_object_index].id,
                            'calculating_range': calculating_range, 'damage_types': object_attack_profile.damage_types });
                    objectAttackObject(dirty, false, { 'attacking_object_index': watching_object_index, 'defending_object_index': attacking_object_index });
                }

                return;
            }

            */


            

            // No AI - Do the attack/defense normally
            await game.damagePlanet(dirty, { 'planet_index': defending_planet_index, 'damage_amount': damage_amount,
                'battle_linker': battle_linker, 'planet_info': defending_planet_info, 'calculating_range': calculating_range,
                'damage_types': object_attack_profile.damage_types,
                'damage_source_type': 'object', 'damage_source_id': dirty.objects[attacking_object_index].id });


        } catch(error) {
            log(chalk.red("Error in battle.objectAttackPlanet: " + error));
            console.error(error);
        }
    }

    async function objectAttackPlayer(dirty, battle_linker, data = false) {

        try {

            if(battle_linker && !io.sockets.connected[battle_linker.being_attacked_socket_id]) {
                log(chalk.yellow("Player with being_attacked_socket_id: " + battle_linker.being_attacked_socket_id + " is no longer connected. Removing"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return;
            }

            let object_index = -1;
            if(battle_linker) {
                object_index = await game_object.getIndex(dirty, battle_linker.attacking_id);
            } else if(typeof data.object_index !== 'undefined') {
                object_index = data.object_index;
            }



            if(object_index === -1) {
                log(chalk.yellow("Could not find object"));

                if(battle_linker) {
                    log(chalk.yellow("Could not find object id: " + battle_linker.attacking_id));
                    world.removeBattleLinkers(dirty, { 'object_id': battle_linker.attacking_id });
                }


                return;
            }


            let player_index = -1;
            if(battle_linker) {
                player_index = await player.getIndex(dirty, { 'player_id': battle_linker.being_attacked_id });
            } else if(typeof data.player_index !== 'undefined') {
                player_index = data.player_index;
            }


            if(player_index === -1) {
                log(chalk.yellow("Could not find player"));
                if(battle_linker) {
                    log(chalk.yellow("Could not find player id: " + battle_linker.being_attacked_id + ". player_index: " + player_index));
                    world.removeBattleLinkers(dirty, { 'player_id': battle_linker.being_attacked_id });
                }

                return;
            }


            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);
            let object_info = await game_object.getCoordAndRoom(dirty, object_index);
            let player_info = await world.getPlayerCoordAndRoom(dirty, player_index);

            if(object_info.coord === false) {
                log(chalk.yellow("Could not get the attacking object coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(player_info.coord === false) {
                log(chalk.yellow("Could not get the defending player coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(object_info.room !== player_info.room) {
                log(chalk.yellow("Object and player don't share the same room"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let calculating_range = await calculateRange(
                object_info.coord.tile_x, object_info.coord.tile_y,
                player_info.coord.tile_x, player_info.coord.tile_y);

            if(calculating_range > dirty.object_types[object_type_index].max_attack_range) {
                log(chalk.yellow("Object and player are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let object_attack_profile = await calculateObjectAttack(dirty, object_index);
            let attack = object_attack_profile.damage_amount;
            let defense = await player.calculateDefense(dirty, player_index);

            if(object_attack_profile.damage_amount <= defense) {

                // I think it will be better if we send damaged data even for a non hit
                io.to(player_info.room).emit('damaged_data',
                    {'player_id': dirty.players[player_index].id, 'damage_amount': 0, 'was_damaged_type': 'hp',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[object_index].id,
                        'damage_types': object_attack_profile.damage_types,
                        'calculating_range': calculating_range });
                return false;
            }

            // See if there's an AI that comes into play
            let damage_amount = attack - defense;

            let ai_index = await world.getAIProtector(dirty, damage_amount, player_info.coord, 'object', { 'player_index': player_index });


            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(player_info.room).emit('damaged_data',
                    {'player_id': dirty.players[player_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'object', 'damage_source_id': dirty.objects[object_index].id,
                        'damage_types': object_attack_profile.damage_types,
                        'calculating_range': calculating_range });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }


            await lpayer.damage(dirty, { 'player_index': player_index, 'damage_amount': damage_amount,
                'damage_types': object_attack_profile.damage_types,
                'battle_linker': battle_linker, 'calculating_range': calculating_range });


        } catch(error) {
            log(chalk.red("Error in battle.objectAttackPlayer: " + error));
            console.error(error);
        }

    }



    async function playerAttackMonster(dirty, battle_linker) {

        try {
            //console.time("playerAttackMonster");

            if(!io.sockets.connected[battle_linker.socket_id]) {
                console.log("Player is not connected");
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return;
            }


            let monster_index = await main.getMonsterIndex(battle_linker.being_attacked_id);
            let player_index = await player.getIndex(dirty, {'player_id':battle_linker.attacking_id});

            if(monster_index === -1) {
                log(chalk.yellow("Could not find monster id: " + battle_linker.being_attacked_id));
                world.removeBattleLinkers(dirty, { 'monster_id': battle_linker.being_attacked_id });
                return;
            }


            if(player_index === -1) {
                log(chalk.yellow("Could not find player id: " + battle_linker.attacking_id));
                world.removeBattleLinkers(dirty, { 'player_id': battle_linker.attacking_id });
                return;
            }


            let player_info = await world.getPlayerCoordAndRoom(dirty, player_index);
            let monster_info = await monster.getCoordAndRoom(dirty, monster_index);

            if(player_info.coord === false) {
                log(chalk.yellow("Could not get the player coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let player_body_index = await game_object.getIndex(dirty, dirty.players[player_index].body_id);

            if(player_body_index === -1) {
                log(chalk.yellow("Unable to find player's body"));
                return false;
            }

            if(monster_info.coord === false) {
                log(chalk.yellow("Could not get the monster coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(player_info.room !== monster_info.room) {
                log(chalk.yellow("Player and monster don't share the same room"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }


            let calculating_range = await calculateRange(
                player_info.coord.tile_x, player_info.coord.tile_y,
                monster_info.coord.tile_x, monster_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Player and object are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            // Gotta see if there is something that would be blocking us
            if(calculating_range > 1) {
                console.time("hasLineOfSight");
                let has_line_of_sight = await game.hasLineOfSight(dirty, player_info.scope, player_info.coord_index, monster_info.coord_index);
                console.timeEnd("hasLineOfSight");
                if(!has_line_of_sight) {
                    console.log("Something is blocking ranged line of sight. Removing battle linker");
                    world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                    return false;
                }
                
            }

            let player_attack_profile = await calculatePlayerAttack(dirty, player_index, player_body_index, calculating_range);

            let attack = player_attack_profile.damage_amount;
            //console.log("Player attack is: " + attack);
            let defense = await monster.calculateDefense(dirty, monster_index, player_attack_profile.damage_types, player_attack_profile);


            if(attack <= defense) {
                return false;
            }

            //console.log("Attack: " + attack + " defense: " + defense);

            let damage_amount = attack - defense;



            // See if there's an AI that comes into play

            let ai_index = await world.getAIProtector(dirty, damage_amount, monster_info.coord, 'player', { 'monster_index': monster_index });



            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(monster_info.room).emit('damaged_data',
                    {'monster_id': dirty.monsters[monster_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'player', 'damage_source_id': dirty.players[player_index].id,
                        'calculating_range': calculating_range });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }

            //console.log("Sending damage types to game.damageMonster:");
            //console.log(player_attack_profile.damage_types);

            await monster.damage(dirty, monster_index, damage_amount, {
                'damage_types': player_attack_profile.damage_types,
                'battle_linker': battle_linker, 'monster_info': monster_info, 'calculating_range': calculating_range });


            await world.increasePlayerSkill(io.sockets.connected[battle_linker.socket_id], dirty, player_index, player_attack_profile.damage_types);

            //console.timeEnd("playerAttackMonster");

            // If one of the things had an attack radius, we attack the tiles around too
            if(player_attack_profile.radius_damage_amounts.length > 0) {
                //log(chalk.green("Player attacked with something with an attack radius!"));
                //console.log(player_attack_profile.radius_damage_amounts);
                for(let r = 0; r < player_attack_profile.radius_damage_amounts.length; r++) {
                    //console.log(player_attack_profile.radius_damage_amounts[r]);
                    let starting_x = monster_info.coord.tile_x - player_attack_profile.radius_damage_amounts[r].radius;
                    let ending_x = monster_info.coord.tile_x + player_attack_profile.radius_damage_amounts[r].radius;
                    let starting_y = monster_info.coord.tile_y - player_attack_profile.radius_damage_amounts[r].radius;
                    let ending_y = monster_info.coord.tile_y + player_attack_profile.radius_damage_amounts[r].radius;

                    //console.log("Going to also hit from " + starting_x + ", " + starting_y + " to " + ending_x + "," + ending_y);

                    for(let x = starting_x; x <= ending_x; x++) {
                        for(let y = starting_y; y <=ending_y; y++) {

                            // already attacked this one!
                            if(x === monster_info.coord.tile_x && y === monster_info.coord.tile_y) {

                            } else {

                                //console.log("Attacking tile_x,tile_y: " + x + "," + y);
                                if(monster_info.scope === 'planet') {
                                    let planet_coord_index = await main.getPlanetCoordIndex(
                                        { 'planet_id': monster_info.coord.planet_id,
                                            'planet_level': monster_info.coord.level, 'tile_x': x, 'tile_y': y});
                                    if(planet_coord_index !== -1) {
                                        await damageTile(dirty, {'planet_coord_index': planet_coord_index,
                                            'damage_amount': player_attack_profile.radius_damage_amounts[r].damage_amount,
                                            'damage_source_type': 'player', 'damage_source_id': dirty.players[player_index].id,
                                            'damage_type': player_attack_profile.radius_damage_amounts[r].damage_type
                                            });
                                    }
                                } else if(monster_info.scope === 'ship') {
                                    let ship_coord_index = await main.getShipCoordIndex({
                                        'ship_id': monster_info.coord.ship_id, 'level': monster_info.coord.level, 'tile_x': x, 'tile_y': y
                                    });
                                    if(ship_coord_index !== -1) {
                                        await damageTile(dirty, {'ship_coord_index': ship_coord_index,
                                            'damage_amount': player_attack_profile.radius_damage_amounts[r].damage_amount,
                                            'damage_source_type': 'player', 'damage_source_id': dirty.players[player_index].id,
                                            'damage_type': player_attack_profile.radius_damage_amounts[r].damage_type
                                        });
                                    }

                                }

                            }


                        }
                    }
                }

            }



            // Not 100% sure why I don't have this IN the calculate player attack stuff. Maybe I need the equipment linkers in here
            // If some of the things have the is_consumed_on_attack flag, we decrement how many of them
            //      there are
            decrementEquipmentLinkers(dirty, player_attack_profile, battle_linker.socket_id);

        } catch(error) {
            log(chalk.red("Error in playerAttackMonster: " + error));
        }


    }

    async function playerAttackNpc(dirty, battle_linker) {

        try {
            console.log("Have that player " + battle_linker.attacking_id + " is attacking npc: " + battle_linker.being_attacked_id);
            console.log("attacking id is now: " + battle_linker.attacking_id);

            if(!io.sockets.connected[battle_linker.socket_id]) {
                console.log("Player is not connected");
                world.removeBattleLinkers(dirty, {'battle_linker_id': battle_linker.id });
                return;
            }


            let npc_index = await npc.getIndex(dirty, battle_linker.being_attacked_id);
            let player_index = await player.getIndex(dirty, {'player_id':battle_linker.attacking_id});

            if(npc_index === -1) {
                log(chalk.yellow("Could not find NPC id: " + battle_linker.being_attacked_id));
                world.removeBattleLinkers(dirty, { 'npc_id': battle_linker.being_attacked_id });
                return;
            }

            if(player_index === -1) {
                log(chalk.yellow("Could not find player id: " + battle_linker.attacking_id + ". player_index: " + player_index));
                world.removeBattleLinkers(dirty, { 'player_id': battle_linker.attacking_id });
                return;
            }

            let player_info = await world.getPlayerCoordAndRoom(dirty, player_index);
            let npc_info = await world.getNpcCoordAndRoom(dirty, npc_index);

            if(player_info.coord === false) {
                log(chalk.yellow("Could not get the player coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let player_body_index = await game_object.getIndex(dirty, dirty.players[player_index].body_id);

            if(player_body_index === -1) {
                log(chalk.yellow("Unable to find player's body"));
                return false;
            }

            if(npc_info.coord === false) {
                log(chalk.yellow("Could not get the npc coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(player_info.room !== npc_info.room) {
                log(chalk.yellow("Player and npc don't share the same room"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let calculating_range = await calculateRange(
                player_info.coord.tile_x, player_info.coord.tile_y,
                npc_info.coord.tile_x, npc_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Player and npc are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let player_attack_profile = await calculatePlayerAttack(dirty, player_index, player_body_index, calculating_range);
            let attack = player_attack_profile.damage_amount;
            let defense = await calculateNpcDefense(dirty, npc_index);

            dirty.npcs[npc_index].defending_skill_points++;
            dirty.npcs[npc_index].has_change = true;

            if(attack <= defense) {
                return false;
            }

            let damage_amount = attack - defense;

            // See if there's an AI that comes into play
            let ai_index = await world.getAIProtector(dirty, damage_amount, npc_info.coord, 'player', { 'npc_index': npc_index });


            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(npc_info.room).emit('damaged_data',
                    {'npc_id': dirty.npcs[npc_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'player', 'damage_source_id': dirty.players[player_index].id,
                        'calculating_range': calculating_range });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }

            //console.log("Damage amount: " + damage_amount);

            // TODO I would like to eventually put this in npc.deleteNpc 
            if(damage_amount > dirty.npcs[npc_index].current_hp) {
                world.addPlayerLog(dirty, player_index, "The heroic " + dirty.players[player_index].name + " has defeated " + dirty.npcs[npc_index].name + " and saved the planet");
            }

            await npc.damage(dirty, npc_index, damage_amount,
                { 'battle_linker': battle_linker, 'npc_info': npc_info, 'calculating_range': calculating_range });





            await world.increasePlayerSkill(io.sockets.connected[battle_linker.socket_id], dirty, player_index, player_attack_profile.damage_types);

            // If one of the damage types was control, we can see if we enslave the npc
            let try_enslavement = false;
            for(let e = 0; e < player_attack_profile.damage_types.length; e++) {
                if(player_attack_profile.damage_types[e] === 'control') {
                    log(chalk.cyan("Player did an attack with a control component!"));
                    try_enslavement = true;
                }
            }

            if(try_enslavement) {
                world.enslave(io.sockets.connected[battle_linker.socket_id], dirty, { 'enslaving_player_index': player_index, 'being_enslaved_npc_index': npc_index});
            }

            // Not 100% sure why I don't have this IN the calculate player attack stuff. Maybe I need the equipment linkers in here
            // If some of the things have the is_consumed_on_attack flag, we decrement how many of them
            //      there are
            decrementEquipmentLinkers(dirty, player_attack_profile, battle_linker.socket_id);


        } catch(error) {
            log(chalk.red("Error in battle.playerAttackNpc: " + error));
            console.error(error);
        }


    }

    async function playerAttackObject(dirty, battle_linker) {

        try {

            if(!io.sockets.connected[battle_linker.socket_id]) {
                console.log("Player is not connected");
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return;
            }

            let object_index = await game_object.getIndex(dirty, battle_linker.being_attacked_id);
            let player_index = await player.getIndex(dirty, { 'player_id':battle_linker.attacking_id});

            if(object_index === -1) {
                log(chalk.yellow("Could not find object id: " + battle_linker.being_attacked_id));
                world.removeBattleLinkers(dirty, { 'object_id': battle_linker.being_attacked_id });
                return;
            }

            if(player_index === -1) {
                log(chalk.yellow("Could not find player id: " + battle_linker.attacking_id + ". player_index: " + player_index));
                world.removeBattleLinkers(dirty, { 'player_id': battle_linker.attacking_id });
                return;
            }

            let player_info = await world.getPlayerCoordAndRoom(dirty, player_index);
            let object_info = await game_object.getCoordAndRoom(dirty, object_index);

            if(player_info.coord === false) {
                log(chalk.yellow("Could not get the player coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);

            let player_body_index = await game_object.getIndex(dirty, dirty.players[player_index].body_id);

            if(player_body_index === -1) {
                log(chalk.yellow("Unable to find player's body"));
                return false;
            }

            if(object_info.coord === false) {
                log(chalk.yellow("Could not get the object coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(player_info.room !== object_info.room) {
                log(chalk.yellow("Player and object don't share the same room"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let calculating_range = await calculateRange(
                player_info.coord.tile_x, player_info.coord.tile_y,
                object_info.coord.tile_x, object_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Player and object are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let player_attack_profile = await calculatePlayerAttack(dirty, player_index, player_body_index, calculating_range);
            let attack = player_attack_profile.damage_amount;
            let defense = await game_object.calculateDefense(dirty, object_index, player_attack_profile.damage_types);


            if(attack <= defense) {
                return false;
            }

            let damage_amount = attack - defense;

            let ai_index = await world.getAIProtector(dirty, damage_amount, object_info.coord, 'player', { 'object_index': object_index });


            //console.log("AI index returned: " + ai_index);

            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(object_info.room).emit('damaged_data',
                    {'object_id': dirty.objects[object_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'player', 'damage_source_id': dirty.players[player_index].id,
                        'calculating_range': calculating_range });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }

            // No AI - Do the attack/defense normally
            await game_object.damage(dirty, object_index, damage_amount, {
                'damage_types': player_attack_profile.damage_types,
                'battle_linker': battle_linker, 'object_info': object_info, 'calculating_range': calculating_range });


            if(dirty.object_types[object_type_index].attack_strength >= 1) {
                await world.increasePlayerSkill(io.sockets.connected[battle_linker.socket_id], dirty, player_index, player_attack_profile.damage_types);
            }
            

            decrementEquipmentLinkers(dirty, player_attack_profile, battle_linker.socket_id);


        } catch(error) {
            log(chalk.red("Error in battle.playerAttackObject: " + error));
            console.error(error);
        }

    }

    async function playerAttackPlayer(dirty, battle_linker) {

        try {
            console.log("In player attack player");
            if(!io.sockets.connected[battle_linker.socket_id]) {
                log(chalk.yellow("Attacking player is no longer connected"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return;
            }

            if(!io.sockets.connected[battle_linker.being_attacked_socket_id]) {
                log(chalk.yellow("Being attacked player is no longer connected"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return;
            }

            let attacking_player_index = await player.getIndex(dirty, { 'player_id': battle_linker.attacking_id });
            let defending_player_index = await player.getIndex(dirty, { 'player_id': battle_linker.being_attacked_id });

            if(attacking_player_index === -1 || defending_player_index === -1) {
                log(chalk.yellow("Couldn't find one of the players"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return;

            }

            let attacking_player_info = await world.getPlayerCoordAndRoom(dirty, attacking_player_index);
            let defending_player_info = await world.getPlayerCoordAndRoom(dirty, defending_player_index);

            if(attacking_player_info.coord === false) {
                log(chalk.yellow("Could not get the attacking player coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let attacking_player_body_index = await game_object.getIndex(dirty, dirty.players[attacking_player_index].body_id);

            if(attacking_player_body_index === -1) {
                log(chalk.yellow("Unable to find attacking player's body"));
                return false;
            }

            if(defending_player_info.coord === false) {
                log(chalk.yellow("Could not get the defending object coord"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            if(attacking_player_info.room !== defending_player_info.room) {
                log(chalk.yellow("Players don't share the same room"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let calculating_range = await calculateRange(
                attacking_player_info.coord.tile_x, attacking_player_info.coord.tile_y,
                defending_player_info.coord.tile_x, defending_player_info.coord.tile_y);

            if(calculating_range > 8) {
                log(chalk.yellow("Players are too far apart"));
                world.removeBattleLinkers(dirty, { 'battle_linker_id': battle_linker.id });
                return false;
            }

            let player_attack_profile = await calculatePlayerAttack(dirty, attacking_player_index, attacking_player_body_index, calculating_range);
            let attack = player_attack_profile.damage_amount;
            let defense = await player.calculateDefense(dirty, defending_player_index);

            if(attack <= defense) {
                io.to(defending_player_info.room).emit('damaged_data',
                {'player_id': dirty.players[defending_player_index].id, 'damage_amount': 0, 'was_damaged_type': 'hp',
                    'damage_source_type':'player', 'damage_source_id': dirty.players[attacking_player_index].id,
                    'damage_types': player_attack_profile.damage_types,
                    'calculating_range': calculating_range });
                return false;
            }

            // See if there's an AI that comes into play
            let damage_amount = attack - defense;

            let ai_index = await world.getAIProtector(dirty, damage_amount, defending_player_info.coord, 'player', { 'player_index': defending_player_index });

        

            if(ai_index !== -1) {
                dirty.objects[ai_index].energy -= damage_amount;
                dirty.objects[ai_index].has_change = true;

                io.to(defending_player_info.room).emit('damaged_data',
                    {'player_id': dirty.players[defending_player_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                        'damage_source_type':'player', 'damage_source_id': dirty.players[attacking_player_index].id,
                        'damage_types': player_attack_profile.damage_types,
                        'calculating_range': calculating_range });

                await world.aiRetaliate(dirty, ai_index, battle_linker.attacking_type, battle_linker.attacking_id);
                return;
            }
            // Adding in code for a spacelane beacon to help out
            else if(defending_player_info.room === 'galaxy' && defending_player_info.coord.watched_by_object_id) {
                let watching_object_index = await game_object.getIndex(dirty, defending_player_info.coord.watched_by_object_id);
                if(watching_object_index !== -1 && dirty.objects[watching_object_index].energy > damage_amount) {
                    log(chalk.green("Watcher is helping out!"));

                    let watching_object_type_index = main.getObjectTypeIndex(dirty.objects[watching_object_index].object_type_id);
                    io.to(defending_player_info.room).emit('damaged_data',
                        {'player_id': dirty.players[defending_player_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'energy',
                            'damage_source_type':'player', 'damage_source_id': dirty.players[attacking_player_index].id,
                            'calculating_range': calculating_range, 'damage_types': [ dirty.object_types[watching_object_type_index].equip_skill ] });
                    objectAttackPlayer(dirty, false, { 'object_index': watching_object_index, 'player_index': attacking_player_index });

                    return
                }
            }


            await player.damage(dirty, { 'player_index': defending_player_index, 'damage_amount': damage_amount,
                'battle_linker': battle_linker, 'calculating_range': calculating_range });

            // Update the attacker
            await world.increasePlayerSkill(io.sockets.connected[battle_linker.socket_id], dirty, attacking_player_index, player_attack_profile.damage_types);

            // send the damage info to the attacker as well

            io.sockets.connected[battle_linker.socket_id].emit('damaged_data', {
                'player_id': dirty.players[defending_player_index].id, 'damage_amount': damage_amount, 'was_damaged_type': 'hp',
                'damage_source_type':'player','damage_source_id': dirty.players[attacking_player_index].id,
                'damage_types': player_attack_profile.damage_types,
                'calculating_range': calculating_range
            });


            decrementEquipmentLinkers(dirty, player_attack_profile, battle_linker.socket_id);


        } catch(error) {
            log(chalk.red("Error in battle.playerAttackPlayer: " + error));
            console.error(error);
        }

    }


    // data: equipment_linker_index   |   amount
    async function removeFromEquipmentLinker(dirty, socket, data) {
        try {

            dirty.equipment_linkers[data.equipment_linker_index].amount -= data.amount;

            if(dirty.equipment_linkers[data.equipment_linker_index].amount > 0) {
                //console.log("Reduced equipment number");
                dirty.equipment_linkers[data.equipment_linker_index].has_change = true;

                // Send the socket if we can
                if(socket) {
                    socket.emit('equipment_linker_info', { 'equipment_linker': dirty.equipment_linkers[data.equipment_linker_index] });
                }

                return;
            }

            console.log("Deleting equipment linker");

            // DELETING IT
            (pool.query("DELETE FROM equipment_linkers WHERE id = ?", [dirty.equipment_linkers[data.equipment_linker_index].id]));

            socket.emit('equipment_linker_info', { 'remove': true, 'equipment_linker': dirty.equipment_linkers[data.equipment_linker_index] });

            delete dirty.equipment_linkers[data.equipment_linker_index];

        } catch(error) {
            log(chalk.red("Error in battle.removeFromEquipmentLinker: " + error));
            console.error(error);
        }
    }

    exports.removeFromEquipmentLinker = removeFromEquipmentLinker;


