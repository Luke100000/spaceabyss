var io_handler = require('./io.js');
var io = io_handler.io;
var database = require('./database.js');
var pool = database.pool;
const chalk = require('chalk');
const log = console.log;

const helper = require('./helper.js');
const main = require('./space_abyss' + process.env.FILE_SUFFIX + '.js');



async function create(socket, dirty, data) {

    try {


        if(typeof socket.player_index === 'undefined' || socket.player_index === -1) {
            return false;
        }

        let name = data.name;
        console.log("Got faction name as: " + name);
        name = helper.cleanStringInput(name);

        console.log("Sanitized version: " + name);

        // Name is too short!
        if(name.length <= 2) {
            socket.emit('chat', { 'message': 'Faction name is too short', 'scope': 'system' });
            socket.emit('result_info', {'status': 'failure', 'text': 'Faction name is too short' });
            return false;
        }

        if(name.length >= 60) {
            socket.emit('chat', { 'message': 'Faction name is too long', 'scope': 'system' });
            socket.emit('result_info', {'status': 'failure', 'text': 'Faction name is too long' });
            return false;
        }


        // see if there's a matching faction name already
        let faction_index = dirty.factions.findIndex(function (obj) { return obj && obj.name === name; });

        if (faction_index !== -1) {
            socket.emit('chat', { 'message': 'A faction with that name already exists. Please try a different name', 'scope': 'system' });
            return false;
        }

        let player_faction_linker_index = getLinkerIndex(dirty, dirty.players[socket.player_index].id);

        // Make sure the player isn't already part of a faction
        if (player_faction_linker_index !== -1) {
            socket.emit('chat', { 'message': 'You will need to leave your current faction before creating one', 'scope': 'system' });
            return false;
        }


        // we can create the faction
        let sql = "INSERT INTO factions(name, player_id,player_count,requires_invite) VALUES(?,?,?,true)";
        let inserts = [name, dirty.players[socket.player_index].id, 1];

        let [result] = await (pool.query(sql, inserts));

        let new_id = result.insertId;

        console.log("Inserted new faction id: " + new_id);


        let [rows, fields] = await (pool.query("SELECT * FROM factions WHERE id = ?", [new_id]));
        if (rows[0]) {

            let new_faction_index = dirty.factions.push(rows[0]) - 1;

            socket.emit('faction_info', { 'faction': dirty.factions[new_faction_index] });

            // and have the player join!
            let sql_linker = "INSERT INTO faction_linkers(player_id,faction_id,role) VALUES(?,?,'admin')";
            let inserts_linker = [dirty.players[socket.player_index].id, dirty.factions[new_faction_index].id];

            let [result_linker] = await (pool.query(sql_linker, inserts_linker));
            let new_linker_id = result_linker.insertId;
            let [rows_linker, fields_linker] = await (pool.query("SELECT * FROM faction_linkers WHERE id = ?", [new_linker_id]));

            if (rows_linker[0]) {
                let new_faction_linker_index = dirty.faction_linkers.push(rows_linker[0]) - 1;
                socket.emit('faction_linker_info', { 'faction_linker': dirty.faction_linkers[new_faction_linker_index]});
            }
        
        }


    } catch (error) {
        log(chalk.red("Error in faction.create"));
        console.error(error);
    }

}

exports.create = create;


function getIndex(dirty, faction_id) {
    try {

        return dirty.factions.findIndex(function(obj) { return obj && obj.id === parseInt(faction_id); });
    } catch(error) {
        log(chalk.red("Error in faction.getIndex: " + error));
        console.error(error);
    }
}

exports.getIndex = getIndex;

/**
 * @param {Object} dirty
 * @param {number} player_id
 * 
 */
function getLinkerIndex(dirty, player_id) {
    try {

        return dirty.faction_linkers.findIndex(function(obj) { return obj && obj.player_id === parseInt(player_id); });

    } catch(error) {
        log(chalk.red("Error in faction.getLinkerIndex: " + error));
        console.error(error);
    }
}

exports.getLinkerIndex = getLinkerIndex;


async function join(socket, dirty, data) {
    try {

        console.log("In faction.join with faction id: " + data.faction_id);
        if(typeof socket.player_index === 'undefined' || socket.player_index === -1) {
            return false;
        }

        let faction_index = getIndex(dirty, parseInt(data.faction_id));

        if(faction_index === -1) {
            socket.emit('result_info', { 'status': 'failure', 'text': 'Could not find that faction' });
            return false;
        }

        let faction_invitation_id = 0;

        if(dirty.factions[faction_index].requires_invite) {

            let [rows, fields] = await (pool.query("SELECT * FROM faction_invitations WHERE invited_player_id = ? AND faction_id = ?",
            [dirty.players[socket.player_index].id, dirty.factions[faction_index].id]));
            if (rows[0]) {
                // Woot! There's the invite!
                faction_invitation_id = rows[0].id;

            } else {


                socket.emit('result_info', { 'status': 'failure', 'text': 'Joining this faction requires an invite' });
                return false;

            }

        }


        // We can join
        let sql_linker = "INSERT INTO faction_linkers(player_id,faction_id,role) VALUES(?,?,'member')";
        let inserts_linker = [dirty.players[socket.player_index].id, dirty.factions[faction_index].id];

        let [result_linker] = await (pool.query(sql_linker, inserts_linker));
        let new_linker_id = result_linker.insertId;
        let [rows_linker, fields_linker] = await (pool.query("SELECT * FROM faction_linkers WHERE id = ?", [new_linker_id]));

        if (rows_linker[0]) {
            let new_faction_linker_index = dirty.faction_linkers.push(rows_linker[0]) - 1;
            socket.emit('faction_linker_info', { 'faction_linker': dirty.faction_linkers[new_faction_linker_index]});

            socket.emit('result_info', { 'status': 'success', 'text': "Joined " + dirty.factions[faction_index].name + " Faction!"});

            if(faction_invitation_id !== 0) {
                // and remove the invitation
                (pool.query("DELETE FROM faction_invitations WHERE id = ?", [faction_invitation_id]));
            }

            dirty.factions[faction_index].player_count++;
            dirty.factions[faction_index].has_change = true;
            
        }





    } catch(error) {
        log(chalk.red("Error in faction.join: " + error));
        console.error(error);
    }
}

exports.join = join;

/**
 * @param {Object} socket
 * @param {Object} dirty
 * @param {Object} data
 */
async function leave(socket, dirty) {
    try {

        if(typeof socket.player_index === 'undefined' || socket.player_index === -1) {
            return false;
        }

        let faction_linker_index = dirty.faction_linkers.findIndex(function(obj) { return obj && obj.player_id === dirty.players[socket.player_index].id; });

        if(faction_linker_index === -1) {
            socket.emit('result_info', { 'status': 'failure', 'text': "You are not part of any faction" });
            return false;
        }

        let faction_index = dirty.factions.findIndex(function(obj) { return obj && obj.id === dirty.faction_linkers[faction_linker_index].faction_id; });

        (pool.query("DELETE FROM faction_linkers WHERE id = ?", [dirty.faction_linkers[faction_linker_index].id]));

        socket.emit('faction_linker_info', { 'remove': true, 'faction_linker': dirty.faction_linkers[faction_linker_index] });
        delete dirty.faction_linkers[faction_linker_index];



        dirty.players[socket.player_index].faction_id = false;
        dirty.players[socket.player_index].has_change = true;

        let player_info = getPlayerCoordAndRoom(dirty, socket.player_index);

        if (player_info.room) {
            io.to(player_info.room).emit('player_info', { 'player': dirty.players[socket.player_index] });
        }

        // Decrease the faction's player count
        if (faction_index !== -1) {
            dirty.factions[faction_index].player_count--;
            dirty.factions[faction_index].has_change = true;
        }

        return;

    } catch (error) {
        log(chalk.red("Error in world.leaveFaction: " + error));
        console.error(error);
    }
}

exports.leave = leave;


async function sendData(socket, dirty) {
    //console.log("Client is requesting faction data");

    dirty.factions.forEach(function(faction) {
        socket.emit('faction_info', { 'faction': faction });
    });


}

exports.sendData = sendData;