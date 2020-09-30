var bcrypt = require('bcrypt-nodejs');




let login_success = false;


let password = "secret";
let hash = "$2y$10$3I5wcj9.My22NapfBHIIbuuCKdZWAPyHomJg4bwp.sS.KoOsf9Ygy";
hash = hash.replace(/^\$2y(.+)$/i, '$2a$1');

if(!bcrypt.compareSync(password, hash)) {
    console.log("Invalid login info - normal");
} else {
    login_success = true;
    console.log("Logged in!");
}