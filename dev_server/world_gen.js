const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.IPADDRESS,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    connectionLimit: 10
});

function rand(max) {
    return Math.floor(Math.random() * max);
}

async function createWorld() {
    //for (const table of ["ai_rules", "coords", "equipment_linkers", "monsters", "galaxies", "inventories", "inventory_items", "objects", "npcs", "planets", "planet_coords", "ship_coords"]) {
    for (const table of ["coords", "planets", "planet_coords"]) {
        pool.query("TRUNCATE TABLE " + table + ";");
    }

    let galaxy = {};
    galaxy.year = 4000;
    galaxy.month = 1;

    let galaxy_size = 20;

    //we store all blocked tiles
    let blocked = []

    //create an empty space
    let tiles = [39, 39, 39, 21, 21, 33]
    for (let x = 0; x <= galaxy_size; x++) {
        for (let y = 0; y <= galaxy_size; y++) {
            let floor = tiles[rand(tiles.length)];
            pool.query("INSERT INTO coords (tile_x, tile_y, planet_id, planet_type, planet_type_id, object, object_id, object_type_id, floor_type_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [x, y, null, null, null, null, null, null, floor]);
        }
    }

    //create a few forming planets
    for (let i = 0; i < 10; i++) {
        for (let attempt = 0; attempt < 999; attempt++) {
            let x = rand(galaxy_size - 2);
            let y = rand(galaxy_size - 2);
            if (!blocked[x * galaxy_size + y]) {
                let [rows, fields] = await pool.query("SELECT id from coords WHERE tile_x = ? AND tile_y = ?", [x, y])
                let coord_id = rows[0].id

                let [result] = await (pool.query("INSERT INTO planets (tile_x, tile_y, type, x_size, y_size, name, planet_type_id, coord_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [x, y, "Forming", 3, 3, "unnamed planet", 26, coord_id]));

                let planet_id = result.insertId;

                pool.query("UPDATE coords SET planet_id = ?, planet_type = ?, planet_type_id = ? WHERE tile_x = ? AND tile_y = ?", [planet_id, "Forming", 26, x, y])

                //TODO block area around planet
                break
            }
        }
    }
}

console.log("Executing world generator");
createWorld();
console.log("Done");