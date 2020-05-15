function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
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
        console.error(error);
    }
}

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
        console.error(error);
    }
}


let entire_map = [[],[]];

// Chance to start alive is the chance that something starts as a wall
// 55 and greater - and the entire area is basically wall.
// 50 has a few small pockets
// less than 30 and you basically don't have walls
// 30 is like a huge cavern with a few walls here and there.
// 35 is still a pretty big cavern.
// I LIKE 40
// FOR chance_to_start_alive
// NO WALL       HUGE CAVERN   LARGE CAVERN    NICE BALANCE   SMALLER PASSAGES    FEW SMALL POCKETS      MOSTLY WALL                   ALL WALL
// 1.............30 ...........35..............40.............45..................50.....................55............................100

// SIZE
// 10 is like nothing. 15 is tiny. 20 is pretty small. 30 is medium. 40 and up is really large

let chance_to_start_alive = 40;

let size = 100;

for(let x = 0; x < size; x++) {
    for(let y = 0; y < size; y++) {

        // On new x's, make it an array
        if (!entire_map[x]) entire_map[x] = [];

        let random_chance = getRandomIntInclusive(1,100);
        if(random_chance < chance_to_start_alive) {
            entire_map[x][y] = true;
        } else {
            entire_map[x][y] = false;
        }
    }
}

entire_map = cellSimulationStep(entire_map, size, size);
entire_map = cellSimulationStep(entire_map, size, size);


let line = "";

for(let x = 0; x < size; x++) {

    if(line.length > 1) {
        console.log(line);
        line = "";
    }

    for(let y = 0; y < size; y++) {

        if(entire_map[x][y] === true) {
            line += "X";
        } else {
            line += " ";
        }


    }
}

if(line.length > 1) {
    console.log(line);
}

