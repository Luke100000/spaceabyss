const {Worker, isMainThread, parentPort} = require('worker_threads');

if (isMainThread) {
    console.log("Worker shouldn't be in main thread");
    return false;
}


console.log("Connect Level Worker Started");


parentPort.once('message', (data) => {


    console.log("Worker is gonna change planet coords");

    parentPort.postMessage({'id': 234, 'name': 'CHANGED!'});
    parentPort.postMessage({'id': 789, 'name': 'CHANGED! MORE'});

});

console.timeEnd("entireWorker");