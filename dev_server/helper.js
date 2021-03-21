// @ts-check
var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;


function cleanStringInput(name) {

    try {
        return name.replace(/[^a-z0-9áéíóúñü \.,_-]/gim, "").trim();
    } catch (error) {
        log(chalk.red("Error in cleanStringInput: " + error));
    }


}

async function getDestinationCoordIndex(dirty, coord_type, starting_coord_index, direction, tiles_to_move) {

    try {

        let current_coord = {};
        let destination_coord_index = -1;
        let failed_to_find_destination = false;

        if (coord_type === 'ship') {
            current_coord = dirty.ship_coords[starting_coord_index];
        }


        for (let i = 0; i < tiles_to_move && !failed_to_find_destination; i++) {

            if (direction === 'right') {

                // We've done this before for this tile!
                if (typeof current_coord.right_coord_index !== 'undefined') {

                    if (current_coord.right_coord_index === -1) {
                        failed_to_find_destination = true;
                    } else {
                        destination_coord_index = current_coord.right_coord_index;

                        if (coord_type === 'ship') {
                            current_coord = dirty.ship_coords[current_coord.right_coord_index];
                        }
                    }

                }
                // Never tried grabbing this info for this tile
                else {
                    let checking_tile_x = current_coord.tile_x + 1;

                    if (coord_type === 'ship') {
                        let ship_coord_data = {
                            'ship_id': current_coord.ship_id,
                            'level': current_coord.level, 'tile_x': checking_tile_x, 'tile_y': current_coord.tile_y
                        };
                        let right_coord_index = await main.getShipCoordIndex(ship_coord_data);

                        current_coord.right_coord_index = right_coord_index;

                        if (right_coord_index !== -1) {

                            current_coord = dirty.ship_coords[right_coord_index];
                            destination_coord_index = right_coord_index;
                            //console.log("Found index");
                        } else {
                            failed_to_find_destination = true;
                            //console.log("Did not find index");
                        }
                    }
                }


            } else if (direction === 'left') {

                // We've done this before for this tile!
                if (typeof current_coord.left_coord_index !== 'undefined') {

                    if (current_coord.left_coord_index === -1) {
                        failed_to_find_destination = true;
                    } else {
                        destination_coord_index = current_coord.left_coord_index;

                        if (coord_type === 'ship') {
                            current_coord = dirty.ship_coords[current_coord.left_coord_index];
                        }
                    }

                }
                // Never tried grabbing this info for this tile
                else {
                    let checking_tile_x = current_coord.tile_x - 1;

                    if (coord_type === 'ship') {
                        let ship_coord_data = {
                            'ship_id': current_coord.ship_id,
                            'level': current_coord.level, 'tile_x': checking_tile_x, 'tile_y': current_coord.tile_y
                        };
                        let left_coord_index = await main.getShipCoordIndex(ship_coord_data);

                        current_coord.left_coord_index = left_coord_index;

                        if (left_coord_index !== -1) {

                            current_coord = dirty.ship_coords[left_coord_index];
                            destination_coord_index = left_coord_index;
                            //console.log("Found index");
                        } else {
                            failed_to_find_destination = true;
                            //console.log("Did not find index");
                        }
                    }
                }

            } else if (direction === 'up') {

                // We've done this before for this tile!
                if (typeof current_coord.up_coord_index !== 'undefined') {

                    if (current_coord.up_coord_index === -1) {
                        failed_to_find_destination = true;
                    } else {
                        destination_coord_index = current_coord.up_coord_index;

                        if (coord_type === 'ship') {
                            current_coord = dirty.ship_coords[current_coord.up_coord_index];
                        }
                    }

                }
                // Never tried grabbing this info for this tile
                else {
                    let checking_tile_y = current_coord.tile_y - 1;

                    if (coord_type === 'ship') {
                        let ship_coord_data = {
                            'ship_id': current_coord.ship_id,
                            'level': current_coord.level, 'tile_x': current_coord.tile_x, 'tile_y': checking_tile_y
                        };
                        let up_coord_index = await main.getShipCoordIndex(ship_coord_data);

                        current_coord.up_coord_index = up_coord_index;

                        if (up_coord_index !== -1) {

                            current_coord = dirty.ship_coords[up_coord_index];
                            destination_coord_index = up_coord_index;
                            //console.log("Found index");
                        } else {
                            failed_to_find_destination = true;
                            //console.log("Did not find index");
                        }
                    }
                }

            } else if (direction === 'down') {

                // We've done this before for this tile!
                if (typeof current_coord.down_coord_index !== 'undefined') {

                    if (current_coord.down_coord_index === -1) {
                        failed_to_find_destination = true;
                    } else {
                        destination_coord_index = current_coord.down_coord_index;

                        if (coord_type === 'ship') {
                            current_coord = dirty.ship_coords[current_coord.down_coord_index];
                        }
                    }

                }
                // Never tried grabbing this info for this tile
                else {
                    let checking_tile_y = current_coord.tile_y + 1;

                    if (coord_type === 'ship') {
                        let ship_coord_data = {
                            'ship_id': current_coord.ship_id,
                            'level': current_coord.level, 'tile_x': current_coord.tile_x, 'tile_y': checking_tile_y
                        };
                        let down_coord_index = await main.getShipCoordIndex(ship_coord_data);

                        current_coord.down_coord_index = down_coord_index;

                        if (down_coord_index !== -1) {

                            current_coord = dirty.ship_coords[down_coord_index];
                            destination_coord_index = down_coord_index;
                            //console.log("Found index");
                        } else {
                            failed_to_find_destination = true;
                            //console.log("Did not find index");
                        }
                    }
                }

            }


        }


        if (failed_to_find_destination) {
            return -1;
        }

        return destination_coord_index;


    } catch (error) {
        log(chalk.red("Error in helper.getDestinationCoordIndex: " + error));
        console.error(error);
    }
}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}


// Getting in seconds instead of milliseconds matches mysql's default unix timestamp behavior.
function getTimestampInSeconds() {
    return Date.now() / 1000;
}

function isFalse(the_value) {

    if (typeof the_value === "undefined" || the_value === 0 || the_value === "0" ||
        the_value === false || the_value === null || the_value === "null" ||
        (the_value.constructor === Object && Object.keys(the_value).length === 0)) {
        return true;
    }

    return false;
}


function notFalse(the_value) {

    if (typeof the_value === "undefined" || the_value === 0 || the_value === "0" ||
        the_value === false || the_value === null || the_value === "null" || the_value === "" ||
        (the_value.constructor === Object && Object.keys(the_value).length === 0)) {
        return false;
    }

    return true;
}


function rarityRoll() {

    let rarity_roll = getRandomIntInclusive(1, 200);

    if (rarity_roll <= 130) {
        return 1;
    } else if (rarity_roll <= 184) {
        return 2;
    } else if (rarity_roll <= 196) {
        return 3;
    } else {
        return 4;
    }

}


module.exports = {

    cleanStringInput,
    getDestinationCoordIndex,
    getRandomIntInclusive,
    getTimestampInSeconds,
    isFalse,
    notFalse,
    rarityRoll

}
