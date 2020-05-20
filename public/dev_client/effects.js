/**
 * 
 * @param {Object} data 
 * @param {Array} data.damage_types
 * @param {number} data.x - The x location of whatever was hit
 * @param {number} data.y - The y location of whatever was hit
 * @param {string} data.damage_source_type
 * @param {string} data.damage_source_id
 */
function addEffect(data) {

    let debug_effects = true;

    if(debug_effects) {
        console.log("Looking to add an effect");
    }


    let scene_game = game.scene.getScene('sceneGame');


    if(data.damage_types.length <= 0) {
        console.log("%c Trying to add an effect, but no damage types: ", log_warning);
        console.log(data);
        console.trace();
        return false;
    }


    for(let i = 0; i < data.damage_types.length; i++) {

        if(debug_effects) {
            console.log("Damage tyep: " + data.damage_types[i]);
        }


        let effect_sprite_index = -1;

        // See if we already have a matching effect sprite active
        for(let e = 0; e < effect_sprites.length && effect_sprite_index === -1; e++) {

            if(effect_sprites[e] && effect_sprites[e].visible === true && effect_sprites[e].damage_type === data.damage_types[i]) {

                effect_sprite_index = e;

                if(debug_effects) {
                    console.log("Found a matching active effect sprite");
                }
                
                
            }

        }



        // See if we have a non-visible effect sprite
        for(let e = 0; e < effect_sprites.length && effect_sprite_index === -1; e++) {

            if(effect_sprites[e] && effect_sprites[e].visible === false) {

                effect_sprite_index = e;

                if(debug_effects) {
                    console.log("Found an invisible effect sprite we can re-use");
                }
            }

        }

        

        // If effect_sprite_index is still -1, we need to create a sprite
        if(effect_sprite_index === -1) {
            effect_sprite_index = effect_sprites.push(scene_game.add.sprite(data.x + 32, data.y + 32, '')) - 1;
            effect_sprites[effect_sprite_index].setDepth(11);

            if(debug_effects) {
                console.log("Created new effect sprite");
            }
        }


        // Let our effect sprite know the source and destination
        effect_sprites[effect_sprite_index].damage_type = data.damage_types[i];
        effect_sprites[effect_sprite_index].damage_source_type = data.damage_source_type;
        effect_sprites[effect_sprite_index].damage_source_id = data.damage_source_id;

        if(data.monster_id) {
            effect_sprites[effect_sprite_index].monster_id = data.monster_id;
        }

        if(data.npc_id) {
            effect_sprites[effect_sprite_index].npc_id = data.npc_id;
        }

        if(data.object_id) {
            effect_sprites[effect_sprite_index].object_id = data.object_id;
        }
        
        if(data.planet_id) {
            effect_sprites[effect_sprite_index].planet_id = data.planet_id;
        }

        if(data.player_id) {
            effect_sprites[effect_sprite_index].player_id = data.player_id;
        }

        let new_texture_key = false;
        let new_texture_animation_key = false;
        let effect_type = "point";

    
        // Setting the textures and offsets specific to the effect being drawn
        if(data.damage_types[i] === 'addiction') {
            new_texture_key = 'addiction-effect';
            new_texture_animation_key = 'addiction-effect-animation';
            data.x += 32;
        } else if(data.damage_types[i] === 'decay') {
            new_texture_key = 'decay-effect';
            new_texture_animation_key = 'decay-effect-animation';
            data.x += 32;
        } else if(data.damage_types[i] === 'explosion') {
            new_texture_key = 'explosion-effect';
            new_texture_animation_key = 'explosion-effect-animation';
            data.x += 32;
            data.y += 32;
        } else if(data.damage_types[i] === 'electric') {
            new_texture_key = 'electric-effect';
            new_texture_animation_key = 'electric-effect-animation';
            data.x += 32;
            data.y += 32;
        } else if(data.damage_types[i] === 'healing') {

        } else if(data.damage_types[i] === 'heat') {
            new_texture_key = 'heat-effect';
            new_texture_animation_key = 'heat-effect-animation';
            effect_type = 'beam';
            data.x += 32;
            data.y += 32;
        } else if(data.damage_types[i] === 'laser') {
            new_texture_key = 'laser-effect';
            new_texture_animation_key = 'laser-effect-animation';
            effect_type = 'beam';
            data.x += 32;
            data.y += 32;
        } else if(data.damage_types[i] === 'melee' || data.damage_types[i] === 'normal' || data.damage_types[i] === 'none') {
            new_texture_key = 'melee-effect';
            new_texture_animation_key = 'melee-effect-animation';
            data.x += 32;
            data.y += 32;
        } else if(data.damage_types[i] === 'poison') {
            new_texture_key = 'poison-effect';
            new_texture_animation_key = 'poison-effect-animation';
            data.x += 32;
        } else if(data.damage_types[i] === 'radiation') {
            new_texture_key = 'radiation-effect';
            new_texture_animation_key = 'radiation-effect-animation';
            data.x += 32;
        } else if(data.damage_types[i] === 'repairing') {
            new_texture_key = 'repair-effect';
            new_texture_animation_key = 'repair-effect-animation';
            data.x += 32;
            data.y += 32;
        }


        effect_sprites[effect_sprite_index].effect_type = effect_type;



        if(!effect_sprites[effect_sprite_index].texture || effect_sprites[effect_sprite_index].texture.key !== new_texture_key) {
            if(debug_effects) {
                console.log("Switching texture for effect sprite");
            }
            effect_sprites[effect_sprite_index].setTexture(new_texture_key);

            console.log("Effect texture key: " + effect_sprites[effect_sprite_index].texture.key);
            effect_sprites[effect_sprite_index].play(new_texture_animation_key);

            // Reset the displayWidth
            effect_sprites[effect_sprite_index].displayWidth = effect_sprites[effect_sprite_index].width;
            effect_sprites[effect_sprite_index].displayHeight = effect_sprites[effect_sprite_index].height;
            
        } else {
            effect_sprites[effect_sprite_index].play(new_texture_animation_key);
        }

        // For a point, the x and y are the destination - whatever was damaged
        if(effect_type === 'point') {
            effect_sprites[effect_sprite_index].x = data.x;
            effect_sprites[effect_sprite_index].y = data.y;
            effect_sprites[effect_sprite_index].setVisible(true);
        } 
        // For a beam, the x and y are the source
        else if(effect_type === 'beam') {

            if(debug_effects) {
                console.log("Effect sprite is a beam!");
            }

            
            effect_sprites[effect_sprite_index].setOrigin(0,.5);

            // For a beam type, we are going to have to set the x,y to our damage source
             if(data.damage_source_type === 'monster') {

                let monster_index = getMonsterIndex(data.damage_source_id);
                if(monsters[monster_index].sprite) {
                    effect_sprites[effect_sprite_index].x = monsters[monster_index].sprite.x;
                    effect_sprites[effect_sprite_index].y = monsters[monster_index].sprite.y;
                } else {
                    // We might have a coord for this monster - nad we can use that
                    let attacking_monster_info = getMonsterInfo(monster_index);
                    if(attacking_monster_info.coord) {
                        effect_sprites[effect_sprite_index].x = tileToPixel(attacking_monster_info.coord.tile_x) + 32;
                        effect_sprites[effect_sprite_index].y = tileToPixel(attacking_monster_info.coord.tile_y) + 32;
                    }
                }

            } else if(data.damage_source_type === 'object') {
                let object_index = getObjectIndex(data.damage_source_id);
                let attacking_object_info = getObjectInfo(object_index);
                if(attacking_object_info.coord) {
                    effect_sprites[effect_sprite_index].x = tileToPixel(attacking_object_info.coord.tile_x) + 32;
                    effect_sprites[effect_sprite_index].y = tileToPixel(attacking_object_info.coord.tile_y) + 32;
                }
            } else if(data.damage_source_type === 'player') {
            
                let player_index = getPlayerIndex(data.damage_source_id);
                if(players[player_index].sprite) {
                    effect_sprites[effect_sprite_index].x = players[player_index].sprite.x;
                    effect_sprites[effect_sprite_index].y = players[player_index].sprite.y;
                }
                
                if(debug_effects) {
                    console.log("damage_source_type was player");
                }
            } 

            if(debug_effects) {
                console.log("data.x,y: " + data.x + ", " + data.y);
            }


            let distance = Phaser.Math.Distance.Between(effect_sprites[effect_sprite_index].x,
                effect_sprites[effect_sprite_index].y,
                data.x, data.y);
            let angle_between = Phaser.Math.Angle.Between(effect_sprites[effect_sprite_index].x, 
                effect_sprites[effect_sprite_index].y,
                data.x, data.y);

            effect_sprites[effect_sprite_index].displayWidth = distance;

            if(debug_effects) {
                console.log("Distance: " + distance);
            }

            // mining_beam_sprite.rotation = angle_between - 1.4;
            effect_sprites[effect_sprite_index].rotation = angle_between;
            effect_sprites[effect_sprite_index].setVisible(true);

            effect_sprites[effect_sprite_index].destination_x = data.x;
            effect_sprites[effect_sprite_index].destination_y = data.y;

        }



    }



}


function updateEffectSprites(moved_type, moved_index) {
    // If the mining beam sprite is visible, we gotta move it!
    if(mining_beam_sprite.visible) {
        mining_beam_sprite.x = players[client_player_index].sprite.x;
        mining_beam_sprite.y = players[client_player_index].sprite.y;

        let distance = Phaser.Math.Distance.Between(players[client_player_index].sprite.x, players[client_player_index].sprite.y,
            mining_beam_sprite.object_x, mining_beam_sprite.object_y);
        let angle_between = Phaser.Math.Angle.Between(players[client_player_index].sprite.x, players[client_player_index].sprite.y,
            mining_beam_sprite.object_x, mining_beam_sprite.object_y);

        mining_beam_sprite.displayWidth = distance;
        // mining_beam_sprite.rotation = angle_between - 1.4;
        mining_beam_sprite.rotation = angle_between;
    } 
    
    if(salvaging_beam_sprite.visible) {
        salvaging_beam_sprite.x = players[client_player_index].sprite.x;
        salvaging_beam_sprite.y = players[client_player_index].sprite.y;

        let distance = Phaser.Math.Distance.Between(players[client_player_index].sprite.x, players[client_player_index].sprite.y,
            salvaging_beam_sprite.object_x, salvaging_beam_sprite.object_y);
        let angle_between = Phaser.Math.Angle.Between(players[client_player_index].sprite.x, players[client_player_index].sprite.y,
            salvaging_beam_sprite.object_x, salvaging_beam_sprite.object_y);

        salvaging_beam_sprite.displayWidth = distance;
        // mining_beam_sprite.rotation = angle_between - 1.4;
        salvaging_beam_sprite.rotation = angle_between;
    }

    // If there's a heat sprite visible attached to us, move that as well
    
    for(let i = 0; i < effect_sprites.length; i++) {

        if(effect_sprites[i] && effect_sprites[i].visible && effect_sprites[i].effect_type === 'beam') {


            let effect_needs_update = false;

            if( effect_sprites[i].object_id) {

                console.log("Have an effect sprite to update!");
    
                let object_index = getObjectIndex(effect_sprites[i].object_id);
                let object_info = getObjectInfo(object_index);
    
                let object_x_beam = tileToPixel(object_info.coord.tile_x) + 32;
                let object_y_beam = tileToPixel(object_info.coord.tile_y) + 32;
    
                effect_sprites[i].x = players[client_player_index].sprite.x;
                effect_sprites[i].y = players[client_player_index].sprite.y;
    
                let distance = Phaser.Math.Distance.Between(players[client_player_index].sprite.x, players[client_player_index].sprite.y,
                object_x_beam, object_y_beam);
                let angle_between = Phaser.Math.Angle.Between(players[client_player_index].sprite.x, players[client_player_index].sprite.y,
                object_x_beam, object_y_beam);
    
                effect_sprites[i].displayWidth = distance;
                // mining_beam_sprite.rotation = angle_between - 1.4;
                effect_sprites[i].rotation = angle_between;
    
            } else if(moved_type === 'player' && effect_sprites[i].damage_source_type === 'player' && effect_sprites[i].damage_source_id === players[moved_index].id) {

                effect_needs_update = true;
                effect_sprites[i].x = players[moved_index].sprite.x;
                effect_sprites[i].y = players[moved_index].sprite.y;

                

            } else if(moved_type === 'object' && effect_sprites[i].damage_source_type === 'object' && effect_sprites[i].damage_source_id === objects[moved_index].id) {

                console.log("Effect with object attacking needs update!");
                effect_needs_update = true;


                // We're going to track the player sprite instead of the object if this is a ship
                let object_is_active_ship = false;
                let player_index = -1;
                for(let p = 0; p < players.length; p++) {
                    if(players[p] && players[p].ship_id === objects[moved_index].id) {
                        object_is_active_ship = true;
                        player_index = p;
                    }
                }

                if(current_view === 'galaxy' && object_is_active_ship) {
                    effect_sprites[i].x = players[player_index].sprite.x;
                    effect_sprites[i].y = players[player_index].sprite.y;
    

                } else if(objects[moved_index].sprite) {
                    effect_sprites[i].x = objects[moved_index].sprite.x;
                    effect_sprites[i].y = objects[moved_index].sprite.y;
                }

            }


            if(effect_needs_update) {
                let distance = Phaser.Math.Distance.Between(effect_sprites[i].x, effect_sprites[i].y,
                    effect_sprites[i].destination_x, effect_sprites[i].destination_y);
                let angle_between = Phaser.Math.Angle.Between(effect_sprites[i].x, effect_sprites[i].y,
                    effect_sprites[i].destination_x, effect_sprites[i].destination_y);
    
                effect_sprites[i].displayWidth = distance;
                // mining_beam_sprite.rotation = angle_between - 1.4;
                effect_sprites[i].rotation = angle_between;
    
            }


    
        }

       
    }


}