const port = PORT;
const client_click_name = CLIENT_CLICK_NAME;
const client_functions_name = CLIENT_FUNCTIONS_NAME;
const client_network_name = CLIENT_NETWORK_NAME;
const environment = ENVIRONMENT;
const socket_url = SOCKET_URL;

var script   = document.createElement("script");
script.type  = "text/javascript";
script.src   = socket_url;
document.body.appendChild(script);


//const port = 8010;
//const client_click_name = "client_click_dev.php";
//const client_functions_name = "client_functions_dev.php";
//const client_network_name = "client_network_dev.php";
//const environment = "development";