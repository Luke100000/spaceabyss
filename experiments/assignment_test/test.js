function assingingThings(dirty) {


    let local_thing = dirty.thing[0];
    local_thing.total = 5;

}


var dirty = [];
dirty.thing = [];


dirty.thing.push({ 'id': 1, 'total': 1});
dirty.thing.push({ 'id': 2, 'total': 2});


var monster_info = {};
monster_info.thing = dirty.thing[0];

console.log(dirty.thing[0]);
console.log(dirty.thing[1]);
console.log(monster_info.thing);

assingingThings(dirty);


console.log(dirty.thing[0]);
console.log(dirty.thing[1]);
console.log(monster_info.thing);
