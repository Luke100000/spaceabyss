const { Worker, isMainThread, parentPort } = require('worker_threads');
var PF = require('pathfinding');


if(isMainThread) {
    console.log("Worker shouldn't be in main thread");
    return false;
}

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}


console.log("Pathfinding Worker Started");

parentPort.once('message', (data) => {


    console.log("Worker is gonna start finding the path!");


    if(data.npc) {
        console.log("Worker is trying to pathfind for an npc");
    }

    // Arbitrarily high/low values that will get overwritten
    let smallest_x = 10000;
    let smallest_y = 10000;
    let largest_x = 0;
    let largest_y = 0;

    let closest_x_to_destination = 0;
    let closest_y_to_destination = 0;
    let closest_x_distance_to_destination = 100;
    let closest_y_distance_to_destination = 100;

    for(let i = 0; i < data.coords.length; i++) {
        if(data.coords[i].tile_x < smallest_x) {
            smallest_x = data.coords[i].tile_x;
            //console.log("Set smallest x to : " + smallest_x);
        }

        if(data.coords[i].tile_x > largest_x) {
            largest_x = data.coords[i].tile_x;
        }

        if(data.coords[i].tile_y < smallest_y) {
            smallest_y = data.coords[i].tile_y;
        }

        if(data.coords[i].tile_y > largest_y) {
            largest_y = data.coords[i].tile_y;
        }

        if(Math.abs(data.destination_x - data.coords[i].tile_x) < closest_x_distance_to_destination) {
            closest_x_to_destination = data.coords[i].tile_x;
            closest_x_distance_to_destination = Math.abs(data.destination_x - data.coords[i].tile_x);
        }

        if(Math.abs(data.destination_y - data.coords[i].tile_y) < closest_y_distance_to_destination) {
            closest_y_to_destination = data.coords[i].tile_y;
            closest_y_distance_to_destination = Math.abs(data.destination_y - data.coords[i].tile_y);
        }
    }

    console.log("The grid we are working with is from " + smallest_x + "," + smallest_y + " to " + largest_x + "," + largest_y);

    let x_size = largest_x - smallest_x;
    let y_size = largest_y - smallest_y;

    let grid = new PF.Grid(x_size, y_size);

    console.log("Created a grid size x,y: " + x_size + "," + y_size);



    // So if we are doing a path around 8,8 to 14,8 or whatever...
    // just - by the smallest x?




    let finder = new PF.AStarFinder();

    for(let i = 0; i < data.coords.length; i++) {

        // Grid indexes start at 0
        let grid_x = data.coords[i].tile_x - smallest_x - 1;
        let grid_y = data.coords[i].tile_y - smallest_y - 1;


        if(data.coords[i].player_id || data.coords[i].belongs_to_player_id || data.coords[i].planet_id || data.coords[i].belongs_to_planet_id || data.coords[i].npc_id) {


            //console.log("Going to set that coord at " + data.coords[i].tile_x + ", " + data.coords[i].tile_y + " is not walkable");
            //console.log("In our grid, the x,y is: " + grid_x + "," + grid_y);
            grid.setWalkableAt(grid_x, grid_y, false);
        }

    }


    let grid_backup = grid;


    let found_path = false;
    let path_attempts = 0;

    let grid_origin_x = data.origin_x - smallest_x - 1;
    let grid_origin_y = data.origin_y - smallest_y - 1;
    let grid_destination_x = closest_x_to_destination - smallest_x - 1;
    let grid_destination_y = closest_y_to_destination - smallest_y - 1;

    console.log("Finding a path from " + grid_origin_x + "," + grid_origin_y + " to: " + grid_destination_x + "," + grid_destination_y);


    let path = [];

    while(!found_path && path_attempts < 10) {

        if(!grid.isWalkableAt(grid_destination_x, grid_destination_y)) {

            // randomly decrement x or y
            if(getRandomIntInclusive(1,2) === 2) {
                grid_destination_y--;
            } else {
                grid_destination_x--;
            }

        }

        path = finder.findPath(grid_origin_x, grid_origin_y,
            grid_destination_x, grid_destination_y, grid);

        console.log(path);

        if(path.length > 0) {
            found_path = true;
        }

        path_attempts++;
        grid = grid_backup.clone();
    }


    // We nee to convert the path back to actual tile_x,tile_y stuff: add in smallest_x,y + 1
    for(let p = 0; p < path.length; p++) {
        path[p][0] += smallest_x + 1;
        path[p][1] += smallest_y + 1;
    }

    parentPort.postMessage(path);









    //parentPort.postMessage({'id': 234, 'name': 'CHANGED!'});
    //parentPort.postMessage({'id': 789, 'name': 'CHANGED! MORE'});

});

