function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

let grid_size = 1000;
let coords = [];
let i = 0;

for(let x = 0; x < grid_size; x++) {

    for(let y = 0; y < grid_size; y++) {

        coords[i] = new Object();
        coords[i].id = i;
        coords[i].tile_x = x;
        coords[i].tile_y = y;
        i++;
    }
}


let origin_tile_x = getRandomIntInclusive(1, grid_size - 2);
let origin_tile_y = getRandomIntInclusive(1, grid_size - 1);


console.time('normal');
let coord_index = coords.findIndex(function(obj) { return obj && obj.tile_x === origin_tile_x && obj.tile_y === origin_tile_y });
let neighbor_coord_index = coords.findIndex(function(obj) { return obj && obj.tile_x === origin_tile_x + 2 && obj.tile_y === origin_tile_y });
let total_x = coords[coord_index].tile_x + coords[neighbor_coord_index].tile_x;
console.log("Total x: " + total_x);
console.timeEnd('normal');

coords[coord_index].right_index = neighbor_coord_index;


console.time("right_index");
let right_coord_index = coords.findIndex(function(obj) { return obj && obj.tile_x === origin_tile_x && obj.tile_y === origin_tile_y });
let right_neighbor_coord_index = coords[right_coord_index].right_index;
let right_total_x = coords[right_coord_index].tile_x + coords[right_neighbor_coord_index].tile_x;
console.log("Right Total x: " + right_total_x);
console.timeEnd("right_index");
