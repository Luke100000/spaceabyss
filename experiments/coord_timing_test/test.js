function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

let grid_size = 1000;
let coords = [];
let i = 0;

// Create a grid_dize amount of coords
for(let x = 0; x < grid_size; x++) {

    for(let y = 0; y < grid_size; y++) {

        coords[i] = new Object();
        coords[i].id = i;
        coords[i].tile_x = x;
        coords[i].tile_y = y;
        i++;
    }
}


let normal_total = 0;
let right_total = 0;

for(let i = 0; i < 100000; i++) {

    if(i % 1000 === 0) {
        console.log("Next thousand...");
        console.log(normal_total);
        console.log(right_total);

        normal_total = 0;
        right_total = 0;
    }
    // Lets start at a random place. If we use the whole grid size, it'll take a long time 
    // before we see any performance improvements. Limiting it to 400-600 
    let origin_tile_x = getRandomIntInclusive(400, 600);
    let origin_tile_y = getRandomIntInclusive(400, 600);

    let coord_index = coords.findIndex(function(obj) { return obj && obj.tile_x === origin_tile_x && obj.tile_y === origin_tile_y; });


    // NORMAL WAY
    //console.time('normal');
    let normal_start = Date.now();
    let neighbor_coord_index = coords.findIndex(function(obj) { return obj && obj.tile_x === origin_tile_x + 1 && obj.tile_y === origin_tile_y; });
    let normal_end = Date.now();
    //console.timeEnd('normal');
    normal_total += (normal_end - normal_start);


    // RIGHT INDEX WAY
    let right_start = Date.now();
    if(typeof coords[coord_index].right_coord_index !== "undefined") {
        //console.log("Hit an index!");
    } else {
        let neighbor_coord_index = coords.findIndex(function(obj) { return obj && obj.tile_x === origin_tile_x + 1 && obj.tile_y === origin_tile_y; });
        coords[coord_index].right_coord_index = neighbor_coord_index;
    }
    let right_end = Date.now();
    right_total += (right_end - right_start);
}

console.log(normal_total);
console.log(right_total);

