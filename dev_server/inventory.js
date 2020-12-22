var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;


const game_object = require('./game_object.js');
const helper = require('./helper.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
const npc = require('./npc.js');
const player = require('./player.js');
const world = require('./world.js');


/**
 * @param {Object} socket
 * @param {Object} dirty
 * @param {Object} data
 * @param {String} data.adding_to_type
 * @param {number} data.adding_to_id
 * @param {number=} data.amount
 * @param {number=} data.object_type_id
 * @param {number=} data.object_id
 * @param {number=} data.price
 */
async function addToInventory(socket, dirty, data) {

    try {

        // gotta make sure those ints are ints!
        let price = 0;
        if(data.price) {
            price = data.price;
        }

        data.amount = parseInt(data.amount);

        if(data.amount === 0) {
            log(chalk.yellow("Tried adding 0 of something to inventory. Returning false"));
            return false;
        }

        let owner_object_index = -1;
        let npc_index = -1;
        let player_index = -1;
        let inventory_item_index = -1;
        let sending_to_room = "";

        if(data.adding_to_type === 'object') {
            owner_object_index = await game_object.getIndex(dirty, data.adding_to_id);

            if(owner_object_index === -1) {
                log(chalk.yellow("Could not find the object we are putting something into"));
                return false;
            }
        } else if(data.adding_to_type === 'npc') {
            npc_index = await npc.getIndex(dirty, data.adding_to_id);

            if(npc_index !== -1) {
                sending_to_room = dirty.npcs[npc_index].room;
            } else {
                console.log("Failed to get the npc in dirty");
            }
        }


        

        // I could potentiall use socket.player_index here - HOWEVER - I might be sending in a valid socket when
        // an admin does something - not sure. I have to check all instances of addToInventory to see if I should 
        // send socket = false sometimes.
        if(data.adding_to_type === 'player') {
            player_index = await player.getIndex(dirty, { 'player_id': data.adding_to_id });

            if(player_index === -1) {
                log(chalk.yellow("Could not find player to add inventory to"));
                return false;
            }
        }


        // if we have an object id, we aways just have to push a new inventory item
        if(data.object_id) {
            let sql = "";
            let inserts;

            let object_index = await game_object.getIndex(dirty, data.object_id);
            let object_type_index = main.getObjectTypeIndex(dirty.objects[object_index].object_type_id);
            // Lets grab it
            if(!data.object_type_id) {

                data.object_type_id = dirty.object_types[object_type_index].id;
            }

            if(data.adding_to_type === 'player') {

                sql = "INSERT INTO inventory_items(player_id,body_id,object_id,object_type_id,amount, price) VALUES(?,?,?,?,?,?)";
                inserts = [data.adding_to_id, dirty.players[player_index].body_id, data.object_id, data.object_type_id, 1, price];
            } else if(data.adding_to_type === 'npc') {
                sql = "INSERT INTO inventory_items(npc_id,object_id,object_type_id,amount, price) VALUES(?,?,?,?,?)";
                inserts = [data.adding_to_id, data.object_id, data.object_type_id, 1, price];
            } else if(data.adding_to_type === 'object') {
                sql = "INSERT INTO inventory_items(owned_by_object_id,object_id,object_type_id,amount, price) VALUES(?,?,?,?,?)";
                inserts = [data.adding_to_id, data.object_id, data.object_type_id, 1, price];
            }

            let [result] = await (pool.query(sql,
                inserts));

            let new_id = result.insertId;
            //console.log("Got new inventory item id: " + new_id);
            let [rows, fields] = await (pool.query("SELECT * FROM inventory_items WHERE id = ?", [new_id]));
            if(rows[0]) {
                let adding_inventory_item = rows[0];
                adding_inventory_item.has_change = false;

                let new_inventory_item_index = dirty.inventory_items.push(adding_inventory_item) - 1;
                world.processInventoryItem(dirty, new_inventory_item_index);

                // make sure the player has the object info
                game_object.sendInfo(socket, false, dirty, object_index);

                // and send the new inventory item to the socket that took it

                let sending_to_room = "";
                if(npc_index !== -1) {
                    sending_to_room = dirty.npcs[npc_index].room;
                }

                sendInventoryItem(socket, sending_to_room, dirty, new_inventory_item_index, 'take');
                console.log("Sent new inventory item to socket");



            }

        } else if(data.object_type_id) {



            // lets see if we have an inventory item index
            if(data.adding_to_type === 'player') {
                inventory_item_index = dirty.inventory_items.findIndex(function (obj) {
                    return obj && obj.player_id === data.adding_to_id && obj.body_id === dirty.players[player_index].body_id && obj.object_type_id === data.object_type_id; });
            } else if(data.adding_to_type === 'npc') {
                inventory_item_index = dirty.inventory_items.findIndex(function (obj) {
                    return obj && obj.npc_id === data.adding_to_id && obj.object_type_id === data.object_type_id; });
            } else if(data.adding_to_type === 'object') {
                inventory_item_index = dirty.inventory_items.findIndex(function (obj) {
                    return obj && obj.owned_by_object_id === data.adding_to_id && obj.object_type_id === data.object_type_id; });
            }

            if(inventory_item_index !== -1) {
                dirty.inventory_items[inventory_item_index].amount += data.amount;
                dirty.inventory_items[inventory_item_index].has_change = true;



                sendInventoryItem(socket, sending_to_room, dirty, inventory_item_index, 'take');
            } else {

                // need to add it
                let sql = "";
                let inserts;


                if(data.adding_to_type === 'player') {
                    sql = "INSERT INTO inventory_items(player_id,body_id,object_type_id,amount,price) VALUES(?,?,?,?,?)";
                    inserts = [data.adding_to_id, dirty.players[player_index].body_id, data.object_type_id, data.amount, price];
                } else if(data.adding_to_type === 'npc') {
                    sql = "INSERT INTO inventory_items(npc_id,object_type_id,amount,price)VALUES(?,?,?,?)";
                    inserts = [data.adding_to_id, data.object_type_id, data.amount, price];
                } else if(data.adding_to_type === 'object') {
                    sql = "INSERT INTO inventory_items(owned_by_object_id,object_type_id,amount,price)VALUES(?,?,?,?)";
                    inserts = [data.adding_to_id, data.object_type_id, data.amount, price];
                }

                let [result] = await (pool.query(sql,
                    inserts));

                let new_id = result.insertId;
                //console.log("Got new inventory item id: " + new_id);
                let [rows, fields] = await (pool.query("SELECT * FROM inventory_items WHERE id = ?", [new_id]));
                if(rows[0]) {
                    let adding_inventory_item = rows[0];
                    adding_inventory_item.has_change = false;
                    inventory_item_index = dirty.inventory_items.push(adding_inventory_item) - 1;
                    world.processInventoryItem(dirty, inventory_item_index);

                    sendInventoryItem(socket, sending_to_room, dirty, inventory_item_index, 'take');
                }
            }



        } else if(data.floor_type_id) {

            inventory_item_index = -1;

            if(data.adding_to_type === 'player') {
                inventory_item_index = dirty.inventory_items.findIndex(function (obj) {
                    return obj && obj.player_id === data.adding_to_id && obj.floor_type_id === data.floor_type_id;
                });
            } else if(data.adding_to_type === 'npc') {
                inventory_item_index = dirty.inventory_items.findIndex(function (obj) {
                    return obj && obj.npc_id === data.adding_to_id && obj.floor_type_id === data.floor_type_id; });
            } else if(data.adding_to_type === 'object') {
                inventory_item_index = dirty.inventory_items.findIndex(function (obj) {
                    return obj && obj.owned_by_object_id === data.adding_to_id && obj.floor_type_id === data.floor_type_id; });
            }

            if (inventory_item_index !== -1) {
                dirty.inventory_items[inventory_item_index].amount += data.amount;
                dirty.inventory_items[inventory_item_index].has_change = true;

                sendInventoryItem(socket, sending_to_room, dirty, inventory_item_index, 'take');
            } else {

                let sql = "";
                let inserts;

                if(data.adding_to_type === 'player') {
                    sql = "INSERT INTO inventory_items(player_id,body_id,floor_type_id,amount,price) VALUES(?,?,?,?,?)";
                    inserts = [data.adding_to_id, dirty.players[player_index].body_id, data.floor_type_id, data.amount, price];
                } else if(data.adding_to_type === 'npc') {
                    sql = "INSERT INTO inventory_items(npc_id,floor_type_id,amount,price)VALUES(?,?,?,?)";
                    inserts = [data.adding_to_id, data.floor_type_id, data.amount, price];
                } else if(data.adding_to_type === 'object') {
                    sql = "INSERT INTO inventory_items(owned_by_object_id,floor_type_id,amount,price)VALUES(?,?,?,?)";
                    inserts = [data.adding_to_id, data.floor_type_id, data.amount, price];
                }


                let [result] = await (pool.query(sql,
                    inserts));

                let new_id = result.insertId;
                //console.log("Got new inventory item id: " + new_id);
                let [rows, fields] = await (pool.query("SELECT * FROM inventory_items WHERE id = ?", [new_id]));
                if (rows[0]) {
                    let adding_inventory_item = rows[0];
                    adding_inventory_item.has_change = false;

                    let new_inventory_item_index = dirty.inventory_items.push(adding_inventory_item) - 1;
                    world.processInventoryItem(dirty, new_inventory_item_index);

                    sendInventoryItem(socket, sending_to_room, dirty, new_inventory_item_index, 'take');
                }

            }

        }


        if(data.adding_to_type === 'player') {

            await sendInventory(socket, false, dirty, 'player', data.adding_to_id);
        } else if(data.adding_to_type === 'object' && owner_object_index !== -1) {

            //console.log("Owner object index was " + owner_object_index);
            if(!dirty.objects[owner_object_index].has_inventory) {
                log(chalk.cyan("Setting has_inventory to true for object id: " + dirty.objects[owner_object_index].id));
                dirty.objects[owner_object_index].has_inventory = true;
                dirty.objects[owner_object_index].has_change = true;

                //console.log("Calling sendObjectInfo from inventory.addToInventory");
                await game_object.sendInfo(false, "planet_" + dirty.objects[owner_object_index].planet_id, dirty, owner_object_index);
            }


        } else if(data.adding_to_type === 'npc' && npc_index !== -1) {

            //console.log("NPC added something to its inventory");
            if(!dirty.npcs[npc_index].has_inventory) {
                dirty.npcs[npc_index].has_inventory = true;
                dirty.npcs[npc_index].has_change = true;
            }

             // and we set the price based on how many we have
             if(inventory_item_index !== -1 && dirty.inventory_items[inventory_item_index].object_type_id !== 74) {
                let price = Math.ceil(1000 / dirty.inventory_items[inventory_item_index].amount);
                //console.log("Setting price of npc's inventory item to: " + price);
                dirty.inventory_items[inventory_item_index].price = price;
                dirty.inventory_items[inventory_item_index].has_change = true;
            } else {

                if(inventory_item_index === -1) {
                    console.log("inventory_item_index was -1");
                }

                if(dirty.inventory_items[inventory_item_index].object_type_id === 74) {
                    console.log("was credits, not setting a price.");
                }

            }


            await world.sendNpcInfo(false, "planet_" + dirty.npcs[npc_index].planet_id, dirty, dirty.npcs[npc_index].id);
        }

    } catch(error) {
        log(chalk.red("Error in inventory.addToInventory: " + error));
        console.error(error);
    }


}



exports.addToInventory = addToInventory;


async function buy(socket, dirty, data) {

    try {

        log(chalk.green("Player is buying an inventory item. inventory_item_id: " + data.inventory_item_id));

        let inventory_item_id = parseInt(data.inventory_item_id);

        let inventory_item_index = await main.getInventoryItemIndex(inventory_item_id);

        if(inventory_item_index === -1) {
            log(chalk.yellow("Unable to find inventory_item with that id"));
            return false;
        }


        let inventory_item_price = parseInt(dirty.inventory_items[inventory_item_index].price);

        if(inventory_item_price > 0) {

            let player_inventory_item_index = dirty.inventory_items.findIndex(function(obj) { return obj && obj.player_id === socket.player_id && obj.object_type_id === 74; });

            if(player_inventory_item_index !== -1) {
                if(dirty.inventory_items[player_inventory_item_index].amount >= inventory_item_price) {
                    console.log("Player can afford this!");

                    if(dirty.inventory_items[inventory_item_index].object_type_id) {
                        let adding_to_data = { 'adding_to_type':'player', 'adding_to_id':socket.player_id,
                            'object_type_id': dirty.inventory_items[inventory_item_index].object_type_id, 'amount':1};

                        await addToInventory(socket, dirty, adding_to_data);
                    } else if(dirty.inventory_items[inventory_item_index].floor_type_id) {
                        let adding_to_data = { 'adding_to_type':'player', 'adding_to_id':socket.player_id,
                            'floor_type_id': dirty.inventory_items[inventory_item_index].floor_type_id, 'amount':1};

                        await addToInventory(socket, dirty, adding_to_data);
                    }

                    // remove the credits from the buying player
                    let remove_player_inventory_data = { 'inventory_item_id': dirty.inventory_items[player_inventory_item_index].id,
                        'amount': dirty.inventory_items[inventory_item_index].price };
                    await removeFromInventory(socket, dirty, remove_player_inventory_data);

                    // add the credits to whoever owned that inventory item
                    if(dirty.inventory_items[inventory_item_index].player_id) {
                        let adding_to_data = { 'adding_to_type':'player', 'adding_to_id':socket.player_id,
                            'object_type_id': 74, 'amount': dirty.inventory_items[inventory_item_index].price };

                        await addToInventory(socket, dirty, adding_to_data);
                    } else if(dirty.inventory_items[inventory_item_index].npc_id) {
                        let adding_to_data = { 'adding_to_type':'npc', 'adding_to_id': dirty.inventory_items[inventory_item_index].npc_id,
                            'object_type_id': 74, 'amount': dirty.inventory_items[inventory_item_index].price };

                        await addToInventory(socket, dirty, adding_to_data);
                    } else if(dirty.inventory_items[inventory_item_index].owned_by_object_id) {

                        // crap now we need to get the owner of the object. Player or npc
                        let object_index = await game_object.getIndex(dirty, dirty.inventory_items[inventory_item_index].owned_by_object_id);
                        if(object_index !== -1) {
                            if(dirty.objects[object_index].player_id) {

                                let adding_to_data = { 'adding_to_type':'player', 'adding_to_id': dirty.objects[object_index].player_id,
                                    'object_type_id': 74, 'amount': dirty.inventory_items[inventory_item_index].price };

                                await addToInventory(socket, dirty, adding_to_data);

                            } else if(dirty.objects[object_index].npc_id) {
                                let adding_to_data = { 'adding_to_type':'npc', 'adding_to_id': dirty.objects[object_index].npc_id,
                                    'object_type_id': 74, 'amount': dirty.inventory_items[inventory_item_index].price };

                                await addToInventory(socket, dirty, adding_to_data);
                            }
                        }
                    }

                    // remove the item from the old place
                    let remove_inventory_data = { 'inventory_item_id': dirty.inventory_items[player_inventory_item_index].id, 'amount': 1};
                    await removeFromInventory(socket, dirty, remove_inventory_data);



                    log(chalk.cyan("Done with adding inventory"));
                } else {
                    socket.emit('chat', {'message': 'You cannot afford that', 'scope': 'system' });
                }
            }
        }


    } catch(error) {
        log(chalk.red("Error in inventory.buy : " + error));
    }

}

exports.buy = buy;


// Placing something in something else
// data:    inventory_item_id
async function place(socket, dirty, data) {

    try {

        let storage_object_id = parseInt(data.storage_object_id);



        let inventory_item_index = -1;
        if(data.inventory_item_id) {
            log(chalk.green("Got place data. inventory_item_id: " + data.inventory_item_id + " storage_object_id: " +
                storage_object_id + " amount: " + data.amount));
            inventory_item_index = await main.getInventoryItemIndex(parseInt(data.inventory_item_id));
        }

        let storage_object_index = await game_object.getIndex(dirty, storage_object_id);


        if(storage_object_index === -1) {
            log(chalk.yellow("Unable to get storage object"));
            return false;
        }

        if(data.inventory_item_id && inventory_item_index === -1) {
            log(chalk.yellow("Unable to get inventory item"));
            return false;
        }


        let storage_object_info = await game_object.getCoordAndRoom(dirty, storage_object_index);

        let storage_object_type_index = main.getObjectTypeIndex(dirty.objects[storage_object_index].object_type_id);

        if(dirty.object_types[storage_object_type_index].is_converter) {
            log(chalk.red("Use game.convert instead!"));
            console.trace("TRACED!!!");
            return false;
        }

        if(!dirty.object_types[storage_object_type_index].can_have_inventory) {
            log(chalk.yellow("Storage object type cannot have inventory"));
            return false;
        }


        let put_amount = 1;
        if(data.amount === 'all') {
            put_amount = dirty.inventory_items[inventory_item_index].amount;
        } else if(parseInt(data.amount) === 10) {
            put_amount = 10;

            if(dirty.inventory_items[inventory_item_index].amount < 10) {
                put_amount = dirty.inventory_items[inventory_item_index].amount;
            }
        }

        

        // The other type is simple storing objects/object_types
        // TODO allow for rules for storing (and taking) things
        // Commented out: && dirty.objects[storage_object_index].player_id === socket.player_id
        // Reason, kind of the TODO above. Have more tiers of smart storage with locks and junk

        let adding_to_data;

        if(dirty.inventory_items[inventory_item_index].object_id) {
            adding_to_data = { 'adding_to_type': 'object', 'adding_to_id': dirty.objects[storage_object_index].id,
                'object_id': dirty.inventory_items[inventory_item_index].object_id,
                'object_type_id': dirty.inventory_items[inventory_item_index].object_type_id, 'amount':put_amount };
        } else if(dirty.inventory_items[inventory_item_index].object_type_id) {
            adding_to_data = { 'adding_to_type': 'object', 'adding_to_id': dirty.objects[storage_object_index].id,
                'object_type_id': dirty.inventory_items[inventory_item_index].object_type_id, 'amount':put_amount };
        } else if(dirty.inventory_items[inventory_item_index].floor_type_id) {
            adding_to_data = { 'adding_to_type': 'object', 'adding_to_id': dirty.objects[storage_object_index].id,
                'floor_type_id': dirty.inventory_items[inventory_item_index].floor_type_id, 'amount':put_amount };
        }

        await addToInventory(socket, dirty, adding_to_data);

        let remove_inventory_data = { 'inventory_item_id': dirty.inventory_items[inventory_item_index].id,
            'amount': put_amount };
        await removeFromInventory(socket, dirty, remove_inventory_data);
        //removeInventoryItem(socket, dirty, inventory_item.id);

        await sendInventory(socket, false, dirty, 'player', socket.player_id);
        await game_object.sendInfo(socket, storage_object_info.room, dirty, storage_object_index);
        await sendInventory(socket, storage_object_info.room, dirty, 'object', dirty.objects[storage_object_index].id);
        


    } catch(error) {
        log(chalk.red("Error in inventory.place: " + error));
        console.error(error);
    }
}

exports.place = place;

function priceUpdate(socket, data) {
    console.log("Player is updating price for " + data.inventory_item_id + " to " + data.new_price);

    var sql = "SELECT inventory_items.id, inventory_items.owned_by_object_id, objects.player_id as owned_by_object_player_id FROM inventory_items LEFT JOIN objects ON objects.id = inventory_items.owned_by_object_id WHERE inventory_items.id = ?";
    var bindings = [data.inventory_item_id];
    sql = mysql.format(sql, bindings);
    pool.query(sql, function(err, rows, fields) {
        if(err) throw err;

        if(rows[0]) {
            var inventory_item = rows[0];

            if(socket.player_id == inventory_item.owned_by_object_player_id) {
                // update the price
                sql = "UPDATE inventory_items SET price = ? WHERE id = ?";
                bindings = [data.new_price, inventory_item.id];
                sql = mysql.format(sql, bindings);
                pool.query(sql, function(err, result) {
                    if(err) throw err;
                });
            }
        }
    });
}

exports.priceUpdate = priceUpdate;

/**
 * 
 * @param {Object} socket 
 * @param {Object} dirty 
 * @param {Object} data 
 * @param {number} data.inventory_item_id
 * @param {number} data.amount
 * @param {number=} data.player_index
 * @param {number=} data.object_id
 * @param {number=} data.removing_object_type_id
 */
async function removeFromInventory(socket, dirty, data) {

    try {
        //log(chalk.green("\nIn removeFromInventory"));

        let inventory_item_index = -1;
        let inventory_item_id = parseInt(data.inventory_item_id);
        data.amount = parseInt(data.amount);

        if (data.inventory_item_id) {

            //console.log("Was sent in inventory item id: " + inventory_item_id);
            inventory_item_index = await main.getInventoryItemIndex(inventory_item_id);

        }  else if(typeof data.player_index !== 'undefined') {
            inventory_item_index = dirty.inventory_items.findIndex(function (obj) {
                return obj && obj.player_id === dirty.players[data.player_index].id && obj.body_id === dirty.players[data.player_index].body_id && 
                obj.object_type_id === data.removing_object_type_id;
            });
            
        
        } else if (data.object_id) {
            inventory_item_index = dirty.inventory_items.findIndex(function (obj) {
                return obj && obj.object_id === data.object_id && obj.object_type_id === data.removing_object_type_id;
            });
        }

        if(inventory_item_index === -1) {
            log(chalk.yellow("Couldn't find inventory item"));
            return false;
        }

        //console.log("Working with inventory item id: " + dirty.inventory_items[inventory_item_index].id +
        //    " amount: " + dirty.inventory_items[inventory_item_index].amount);


        if (dirty.inventory_items[inventory_item_index].amount <= data.amount) {
            //console.log("Deleting inventory item id: " + dirty.inventory_items[inventory_item_index].id);

            // We are trying/testing to not await for this - since the delete can take quite a bit of time
            (pool.query("DELETE FROM inventory_items WHERE id = ?", [dirty.inventory_items[inventory_item_index].id]));


            // send new inventory item data
            if(dirty.inventory_items[inventory_item_index].player_id && dirty.inventory_items[inventory_item_index].player_id === socket.player_id) {
                //console.log("Telling client to remove inventory item");
                socket.emit('inventory_item_info', { 'remove': true, 'inventory_item': dirty.inventory_items[inventory_item_index] });
            }

            // Send to people in the room to remove this inventory item
            // I'm working on making sure when someone takes from somewhere, that it is updated
            if(dirty.inventory_items[inventory_item_index].owned_by_object_id) {
                let inventory_object_index = await game_object.getIndex(dirty, dirty.inventory_items[inventory_item_index].owned_by_object_id);
                if(inventory_item_index !== -1) {
                    if(dirty.objects[inventory_object_index].planet_coord_id) {
                        let coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.objects[inventory_object_index].planet_coord_id });
                        if(coord_index !== -1) {
                            io.to("planet_" + dirty.planet_coords[coord_index].planet_id).emit('inventory_item_info',
                                { 'remove': true, 'inventory_item': dirty.inventory_items[inventory_item_index] });
                        }
                    } else if(dirty.objects[inventory_object_index].ship_coord_id) {
                        let coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[inventory_object_index].ship_coord_id });
                        if(coord_index !== -1) {
                            io.to("ship_" + dirty.ship_coords[coord_index].ship_id).emit('inventory_item_info',
                                { 'remove': true, 'inventory_item': dirty.inventory_items[inventory_item_index] });
                        }
                    }
                }

            }

            delete dirty.inventory_items[inventory_item_index];
            //console.log("Removed inventory item from dirty");

        } else {
            //console.log("Reducing inventory amount by " + data.amount);
            dirty.inventory_items[inventory_item_index].amount = dirty.inventory_items[inventory_item_index].amount - data.amount;
            dirty.inventory_items[inventory_item_index].has_change = true;


            // They took from it - they should know about the change
            if(socket) {
                socket.emit('inventory_item_info', { 'inventory_item': dirty.inventory_items[inventory_item_index] });
            }

            // Send to people in the room to remove this inventory item
            // I'm working on making sure when someon takes from somewhere, that it is updated
            if(dirty.inventory_items[inventory_item_index].owned_by_object_id) {
                let inventory_object_index = await game_object.getIndex(dirty, dirty.inventory_items[inventory_item_index].owned_by_object_id);
                if(inventory_item_index !== -1) {
                    if(dirty.objects[inventory_object_index].planet_coord_id) {
                        let coord_index = await main.getPlanetCoordIndex({ 'planet_coord_id': dirty.objects[inventory_object_index].planet_coord_id });
                        if(coord_index !== -1) {
                            io.to("planet_" + dirty.planet_coords[coord_index].planet_id).emit('inventory_item_info',
                                { 'inventory_item': dirty.inventory_items[inventory_item_index] });
                        }
                    } else if(dirty.objects[inventory_object_index].ship_coord_id) {
                        let coord_index = await main.getShipCoordIndex({ 'ship_coord_id': dirty.objects[inventory_object_index].ship_coord_id });
                        if(coord_index !== -1) {
                            io.to("ship_" + dirty.planet_coords[coord_index].planet_id).emit('inventory_item_info',
                                { 'inventory_item': dirty.inventory_items[inventory_item_index] });
                        }
                    }
                }

            }
        }

    } catch(error) {
        log(chalk.red("Error in inventory.removeFromInventory: " + error));
        console.error(error);
    }

}

exports.removeFromInventory = removeFromInventory;


function removeSpawnedObject(object_id) {
    log(chalk.red("calling old function removeSpawnedObject"));
    return;
    sql = "UPDATE objects SET has_spawned_object = false WHERE id = ?";
    inserts = [object_id];
    sql = mysql.format(sql, inserts);
    pool.query(sql, function(err, result) {
        if(err) throw err;
    });
}

exports.removeSpawnedObject = removeSpawnedObject;



// For sending the entire inventory of a player, object, ect
async function sendInventory(socket, room, dirty, type, type_id) {

    try {
        let inventory_items = false;

        if(type === 'player') {

            inventory_items = dirty.inventory_items.filter(inventory_item => inventory_item.player_id === type_id);

        } else if(type === 'object') {
            //console.log("Sending object Inventory for object id " + type_id);
            inventory_items = dirty.inventory_items.filter(inventory_item => inventory_item.owned_by_object_id === type_id);
        }


        if(inventory_items !== false) {
            inventory_items.forEach(function(inventory_item) {

                if(helper.notFalse(socket)) {
                    socket.emit('inventory_item_info', { 'inventory_item': inventory_item });
                } else if(room !== false) {
                    io.to(room).emit('inventory_item_info', { 'inventory_item': inventory_item });
                }


            });
        }
    } catch(error) {
        log(chalk.red("Error in inventory.sendInventory:" + error));
        console.error(error);
    }

}

exports.sendInventory = sendInventory;

// For sending one inventory_item
function sendInventoryItem(socket, room, dirty, inventory_item_index, action) {

    try {
        //console.log("Sending inventory item to socket with player id: " + socket.player_id);

        if(action === 'remove') {
            let sending_inventory_item = dirty.inventory_items[inventory_item_index];
            sending_inventory_item.remove = true;
            if(helper.notFalse(socket)) {
                socket.emit('inventory_item_info', { 'inventory_item': sending_inventory_item });
            }
            
        } else {

            if(helper.notFalse(socket)) {
                socket.emit('inventory_item_info', { 'inventory_item': dirty.inventory_items[inventory_item_index] });
            }

            if(helper.notFalse(room)) {
                io.to(room).emit('inventory_item_info', { 'inventory_item': dirty.inventory_items[inventory_item_index] });
            }
            
        }
    } catch(error) {
        log(chalk.red("Error in inventory.sendInventoryItem: " + error));
        console.error(error);
    }


}

exports.sendInventoryItem = sendInventoryItem;

// inventory_item_id   |
async function take(socket, dirty, inventory_item_id, amount) {

    try {
        inventory_item_id = parseInt(inventory_item_id);
        //console.log("player is taking an inventory item id: " + inventory_item_id);

        let inventory_item_index = await main.getInventoryItemIndex(inventory_item_id);

        if(inventory_item_index === -1) {
            log(chalk.yellow("Unable to find inventory item"));
            return false;
        }

        let take_amount = 1;
        if(amount === 'all') {
            take_amount = dirty.inventory_items[inventory_item_index].amount;
        } else if(parseInt(amount) === 10) {
            take_amount = 10;

            if(dirty.inventory_items[inventory_item_index].amount < 10) {
                take_amount = dirty.inventory_items[inventory_item_index].amount;
            }
        }

        if(dirty.inventory_items[inventory_item_index].object_id) {
            let adding_to_data = { 'adding_to_type': 'player', 'adding_to_id': socket.player_id,
                'object_id': dirty.inventory_items[inventory_item_index].object_id,
                'object_type_id': dirty.inventory_items[inventory_item_index].object_type_id, 'amount':take_amount };

            // Trying to not await for these two. Since they do mysql inserts and deletes
            await addToInventory(socket, dirty, adding_to_data);
            await removeFromInventory(socket, dirty, { 'inventory_item_id': dirty.inventory_items[inventory_item_index].id,
                'amount': dirty.inventory_items[inventory_item_index].amount });

        } else {
            let adding_to_data = { 'adding_to_type': 'player', 'adding_to_id': socket.player_id,
                'object_type_id': dirty.inventory_items[inventory_item_index].object_type_id, 'amount':take_amount };

            // Trying to not await for these two. Since they do mysql inserts and deletes
            await addToInventory(socket, dirty, adding_to_data);
            await removeFromInventory(socket, dirty, { 'inventory_item_id': dirty.inventory_items[inventory_item_index].id,
                'amount': take_amount });
        }


    } catch(error) {
        log(chalk.red("Error in inventory.take: " + error));
        console.error(error);
    }


}

exports.take = take;


//      data:
async function transferInventory(socket, dirty, data) {
    try {

        // Default to one of the inventory item if nothing is set
        if(!data.amount) {
            data.amount = 1;
        }

        let inventory_item_index = await main.getInventoryItemIndex(data.inventory_item_id);

        if(inventory_item_index === -1) {
            log(chalk.yellow("Could not find inventory item"));
            return false;
        }

        // Make sure it's our inventory item
        if(dirty.inventory_items[inventory_item_index].user_id !== socket.user_id) {
            log(chalk.yellow("Not that user's inventory item"));
            return false;
        }

        // Make sure we have enough of the thing
        if(dirty.inventory_items[inventory_item_index].amount < data.amount) {
            log(chalk.yellow("Inventory item doesn't have enough amount"));
            return false;
        }

        let npc_index = -1;
        // we are giving this item to an npc
        if(data.npc_id) {
            npc_index = await npc.getIndex(dirty, data.npc_id);

            if(npc_index === -1) {
                console.log("Was unable to get the npc");
                return false;
            }
        }



        // Lets setup the remove and add data before we potentially remove the inventory item from the database/dirty
        let remove_inventory_data = { 'inventory_item_id': dirty.inventory_items[inventory_item_index].id,
            'amount': data.amount };

        let adding_to_data = {};

        // and add to the other inventory
        if(npc_index !== -1) {
            adding_to_data.adding_to_type = 'npc';
            adding_to_data.adding_to_id = dirty.npcs[npc_index].id;

        }

        if(dirty.inventory_items[inventory_item_index].object_id) {
            adding_to_data.object_id = dirty.inventory_items[inventory_item_index].object_id;
            adding_to_data.object_type_id = dirty.inventory_items[inventory_item_index].object_type_id;
        } else {
            adding_to_data.object_type_id = dirty.inventory_items[inventory_item_index].object_type_id;
        }

        adding_to_data.amount = data.amount;


        await removeFromInventory(socket, dirty, remove_inventory_data);
        await sendInventory(socket, false, dirty, 'player', socket.player_id);




        await addToInventory(socket, dirty, adding_to_data);


        // If this is something the npc wanted, we increase the relationship
        if(npc_index !== -1) {
            if(dirty.npcs[npc_index].wants_object_type_id === adding_to_data.object_type_id) {


                await world.updatePlayerRelationship(socket, dirty, socket.player_index, {
                    'type': 'npc', 'type_index': npc_index, 'change': 1
                });
            }
        }


        console.log("Gone with inventory transfer");

        if(socket) {
            socket.emit('result_info', { 'status': 'success', 'npc_id': dirty.npcs[npc_index].id, 'text': 'Thanks' });
        }

    } catch(error) {
        log(chalk.red("Error in inventory.transferInventory: " + error));
    }
}

exports.transferInventory = transferInventory;
